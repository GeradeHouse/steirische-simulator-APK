import { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Direction, NoteDefinition } from '../types';
import { BASS_ROWS, TREBLE_ROWS } from '../constants';
import { getButtonIdsForNote } from '../helpers/midiMap';

// Debug logging (auto-enabled on native unless explicitly disabled)
let __accDbgBootLogged = false;

const accDbgEnabled = () => {
  const g = globalThis as any;
  if (typeof g.__ACC_DEBUG_FINGERING__ === 'boolean') return g.__ACC_DEBUG_FINGERING__;

  const enabled = Capacitor.getPlatform() !== 'web';
  g.__ACC_DEBUG_FINGERING__ = enabled;

  if (enabled && !__accDbgBootLogged) {
    __accDbgBootLogged = true;
    // eslint-disable-next-line no-console
    console.warn('[acc-debug] enabled (default)', { platform: Capacitor.getPlatform() });
  }

  return enabled;
};

const dbg = (...args: any[]) => {
  if (!accDbgEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[acc-debug]', ...args);
};

interface MidiDataSubset {
  notes: any[];
  currentTime: number;
  channelModes: any;
  octaveShift: number;
  semitoneShift: number;
  onFingeringOverride?: (midi: number, time: number, channel: number, btnId: string) => void;
}

interface UseButtonHighlightsProps {
  activeNotes: Set<string>;
  direction: Direction;
  midiData?: MidiDataSubset;
  handleNoteStart: (id: string, noteDef: NoteDefinition, type: 'bass' | 'chord' | 'treble', chordType?: any, direction?: Direction) => void;
  handleNoteStop: (id: string) => void;
}

export const useButtonHighlights = ({
  activeNotes,
  direction,
  midiData,
  handleNoteStart,
  handleNoteStop
}: UseButtonHighlightsProps) => {

  accDbgEnabled();
  dbg('boot:useButtonHighlights', { platform: Capacitor.getPlatform() });

  // Helper to lookup button definition
  const getButtonDef = (id: string) => {
    const parts = id.split('-');
    if (parts.length !== 3) return null;
    const typeStr = parts[0];
    const r = parseInt(parts[1]);
    const b = parseInt(parts[2]);
    const rows = typeStr === 'bass' ? BASS_ROWS : TREBLE_ROWS;
    return rows.find(row => row.rowId === r)?.buttons[b];
  };

  // 1. Calculate Active MIDI Highlights (for Piano Roll)
  const activeMidiHighlights = useMemo(() => {
    const highlights = new Set<string>();
    activeNotes.forEach(id => {
      const def = getButtonDef(id);
      if (def) {
        const noteDef = direction === Direction.PUSH ? def.push : def.pull;
        highlights.add(`${noteDef.midi}-${direction}`);
      }
    });
    return highlights;
  }, [activeNotes, direction]);

  // 2. Handle Piano Roll Note Preview
  const handlePianoRollPreview = (midi: number, dir: Direction, start: boolean) => {
    const btnIds = getButtonIdsForNote(midi, dir);
    // INSERT immediately after `const btnIds = getButtonIdsForNote(midi, dir);`
    dbg('pianoRollPreview', {
      start,
      midi,
      dir,
      currentTime: midiData?.currentTime ?? null,
      candidateBtnIds: btnIds
    });
    btnIds.forEach(id => {
      if (start) {
        const def = getButtonDef(id);
        if (def) {
          const noteDef = dir === Direction.PUSH ? def.push : def.pull;
          const type = noteDef.type as any;
          const chordType = noteDef.chordType;
          handleNoteStart(id, { midi, label: 'Preview' }, type, chordType, dir);
        }
      } else {
        handleNoteStop(id);
      }
    });
  };

  // 3. Handle Alternative Click (Fingering Override)
  const handleAlternativeClick = (id: string) => {
    if (!midiData?.onFingeringOverride) return;
    
    const def = getButtonDef(id);
    if (!def) return;
    
    const noteDef = direction === Direction.PUSH ? def.push : def.pull;

    // INSERT immediately after `const t = midiData.currentTime;`
    const t = midiData.currentTime;
    dbg('altClick:start', {
      btnId: id,
      direction,
      targetShiftedMidi: noteDef.midi,
      currentTime: t
    });

    let best: any | null = null;

    // Prefer the most recent note instance that overlaps the current time.
    // This avoids selecting an earlier overlapping note when multiple same-pitch
    // notes overlap (legato/quantized durations or unsorted note arrays).
    // Replace the existing loop body by adding `matches` counting and an end log.
    let matches = 0;

    for (const n of midiData.notes) {
      const start = n.time;
      const end = n.time + n.duration;

      // Check time overlap
      if (t < start || t >= end) continue;

      // Check visibility (channel mode)
      const mode = midiData.channelModes[n.channel] || 'muted';
      if (mode === 'muted' || mode === 'hidden') continue;

      // Check pitch match (including shifts)
      const shifted = n.midi + (midiData.octaveShift * 12) + midiData.semitoneShift;
      if (shifted !== noteDef.midi) continue;

      matches++;

      if (!best || start > best.time) best = n;
    }

    dbg('altClick:match', {
      btnId: id,
      matches,
      chosen: best
        ? { midi: best.midi, time: best.time, duration: best.duration, channel: best.channel }
        : null
    });

    if (best) {
      midiData.onFingeringOverride(best.midi, best.time, best.channel, id);
    }
  };

  return {
    activeMidiHighlights,
    handlePianoRollPreview,
    handleAlternativeClick
  };
};
