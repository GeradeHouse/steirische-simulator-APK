import React from 'react';
import { HandDrawnNote } from './HandDrawnNote';
import { MidiNote, ChannelMode, Direction } from '../../hooks/midi/types';
import { getButtonIdsForNote, getNoteKey } from '../../helpers/midiMap';
import { getNoteColor } from '../../helpers/visuals';

interface Props {
  visibleNotes: MidiNote[];
  pxPerSec: number;
  noteHeight: number;
  octaveShift: number;
  semitoneShift: number;
  MAX_MIDI: number;
  currentTime: number;
  channelModes: Record<number, ChannelMode>;
  activeMidiHighlights?: Set<string>;
  editingNote?: { midi: number, time: number, channel: number } | null;
  flashingNotes?: Set<string>;
  getDirectionAtTime: (t: number) => Direction;
  getNoteLabel: (m: number) => string;
  onNoteMouseDown: (e: React.MouseEvent, note: MidiNote, dir: Direction) => void;
  onNoteMouseUp: (e: React.MouseEvent, midi: number, dir: Direction) => void;
  focusMode?: 'treble' | 'bass' | 'chord' | 'off';
}

export const PianoRollNotes: React.FC<Props> = ({
  visibleNotes, pxPerSec, noteHeight, octaveShift, semitoneShift, MAX_MIDI, currentTime,
  channelModes, activeMidiHighlights, editingNote, flashingNotes, getDirectionAtTime, getNoteLabel,
  onNoteMouseDown, onNoteMouseUp, focusMode = 'off'
}) => {
  return (
    <>
      {visibleNotes.map((note, idx) => {
        const left = note.time * pxPerSec;
        const width = Math.max(note.duration * pxPerSec, 10);
        const shiftedMidi = note.midi + (octaveShift * 12) + semitoneShift;
        const top = (MAX_MIDI - shiftedMidi) * noteHeight;
        const label = getNoteLabel(shiftedMidi);
        
        const noteDir = getDirectionAtTime(note.time);
        const mode = channelModes[note.channel] || 'muted';
        const allIds = getButtonIdsForNote(shiftedMidi, noteDir);
        const hasMapping = allIds.some(id => {
          if (mode === 'treble') return id.startsWith('treble');
          if (mode === 'bass') return id.startsWith('bass');
          return true;
        });
        const highlightKey = `${shiftedMidi}-${noteDir}`;
        const isUnderPlayhead = currentTime >= note.time && currentTime < (note.time + note.duration);
        const isHighlighted = activeMidiHighlights?.has(highlightKey) && isUnderPlayhead;

        const isEditing = editingNote &&
                          editingNote.midi === note.midi &&
                          Math.abs(editingNote.time - note.time) < 0.001 &&
                          editingNote.channel === note.channel;
        
        const noteKey = getNoteKey(note.midi, note.time, note.channel);
        const isFlashing = flashingNotes?.has(noteKey);
        const wobbleIdx = (note.midi + Math.floor(note.time)) % 3 + 1;

        return (
          <div
            key={`${note.midi}-${note.time}-${idx}`}
            className="absolute transition-transform hover:scale-[1.02]"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${noteHeight}px`,
              zIndex: (isEditing || isFlashing) ? 50 : (mode === 'treble' || mode === 'bass' ? 20 : 10)
            }}
            onMouseDown={(e) => onNoteMouseDown(e, note, noteDir)}
            onMouseUp={(e) => onNoteMouseUp(e, shiftedMidi, noteDir)}
            onMouseLeave={(e) => onNoteMouseUp(e, shiftedMidi, noteDir)}
          >
            <HandDrawnNote
              width={width}
              height={noteHeight}
              label={label}
              hasMapping={hasMapping}
              isHighlighted={!!isHighlighted}
              isEditing={!!isEditing}
              isFlashing={!!isFlashing}
              baseColor={getNoteColor(shiftedMidi, mode as 'treble' | 'bass' | 'chord')}
            />
          </div>
        );
      })}
    </>
  );
};
