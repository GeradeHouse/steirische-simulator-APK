import { Direction } from '../../../types';
import { MidiEvent, ChannelMode, ActiveMidiMapping } from '../types';
import { getButtonIdsForNote, getNoteKey, getButtonCoords } from '../../../helpers/midiMap';
import { BASS_ROWS } from '../../../constants';
import { analyzeChordStructure } from '../../../helpers/musicTheory';

interface SolverContext {
  direction: Direction;
  channelModes: Record<number, ChannelMode>;
  octaveShift: number;
  semitoneShift: number;
  fingeringOverrides: Record<string, string>;
  activeMidiMapping: Map<string, ActiveMidiMapping>;
  audioController: any;
}

export const solveAndPlayBatch = (
  events: MidiEvent[],
  ctx: SolverContext
) => {
  const { direction, channelModes, octaveShift, semitoneShift, fingeringOverrides, activeMidiMapping, audioController } = ctx;
  
  // Extract btnIds from the mapping objects
  const activeIds = Array.from(activeMidiMapping.values()).map(v => v.btnId);
  
  const standardEvents: MidiEvent[] = [];
  const chordEvents: MidiEvent[] = [];

  events.forEach(e => {
      const mode = e.channel !== undefined ? (channelModes[e.channel] || 'muted') : 'both';
      if (mode === 'muted' || mode === 'hidden') return;
      if (mode === 'chord') {
          chordEvents.push(e);
      } else {
          standardEvents.push(e);
      }
  });

  // --- 1. Process Standard Events (Treble/Bass) ---
  if (standardEvents.length > 0) {
      const notesToSolve: { event: MidiEvent, candidates: string[] }[] = [];
      
      standardEvents.forEach(e => {
         const mode = e.channel !== undefined ? (channelModes[e.channel] || 'muted') : 'both';
         const shiftedMidi = e.midi! + (octaveShift * 12) + semitoneShift;
         
         const allIds = getButtonIdsForNote(shiftedMidi, direction);
         const candidates = allIds.filter(id => {
            const isBass = id.startsWith('bass');
            if (mode === 'bass' && !isBass) return false;
            if (mode === 'treble' && isBass) return false;
            return true;
         });

         if (candidates.length === 0) return;

         const key = getNoteKey(e.midi!, e.time, e.channel || 0);
         const overrideId = fingeringOverrides[key];

         let validIds = candidates;
         if (overrideId && candidates.includes(overrideId)) {
           validIds = [overrideId];
         }
         
         notesToSolve.push({ event: e, candidates: validIds });
      });

      if (notesToSolve.length > 0) {
          let bestCost = Infinity;
          let bestAssignment: string[] = [];

          const getCost = (id1: string, id2: string) => {
              // Optimization: Use cached coordinates to avoid string splitting/parsing in loop
              // Check type equality by first char (b for bass, t for treble)
              if (id1.charCodeAt(0) !== id2.charCodeAt(0)) return 100;
              
              const c1 = getButtonCoords(id1);
              const c2 = getButtonCoords(id2);
              
              return Math.abs(c1.c - c2.c) + Math.abs(c1.r - c2.r) * 4;
          };

          const search = (idx: number, current: string[]) => {
              if (idx === notesToSolve.length) {
                  let cost = 0;
                  for (let i = 0; i < current.length; i++) {
                      for (let j = i + 1; j < current.length; j++) {
                          cost += getCost(current[i], current[j]);
                      }
                  }
                  for (let i = 0; i < current.length; i++) {
                      for (const active of activeIds) {
                          cost += getCost(current[i], active);
                      }
                  }
                  if (cost < bestCost) {
                      bestCost = cost;
                      bestAssignment = [...current];
                  }
                  return;
              }

              const candidates = notesToSolve[idx].candidates;
              for (const cand of candidates) {
                  current.push(cand);
                  search(idx + 1, current);
                  current.pop();
              }
          };

          search(0, []);

          bestAssignment.forEach((btnId, idx) => {
              const event = notesToSolve[idx].event;
              const shiftedMidi = event.midi! + (octaveShift * 12) + semitoneShift;
              const key = `${event.midi}-${event.channel}`;
              activeMidiMapping.set(key, { btnId, channel: event.channel || 0, midi: event.midi! });
              
              const isBassRow = btnId.startsWith('bass');
              let type: 'bass' | 'chord' | 'treble' = 'treble';
              let chordType = undefined;
              
              if (isBassRow) {
                   const [_, rStr, bStr] = btnId.split('-');
                   const r = parseInt(rStr);
                   const b = parseInt(bStr);
                   const def = BASS_ROWS.find(row => row.rowId === r)?.buttons[b];
                   if (def) {
                       const noteDef = direction === Direction.PUSH ? def.push : def.pull;
                       type = noteDef.type as any;
                       chordType = noteDef.chordType;
                   }
              }
              
              audioController.handleNoteStart(btnId, { midi: shiftedMidi, label: 'MIDI' }, type, chordType, direction);
          });
      }
  }

  // --- 2. Process Chord Events ---
  if (chordEvents.length > 0) {
      const channelGroups = new Map<number, MidiEvent[]>();
      chordEvents.forEach(e => {
          const ch = e.channel || 0;
          if (!channelGroups.has(ch)) channelGroups.set(ch, []);
          channelGroups.get(ch)!.push(e);
      });

      channelGroups.forEach((groupEvents, channel) => {
          const midis = groupEvents.map(e => e.midi! + (octaveShift * 12) + semitoneShift);
          const analysis = analyzeChordStructure(midis);
          
          if (analysis) {
              let foundBtnId: string | null = null;
              let foundNoteDef: any = null;

              for (let r = 0; r < BASS_ROWS.length; r++) {
                  const row = BASS_ROWS[r];
                  for (let b = 0; b < row.buttons.length; b++) {
                      const btn = row.buttons[b];
                      const noteDef = direction === Direction.PUSH ? btn.push : btn.pull;
                      
                      if (noteDef.type === 'chord') {
                          if ((noteDef.midi % 12) === (analysis.rootPC % 12) &&
                              noteDef.chordType === analysis.type) {
                              foundBtnId = `bass-${r}-${b}`;
                              foundNoteDef = noteDef;
                              break;
                          }
                      }
                  }
                  if (foundBtnId) break;
              }

              if (foundBtnId && foundNoteDef) {
                  groupEvents.forEach(e => {
                      const key = `${e.midi}-${e.channel}`;
                      activeMidiMapping.set(key, {
                          btnId: foundBtnId!,
                          channel: e.channel || 0,
                          midi: e.midi!
                      });
                  });

                  audioController.handleNoteStart(
                      foundBtnId,
                      { midi: foundNoteDef.midi, label: foundNoteDef.label },
                      'chord',
                      foundNoteDef.chordType,
                      direction
                  );
              }
          }
      });
  }
};
