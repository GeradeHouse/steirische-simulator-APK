import React from 'react';
import { ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Direction } from '../../types';
import { MidiNote } from '../../hooks/midi/types';

export const PianoKeys: React.FC<{ rows: number[], noteHeight: number, getNoteLabel: (m: number) => string, isBlackKey: (m: number) => boolean }> = ({ rows, noteHeight, getNoteLabel, isBlackKey }) => (
  <div className="absolute left-0 top-0 bottom-0 w-12 z-20 border-r border-gray-300 shadow-md bg-gray-50">
    {rows.map(midi => (
      <div
        key={`key-${midi}`}
        className="flex items-center justify-center text-[10px] font-bold text-gray-600 border-b border-gray-200"
        style={{
          height: noteHeight,
          backgroundColor: isBlackKey(midi) ? '#E5E7EB' : '#FFFFFF',
          fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif'
        }}
      >
        {getNoteLabel(midi)}
      </div>
    ))}
  </div>
);

export const PianoGrid: React.FC<{ rows: number[], noteHeight: number, isBlackKey: (m: number) => boolean }> = ({ rows, noteHeight, isBlackKey }) => (
  <div className="absolute inset-0 z-0 pointer-events-none">
    {rows.map(midi => (
      <div
        key={`row-${midi}`}
        className="w-full border-b border-gray-100/50"
        style={{
          height: noteHeight,
          backgroundColor: isBlackKey(midi) ? '#F0EEE8' : '#FBFBF9'
        }}
      />
    ))}
  </div>
);

export const ChordLabels: React.FC<{ labels: any[], pxPerSec: number }> = ({ labels, pxPerSec }) => (
  <>
    {labels.map((label, idx) => (
      <div
        key={`chord-${idx}-${label.time}`}
        className="absolute z-40 px-1.5 py-0.5 rounded bg-white/90 border border-gray-300 shadow-sm text-[10px] font-bold text-indigo-700 whitespace-nowrap pointer-events-none"
        style={{
          left: `${label.left * pxPerSec}px`,
          top: `${label.top - 20}px`,
          transform: 'translateX(-10%)'
        }}
      >
        {label.text}
      </div>
    ))}
  </>
);

export const ArrowLayer: React.FC<{
  visibleNotes?: MidiNote[],
  scrollTop?: number,
  clientHeight?: number,
  groups: any[],
  pxPerSec: number,
  noteHeight: number,
  octaveShift: number,
  semitoneShift: number,
  MAX_MIDI: number,
  selectedTimes: Set<number>,
  getDirectionAtTime: (t: number) => Direction,
  onArrowClick: (e: React.MouseEvent, t: number, d: Direction) => void
}> = ({ visibleNotes = [], scrollTop = 0, clientHeight = 0, groups, pxPerSec, noteHeight, octaveShift, semitoneShift, MAX_MIDI, selectedTimes, getDirectionAtTime, onArrowClick }) => {
  
  return (
    <>
      {groups.map((group) => {
          const items = [];
          const dir = getDirectionAtTime(group.time);
          const isSelected = selectedTimes.has(group.time);
          const arrowClass = `absolute flex items-center justify-center w-6 h-6 cursor-pointer transition-transform hover:scale-125 z-20 ${isSelected ? 'text-blue-600 drop-shadow-md scale-110' : 'text-gray-600 opacity-80'}`;
          const Icon = dir === Direction.PUSH ? ArrowRightIcon : ArrowLeftIcon;

          // 1. Find all notes belonging to this group (time slice)
          const groupNotes = visibleNotes.filter(n => Math.abs(n.time - group.time) < 0.05);

          // 2. Determine the target note for the arrow
          // We want the note with the lowest pitch (lowest MIDI) that is currently visible.
          // If no notes are visible, we fallback to the absolute lowest pitch (even if off-screen).
          
          let targetMidi = Infinity;
          let foundVisible = false;
          let absoluteMinMidi = Infinity;

          groupNotes.forEach(n => {
              const shiftedMidi = n.midi + (octaveShift * 12) + semitoneShift;
              const top = (MAX_MIDI - shiftedMidi) * noteHeight;
              
              // Track absolute lowest (fallback)
              if (shiftedMidi < absoluteMinMidi) {
                  absoluteMinMidi = shiftedMidi;
              }

              // Check visibility
              // A note is visible if its vertical range overlaps the viewport
              // Note range: [top, top + noteHeight]
              // Viewport range: [scrollTop, scrollTop + clientHeight]
              const isVisible = (top + noteHeight > scrollTop) && (top < scrollTop + clientHeight);

              if (isVisible) {
                  // Among visible notes, we want the one with the lowest MIDI (visually lowest)
                  if (shiftedMidi < targetMidi) {
                      targetMidi = shiftedMidi;
                      foundVisible = true;
                  }
              }
          });

          // If no note is visible, use the absolute lowest (standard behavior)
          // If we found a visible one, use that.
          const finalMidi = foundVisible ? targetMidi : absoluteMinMidi;

          // If we still have infinity (no notes found in group), skip
          if (finalMidi === Infinity) {
             // Fallback to group min if available (for cases where visibleNotes might be empty/virtualized out but group exists)
             if (group.bassMin !== null) items.push(renderArrow(group.bassMin, `arrow-bass-${group.time}`, arrowClass, Icon, group, dir));
             else if (group.trebleMin !== null) items.push(renderArrow(group.trebleMin, `arrow-treble-${group.time}`, arrowClass, Icon, group, dir));
             return <React.Fragment key={`group-${group.time}`}>{items}</React.Fragment>;
          }

          // Render the arrow at the calculated MIDI position
          items.push(renderArrow(finalMidi, `arrow-auto-${group.time}`, arrowClass, Icon, group, dir));

          function renderArrow(midi: number, key: string, cls: string, Ico: any, grp: any, d: Direction) {
              const shiftedMidi = midi + (octaveShift * 12) + semitoneShift;
              const top = (MAX_MIDI - shiftedMidi) * noteHeight + noteHeight;
              const left = grp.time * pxPerSec;
              return (
                  <div
                      key={key}
                      className={cls}
                      style={{ left: `${left}px`, top: `${top - 4}px` }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => onArrowClick(e, grp.time, d)}
                  >
                     <Ico className="w-[18px] h-[18px]" strokeWidth={3} />
                  </div>
              );
          }
          
          return <React.Fragment key={`group-${group.time}`}>{items}</React.Fragment>;
      })}
    </>
  );
};