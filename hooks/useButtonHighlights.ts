import { useMemo } from 'react';
import { Direction, NoteDefinition } from '../types';
import { BASS_ROWS, TREBLE_ROWS } from '../constants';
import { getButtonIdsForNote } from '../helpers/midiMap';

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

    const currentMidiNote = midiData.notes.find(n => {
        const start = n.time;
        const end = n.time + n.duration;
        const t = midiData.currentTime;
        
        // Check time overlap
        if (t < start || t >= end) return false;

        // Check visibility (channel mode)
        const mode = midiData.channelModes[n.channel] || 'muted';
        if (mode === 'muted' || mode === 'hidden') return false;

        // Check pitch match (including semitone shift)
        const shifted = n.midi + (midiData.octaveShift * 12) + midiData.semitoneShift;
        return shifted === noteDef.midi;
    });

    if (currentMidiNote) {
        midiData.onFingeringOverride(currentMidiNote.midi, currentMidiNote.time, currentMidiNote.channel, id);
    }
  };

  return {
    activeMidiHighlights,
    handlePianoRollPreview,
    handleAlternativeClick
  };
};