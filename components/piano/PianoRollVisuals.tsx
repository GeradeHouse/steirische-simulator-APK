import React from 'react';
import { ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Direction } from '../../types';

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
  groups: any[], 
  pxPerSec: number, 
  noteHeight: number, 
  octaveShift: number, 
  semitoneShift: number, 
  MAX_MIDI: number, 
  selectedTimes: Set<number>, 
  getDirectionAtTime: (t: number) => Direction, 
  onArrowClick: (e: React.MouseEvent, t: number, d: Direction) => void 
}> = ({ groups, pxPerSec, noteHeight, octaveShift, semitoneShift, MAX_MIDI, selectedTimes, getDirectionAtTime, onArrowClick }) => (
  <>
    {groups.map((group) => {
        const items = [];
        const dir = getDirectionAtTime(group.time);
        const isSelected = selectedTimes.has(group.time);
        const arrowClass = `absolute flex items-center justify-center w-6 h-6 cursor-pointer transition-transform hover:scale-125 z-20 ${isSelected ? 'text-blue-600 drop-shadow-md scale-110' : 'text-gray-600 opacity-80'}`;
        const Icon = dir === Direction.PUSH ? ArrowRightIcon : ArrowLeftIcon;

        const renderArrow = (midi: number, key: string) => {
            const shiftedMidi = midi + (octaveShift * 12) + semitoneShift;
            const top = (MAX_MIDI - shiftedMidi) * noteHeight + noteHeight;
            const left = group.time * pxPerSec;
            return (
                <div
                    key={key}
                    className={arrowClass}
                    style={{ left: `${left}px`, top: `${top - 4}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => onArrowClick(e, group.time, dir)}
                >
                   <Icon className="w-[18px] h-[18px]" strokeWidth={3} />
                </div>
            );
        };

        if (group.bassMin !== null) items.push(renderArrow(group.bassMin, `arrow-bass-${group.time}`));
        if (group.trebleMin !== null) items.push(renderArrow(group.trebleMin, `arrow-treble-${group.time}`));
        
        return <React.Fragment key={`group-${group.time}`}>{items}</React.Fragment>;
    })}
  </>
);
