import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MidiNote, DirectionEvent } from '../hooks/useMidiPlayer';
import { ChannelMode } from '../hooks/useMidiPlayer';
import { Direction } from '../types';
import { getButtonIdsForNote } from '../helpers/midiMap';
import { ArrowRightIcon, ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface Props {
  notes: MidiNote[];
  currentTime: number;
  isPlaying: boolean;
  channelModes: Record<number, ChannelMode>;
  direction: Direction;
  onSeek: (time: number) => void;
  octaveShift: number;
  directionEvents?: DirectionEvent[];
  onUpdateDirections?: (updates: { time: number, direction: Direction }[]) => void;
  activeMidiHighlights?: Set<string>;
  onNotePreview?: (midi: number, direction: Direction, start: boolean) => void;
}

// --- Hand-Drawn Note Component ---

const HandDrawnNote: React.FC<{
  width: number;
  height: number;
  label: string;
  hasMapping: boolean;
  isHighlighted: boolean;
  wobbleId: string;
}> = ({ width, height, label, hasMapping, isHighlighted }) => {
  // Simplified Colors for performance
  const border = isHighlighted ? '#2563EB' : (hasMapping ? '#876134' : '#EF4444');
  const fill = isHighlighted ? '#3B82F6' : (hasMapping ? '#D39B51' : '#FECACA');
  const text = isHighlighted ? '#FFFFFF' : (hasMapping ? '#F2E9C3' : '#7F1D1D');
  
  const pad = 2;
  const w = Math.max(0, width - pad * 2);
  const h = Math.max(0, height - pad * 2);

  return (
    <div className="w-full h-full relative">
      <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
        <rect
          x={pad} y={pad} width={w} height={h} rx="4"
          fill={fill}
          stroke={border}
          strokeWidth="2"
        />
        <text
          x="50%" y="50%" dy=".35em"
          textAnchor="middle"
          fill={text}
          fontSize="11px"
          fontWeight="bold"
          style={{ pointerEvents: 'none', fontFamily: 'sans-serif' }}
        >
          {label}
        </text>
      </svg>

      {!hasMapping && (
        <div className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-sm z-10">
          <ExclamationTriangleIcon className="w-3 h-3 text-red-600" />
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

const getNoteLabel = (midi: number) => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
};

const isBlackKey = (midi: number) => {
  const n = midi % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
};

export const PianoRoll: React.FC<Props> = ({
  notes,
  currentTime,
  isPlaying,
  channelModes,
  onSeek,
  octaveShift,
  directionEvents = [],
  onUpdateDirections,
  activeMidiHighlights,
  onNotePreview
}) => {
  // Configuration
  const PX_PER_SEC = 150;
  const NOTE_HEIGHT = 26; 
  const MIN_MIDI = 0;
  const MAX_MIDI = 127;
  const TOTAL_HEIGHT = (MAX_MIDI - MIN_MIDI + 1) * NOTE_HEIGHT;

  // Colors
  const ROW_BLACK = '#F0EEE8';
  const ROW_WHITE = '#FBFBF9';
  const KEY_BLACK = '#E5E7EB'; 
  const KEY_WHITE = '#FFFFFF';

  // State
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<Set<number>>(new Set());
  
  // Refs
  const dragStartRef = useRef<{ x: number; time: number } | null>(null);
  const onSeekRef = useRef(onSeek);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  // Auto-Scroll to Highest Note on Load
  useEffect(() => {
    if (notes.length === 0 || !scrollContainerRef.current) return;
    
    let maxMidi = 0;
    notes.forEach(n => {
      if (n.midi > maxMidi) maxMidi = n.midi;
    });
    
    // Calculate position of the highest note (using octaveShift * 12)
    const shiftedMax = maxMidi + (octaveShift * 12);
    const targetTop = (MAX_MIDI - shiftedMax) * NOTE_HEIGHT;
    
    // Scroll so the highest note is near the top (with 40px padding)
    scrollContainerRef.current.scrollTop = Math.max(0, targetTop - 40);
  }, [notes, octaveShift, MAX_MIDI, NOTE_HEIGHT]);

  // --- Data Processing ---

  const visibleNotes = useMemo(() => {
    return notes.filter(note => {
      const mode = channelModes[note.channel] || 'muted';
      return mode !== 'muted';
    });
  }, [notes, channelModes]);

  // Playback Auto-Scroll (Smooth Look-ahead)
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) return;

    const LOOK_AHEAD = 1.8; // Look 1.8 seconds ahead (more proactive)
    const PADDING = 50;     // Pixels from top
    const SMOOTHING = 0.08; // Faster catch-up (8% per frame)

    // Find notes in the look-ahead window [currentTime, currentTime + LOOK_AHEAD]
    const relevantNotes = visibleNotes.filter(n =>
      n.time < currentTime + LOOK_AHEAD && (n.time + n.duration) > currentTime
    );

    if (relevantNotes.length === 0) return;

    // Find the highest pitch (Max MIDI) in this window
    let maxMidiInWindow = -Infinity;
    relevantNotes.forEach(n => {
      const shifted = n.midi + (octaveShift * 12);
      if (shifted > maxMidiInWindow) maxMidiInWindow = shifted;
    });

    if (maxMidiInWindow === -Infinity) return;

    // Calculate target scroll position
    // (MAX_MIDI - midi) * NOTE_HEIGHT is the top Y of the note row
    const targetTop = (MAX_MIDI - maxMidiInWindow) * NOTE_HEIGHT - PADDING;
    
    // Clamp target to valid scroll range
    const container = scrollContainerRef.current;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const clampedTarget = Math.max(0, Math.min(targetTop, maxScroll));

    const currentScroll = container.scrollTop;
    
    // Smooth Interpolation (Lerp)
    const diff = clampedTarget - currentScroll;
    
    // Only scroll if difference is noticeable to avoid micro-jitter
    if (Math.abs(diff) > 1.0) {
       container.scrollTop = currentScroll + (diff * SMOOTHING);
    }
  }, [currentTime, isPlaying, visibleNotes, octaveShift, MAX_MIDI, NOTE_HEIGHT]);

  const arrowGroups = useMemo(() => {
    const groups: { time: number, lowestMidi: number, notes: MidiNote[] }[] = [];
    const sorted = [...visibleNotes].sort((a, b) => a.time - b.time);
    
    sorted.forEach(note => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && Math.abs(note.time - lastGroup.time) < 0.02) {
        lastGroup.notes.push(note);
        lastGroup.lowestMidi = Math.min(lastGroup.lowestMidi, note.midi);
      } else {
        groups.push({ time: note.time, lowestMidi: note.midi, notes: [note] });
      }
    });
    return groups;
  }, [visibleNotes]);

  const getDirectionAtTime = (time: number) => {
    let dir = Direction.PUSH;
    for (const event of directionEvents) {
      if (event.time <= time + 0.001) {
        dir = event.direction;
      } else {
        break;
      }
    }
    return dir;
  };

  // --- Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 0) {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, time: currentTime };
    }
  };

  const handleArrowClick = (e: React.MouseEvent, time: number, currentDir: Direction) => {
      e.stopPropagation();
      if (!onUpdateDirections) return;
      
      const newSelected = new Set<number>(selectedTimes);
      if (!newSelected.has(time)) {
          newSelected.clear();
          newSelected.add(time);
          setSelectedTimes(newSelected);
      }

      let allSame = true;
      let firstDir: Direction | null = null;
      const updates: { time: number, direction: Direction }[] = [];
      
      const selectedDirs = new Map<number, Direction>();
      newSelected.forEach(t => {
          selectedDirs.set(t, getDirectionAtTime(t));
      });

      for (const d of selectedDirs.values()) {
          if (firstDir === null) firstDir = d;
          else if (firstDir !== d) {
              allSame = false;
              break;
          }
      }

      let targetDir: Direction;
      if (!allSame) {
          targetDir = currentDir; 
      } else {
          targetDir = firstDir === Direction.PUSH ? Direction.PULL : Direction.PUSH;
      }

      newSelected.forEach(t => {
          updates.push({ time: t, direction: targetDir });
      });

      onUpdateDirections(updates);
  };

  const handleNoteMouseDown = (e: React.MouseEvent, midi: number, dir: Direction) => {
    e.stopPropagation(); 
    if (onNotePreview) onNotePreview(midi, dir, true);
  };

  const handleNoteMouseUp = (e: React.MouseEvent, midi: number, dir: Direction) => {
    e.stopPropagation();
    if (onNotePreview) onNotePreview(midi, dir, false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const newTime = dragStartRef.current.time - (dx / PX_PER_SEC);
      onSeekRef.current(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, PX_PER_SEC]); 

  const rows = useMemo(() => {
    const r = [];
    for (let m = MAX_MIDI; m >= MIN_MIDI; m--) {
      r.push(m);
    }
    return r;
  }, [MAX_MIDI, MIN_MIDI]);

  return (
    <div 
      ref={scrollContainerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden bg-white border-2 border-gray-300 rounded-lg shadow-inner select-none relative"
    >

      <div className="relative" style={{ height: TOTAL_HEIGHT }}>
        
        {/* 1. Left Sidebar (Keys) */}
        <div className="absolute left-0 top-0 bottom-0 w-12 z-20 border-r border-gray-300 shadow-md bg-gray-50">
           {rows.map(midi => (
             <div 
               key={`key-${midi}`}
               className="flex items-center justify-center text-[10px] font-bold text-gray-600 border-b border-gray-200"
               style={{ 
                 height: NOTE_HEIGHT, 
                 backgroundColor: isBlackKey(midi) ? KEY_BLACK : KEY_WHITE,
                 fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif'
               }}
             >
               {getNoteLabel(midi)}
             </div>
           ))}
        </div>

        {/* 2. Main Content Area */}
        <div 
          ref={contentRef}
          className={`absolute top-0 bottom-0 left-12 right-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setSelectedTimes(new Set())}
        >
           {/* Background Rows */}
           <div className="absolute inset-0 z-0 pointer-events-none">
             {rows.map(midi => (
               <div 
                 key={`row-${midi}`}
                 className="w-full border-b border-gray-100/50"
                 style={{ 
                   height: NOTE_HEIGHT, 
                   backgroundColor: isBlackKey(midi) ? ROW_BLACK : ROW_WHITE 
                 }}
               />
             ))}
           </div>

           {/* Playhead */}
           <div className="absolute left-[20%] top-0 bottom-0 w-0.5 bg-red-400/60 z-30 pointer-events-none shadow-[0_0_4px_rgba(248,113,113,0.5)]"></div>

           {/* Notes Container */}
           <div 
             className="absolute top-0 bottom-0 left-[20%] will-change-transform z-10"
             style={{ transform: `translateX(-${currentTime * PX_PER_SEC}px)` }}
           >
              {visibleNotes.map((note, idx) => {
                const left = note.time * PX_PER_SEC;
                const width = Math.max(note.duration * PX_PER_SEC, 10);
                const shiftedMidi = note.midi + (octaveShift * 12);
                const top = (MAX_MIDI - shiftedMidi) * NOTE_HEIGHT; 
                const label = getNoteLabel(shiftedMidi);
                
                const noteDir = getDirectionAtTime(note.time);
                const hasMapping = getButtonIdsForNote(shiftedMidi, noteDir).length > 0;
                const highlightKey = `${shiftedMidi}-${noteDir}`;
                const isUnderPlayhead = currentTime >= note.time && currentTime < (note.time + note.duration);
                const isHighlighted = activeMidiHighlights?.has(highlightKey) && isUnderPlayhead;

                // Deterministic random wobble
                const wobbleIdx = (note.midi + Math.floor(note.time)) % 3 + 1;

                return (
                  <div
                    key={`${note.midi}-${note.time}-${idx}`}
                    className="absolute transition-transform hover:scale-[1.02]"
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${NOTE_HEIGHT}px`,
                    }}
                    onMouseDown={(e) => handleNoteMouseDown(e, shiftedMidi, noteDir)}
                    onMouseUp={(e) => handleNoteMouseUp(e, shiftedMidi, noteDir)}
                    onMouseLeave={(e) => handleNoteMouseUp(e, shiftedMidi, noteDir)}
                  >
                    <HandDrawnNote 
                      width={width} 
                      height={NOTE_HEIGHT} 
                      label={label} 
                      hasMapping={hasMapping}
                      isHighlighted={!!isHighlighted}
                      wobbleId={`wobble${wobbleIdx}`}
                    />
                  </div>
                );
              })}

              {/* Arrows */}
              {arrowGroups.map((group) => {
                  const left = group.time * PX_PER_SEC;
                  const shiftedMidi = group.lowestMidi + (octaveShift * 12);
                  const top = (MAX_MIDI - shiftedMidi) * NOTE_HEIGHT + NOTE_HEIGHT; 
                  const dir = getDirectionAtTime(group.time);
                  const isSelected = selectedTimes.has(group.time);
                  
                  return (
                      <div
                          key={`arrow-${group.time}`}
                          className={`absolute flex items-center justify-center w-6 h-6 cursor-pointer transition-transform hover:scale-125 z-20 ${isSelected ? 'text-blue-600 drop-shadow-md scale-110' : 'text-gray-500 opacity-60'}`}
                          style={{
                              left: `${left}px`,
                              top: `${top - 4}px`,
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleArrowClick(e, group.time, dir)}
                      >
                          {dir === Direction.PUSH ? (
                              <ArrowRightIcon className="w-4 h-4" />
                          ) : (
                              <ArrowLeftIcon className="w-4 h-4" />
                          )}
                      </div>
                  );
              })}
           </div>
        </div>
      </div>
    </div>
  );
};