import { Direction } from '../../../types';
import { MidiNote, ChannelMode, DirectionEvent } from '../types';
import { getButtonIdsForNote, getNoteKey, getButtonCoords } from '../../../helpers/midiMap';
import { BASS_ROWS } from '../../../constants';
import { analyzeChordStructure } from '../../../helpers/musicTheory';

interface ScrubberContext {
  time: number;
  allNotes: MidiNote[];
  directionEvents: DirectionEvent[];
  channelModes: Record<number, ChannelMode>;
  octaveShift: number;
  semitoneShift: number;
  fingeringOverrides: Record<string, string>;
  activeScrubbingNotes: Set<string>;
  audioController: any;
  isScrubbingSoundEnabled: boolean;
  currentDirection: Direction;
  setDirection: (d: Direction) => void;
}

export const syncScrubbingNotes = (ctx: ScrubberContext): Set<string> => {
  const { 
    time, allNotes, directionEvents, channelModes, octaveShift, semitoneShift, 
    fingeringOverrides, activeScrubbingNotes, audioController, 
    isScrubbingSoundEnabled, currentDirection, setDirection 
  } = ctx;

  // 1. Determine Direction
  let dir = Direction.PUSH;
  if (directionEvents.length > 0) {
    let left = 0;
    let right = directionEvents.length - 1;
    let lastValidIndex = -1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const event = directionEvents[mid];
      if (event.time <= time + 0.001) {
        lastValidIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    if (lastValidIndex >= 0) {
      dir = directionEvents[lastValidIndex].direction;
    }
  }
  
  if (dir !== currentDirection) {
    setDirection(dir);
    activeScrubbingNotes.forEach(id => audioController.handleNoteStop(id));
    activeScrubbingNotes.clear();
  }

  // 2. Gather Notes
  const notesToSolve: { note: MidiNote, candidates: string[], allCandidates: string[], shiftedMidi: number }[] = [];
  const chordNotes: MidiNote[] = [];

  allNotes.forEach(note => {
    if (time >= note.time && time < note.time + note.duration - 0.03) {
      const mode = channelModes[note.channel] || 'muted';
      if (mode === 'muted' || mode === 'hidden') return;

      if (mode === 'chord') {
          chordNotes.push(note);
          return;
      }

      const shiftedMidi = note.midi + (octaveShift * 12) + semitoneShift;
      const allBtnIds = getButtonIdsForNote(shiftedMidi, dir);
      
      const candidates = allBtnIds.filter(btnId => {
          const isBassBtn = btnId.startsWith('bass');
          const isTrebleBtn = btnId.startsWith('treble');
          if (mode === 'bass' && !isBassBtn) return false;
          if (mode === 'treble' && !isTrebleBtn) return false;
          return true;
      });

      if (candidates.length === 0) return;

      const key = getNoteKey(note.midi, note.time, note.channel);
      const overrideId = fingeringOverrides[key];

      let validIds = candidates;
      if (overrideId && candidates.includes(overrideId)) {
          validIds = [overrideId];
      }

      notesToSolve.push({ note, candidates: validIds, allCandidates: candidates, shiftedMidi });
    }
  });

  // 3. Group by Time & Sort
  const groups = new Map<number, typeof notesToSolve>();
  notesToSolve.forEach(item => {
      const t = item.note.time;
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(item);
  });
  const sortedTimes = Array.from(groups.keys()).sort((a, b) => a - b);

  // 4. Incremental Solve
  const finalAssignment: string[] = [];
  const prevActive: string[] = Array.from(activeScrubbingNotes);

  const getCost = (id1: string, id2: string) => {
      if (id1.charCodeAt(0) !== id2.charCodeAt(0)) return 100;
      const c1 = getButtonCoords(id1);
      const c2 = getButtonCoords(id2);
      return Math.abs(c1.c - c2.c) + Math.abs(c1.r - c2.r) * 4;
  };

  sortedTimes.forEach(t => {
      const groupItems = groups.get(t)!;
      let bestGroupCost = Infinity;
      let bestGroupAssign: string[] = [];

      const search = (idx: number, current: string[]) => {
          if (idx === groupItems.length) {
              let cost = 0;
              for (let i = 0; i < current.length; i++) {
                  for (let j = i + 1; j < current.length; j++) {
                      cost += getCost(current[i], current[j]);
                  }
              }
              for (let i = 0; i < current.length; i++) {
                  for (const assigned of finalAssignment) {
                      cost += getCost(current[i], assigned);
                  }
              }
              for (let i = 0; i < current.length; i++) {
                  for (const active of prevActive) {
                      cost += getCost(current[i], active);
                  }
              }

              if (cost < bestGroupCost) {
                  bestGroupCost = cost;
                  bestGroupAssign = [...current];
              }
              return;
          }

          const candidates = groupItems[idx].candidates;
          for (const cand of candidates) {
              current.push(cand);
              search(idx + 1, current);
              current.pop();
          }
      };

      search(0, []);
      finalAssignment.push(...bestGroupAssign);
  });

  // 4b. Solve Chords
  const chordButtons: { id: string, def: any }[] = [];
  if (chordNotes.length > 0) {
      const chordGroups = new Map<number, number[]>();
      chordNotes.forEach(n => {
          if (!chordGroups.has(n.channel)) chordGroups.set(n.channel, []);
          chordGroups.get(n.channel)!.push(n.midi + (octaveShift * 12) + semitoneShift);
      });

      chordGroups.forEach((midis) => {
          const analysis = analyzeChordStructure(midis);
          if (analysis) {
              let found = false;
              for (let r = 0; r < BASS_ROWS.length; r++) {
                  const row = BASS_ROWS[r];
                  for (let b = 0; b < row.buttons.length; b++) {
                      const btn = row.buttons[b];
                      const noteDef = dir === Direction.PUSH ? btn.push : btn.pull;
                      if (noteDef.type === 'chord') {
                           if ((noteDef.midi % 12) === (analysis.rootPC % 12) &&
                               noteDef.chordType === analysis.type) {
                               chordButtons.push({ id: `bass-${r}-${b}`, def: noteDef });
                               found = true;
                               break;
                           }
                      }
                  }
                  if (found) break;
              }
          }
      });
  }

  // 5. Sync & Alternatives
  const nextActiveIds = new Set<string>(finalAssignment);
  chordButtons.forEach(c => nextActiveIds.add(c.id));
  const calculatedAlternatives = new Set<string>();

  activeScrubbingNotes.forEach(id => {
      if (!nextActiveIds.has(id)) {
          audioController.handleNoteStop(id);
          activeScrubbingNotes.delete(id);
      }
  });

  let assignIdx = 0;
  sortedTimes.forEach(t => {
      const groupItems = groups.get(t)!;
      groupItems.forEach(item => {
          const btnId = finalAssignment[assignIdx++];
          
          item.allCandidates.forEach(cand => {
              if (cand !== btnId) calculatedAlternatives.add(cand);
          });

          // Fix: Check audioController.activeNotes to ensure UI is in sync, even if activeScrubbingNotes thinks it's on.
          if (!activeScrubbingNotes.has(btnId) || !audioController.activeNotes.has(btnId)) {
               const isBassRow = btnId.startsWith('bass');
               let type: 'bass' | 'chord' | 'treble' = 'treble';
               let chordType = undefined;

               if (isBassRow) {
                  const [_, rStr, bStr] = btnId.split('-');
                  const r = parseInt(rStr);
                  const b = parseInt(bStr);
                  const def = BASS_ROWS.find(row => row.rowId === r)?.buttons[b];
                  if (def) {
                      const noteDef = dir === Direction.PUSH ? def.push : def.pull;
                      type = noteDef.type as any;
                      chordType = noteDef.chordType;
                  }
               }

               audioController.handleNoteStart(
                 btnId,
                 { midi: item.shiftedMidi, label: 'Scrub' },
                 type,
                 chordType,
                 dir,
                 {
                   silent: !isScrubbingSoundEnabled,
                   duration: 2.0
                 }
               );
               activeScrubbingNotes.add(btnId);
          }
      });
  });

  // Start Chords
  chordButtons.forEach(item => {
      const btnId = item.id;
      if (!activeScrubbingNotes.has(btnId) || !audioController.activeNotes.has(btnId)) {
           audioController.handleNoteStart(
             btnId,
             { midi: item.def.midi, label: item.def.label },
             'chord',
             item.def.chordType,
             dir,
             {
               silent: !isScrubbingSoundEnabled,
               duration: 2.0
             }
           );
           activeScrubbingNotes.add(btnId);
      }
  });
  
  return calculatedAlternatives;
};
