import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MidiNote, DirectionEvent } from '../hooks/useMidiPlayer';
import { ChannelMode } from '../hooks/useMidiPlayer';
import { Direction } from '../types';
import { getButtonIdsForNote, getNoteKey } from '../helpers/midiMap';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
// Import the new helper
import { getCompactChordName } from '../helpers/musicTheory';

interface Props {
  notes: MidiNote[];
  currentTime: number;
  isPlaying: boolean;
  channelModes: Record<number, ChannelMode>;
  direction: Direction;
  onSeek: (time: number) => void;
  octaveShift: number;
  semitoneShift: number;
  directionEvents?: DirectionEvent[];
  onUpdateDirections?: (updates: { time: number, direction: Direction }[]) => void;
  activeMidiHighlights?: Set<string>;
  onNotePreview?: (midi: number, direction: Direction, start: boolean) => void;
  editingNote?: { midi: number, time: number, channel: number } | null;
  onSelectNote?: (note: MidiNote) => void;
  onClearSelection?: () => void;
  flashingNotes?: Set<string>;
  autoScrollMode?: 'treble' | 'bass' | 'off';
  isNoteSnapEnabled?: boolean;
}

// --- Hand-Drawn Note Component ---

const HandDrawnNote: React.FC<{
  width: number;
  height: number;
  label: string;
  hasMapping: boolean;
  isHighlighted: boolean;
  isEditing?: boolean;
  isFlashing?: boolean;
  mode: 'bass' | 'treble' | 'muted';
  wobbleId: string;
}> = ({ width, height, label, hasMapping, isHighlighted, isEditing, isFlashing, mode }) => {
  // Default: Muted (Grey)
  let border = '#9CA3AF'; // Gray 400
  let fill = '#E5E7EB';   // Gray 200
  let text = '#374151';   // Gray 700

  if (isFlashing) {
    border = '#EC4899'; // Pink 500
    fill = '#FBCFE8';   // Pink 200
    text = '#831843';   // Pink 900
  } else if (isEditing) {
    border = '#BE185D'; // Pink 700
    fill = '#F472B6';   // Pink 400
    text = '#FFFFFF';
  } else if (isHighlighted) {
    border = '#2563EB'; // Blue 600
    fill = '#3B82F6';   // Blue 500
    text = '#FFFFFF';
  } else if (mode === 'bass') {
    border = '#9333EA'; // Purple 600
    fill = '#D8B4FE';   // Purple 300
    text = '#581C87';   // Purple 900
  } else if (mode === 'treble') {
    border = '#16A34A'; // Green 600
    fill = '#86EFAC';   // Green 300
    text = '#14532D';   // Green 900
  }
  
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
      
      {!hasMapping && mode !== 'muted' && (
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
  direction,
  onSeek,
  octaveShift,
  semitoneShift,
  directionEvents = [],
  onUpdateDirections,
  activeMidiHighlights,
  onNotePreview,
  editingNote,
  onSelectNote,
  onClearSelection,
  flashingNotes,
  autoScrollMode,
  isNoteSnapEnabled
}) => {
  // Configuration
  const [pxPerSec, setPxPerSec] = useState(150);
  const [noteHeight, setNoteHeight] = useState(26);
  
  const MIN_MIDI = 0;
  const MAX_MIDI = 127;
  const TOTAL_HEIGHT = (MAX_MIDI - MIN_MIDI + 1) * noteHeight;

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
  const prevPinchRef = useRef<{ distX: number; distY: number } | null>(null);
  const onSeekRef = useRef(onSeek);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  // Wheel Zoom Listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setPxPerSec(p => Math.max(50, Math.min(1000, p * delta)));
      } else if (e.altKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setNoteHeight(h => Math.max(10, Math.min(60, h * delta)));
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // --- Data Processing ---

  const visibleNotes = useMemo(() => {
    return notes.filter(n => {
      const mode = channelModes[n.channel] || 'muted';
      return mode !== 'hidden';
    });
  }, [notes, channelModes]);

  // --- NEW: Chord Detection Logic ---
  const chordLabels = useMemo(() => {
    const labels: { time: number; text: string; top: number; left: number }[] = [];
    
    // 1. Filter for Treble notes only
    const trebleNotes = visibleNotes.filter(n => {
      const mode = channelModes[n.channel] || 'muted';
      return mode === 'treble'; // Only analyze treble channel
    });

    if (trebleNotes.length < 2) return [];

    // 2. Group notes by time (tolerance of 50ms)
    const groups: MidiNote[][] = [];
    let currentGroup: MidiNote[] = [];
    
    // Sort by time first
    const sorted = [...trebleNotes].sort((a, b) => a.time - b.time);

    sorted.forEach((note) => {
      if (currentGroup.length === 0) {
        currentGroup.push(note);
      } else {
        const firstInGroup = currentGroup[0];
        // If note starts within 50ms of the group start, add it
        if (Math.abs(note.time - firstInGroup.time) < 0.05) {
          currentGroup.push(note);
        } else {
          // Finalize previous group
          groups.push(currentGroup);
          currentGroup = [note];
        }
      }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    // 3. Analyze groups
    groups.forEach(group => {
      if (group.length < 2) return; // Ignore single notes

      // Apply shifts to get the actual heard pitch
      const shiftedMidis = group.map(n => n.midi + (octaveShift * 12) + semitoneShift);
      
      const name = getCompactChordName(shiftedMidis);
      
      if (name) {
        // Find highest note for positioning (Highest Pitch = Lowest Y value in Piano Roll)
        // Note: Piano roll Y is calculated as (MAX_MIDI - midi) * height.
        // So the highest pitch has the largest MIDI value, resulting in the smallest 'top' value.
        const maxMidi = Math.max(...group.map(n => n.midi + (octaveShift * 12) + semitoneShift));
        const top = (MAX_MIDI - maxMidi) * noteHeight;
        
        labels.push({
          time: group[0].time,
          text: name,
          top: top, // Position at the top of the highest note
          left: group[0].time // We'll multiply by pxPerSec in render
        });
      }
    });

    return labels;
  }, [visibleNotes, channelModes, octaveShift, semitoneShift, noteHeight, MAX_MIDI]);

  // Playback Auto-Scroll (Smooth Look-ahead)
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) return;
    if (autoScrollMode === 'off' || !autoScrollMode) return;

    const LOOK_AHEAD = 1.8; // Look 1.8 seconds ahead (more proactive)
    const PADDING = 50;     // Pixels from top
    const SMOOTHING = 0.08; // Faster catch-up (8% per frame)

    // Find notes in the look-ahead window [currentTime, currentTime + LOOK_AHEAD]
    const relevantNotes = visibleNotes.filter(n =>
      n.time < currentTime + LOOK_AHEAD &&
      (n.time + n.duration) > currentTime &&
      channelModes[n.channel] === autoScrollMode // 'treble' or 'bass' matches channel mode
    );

    if (relevantNotes.length === 0) return;

    // Find the highest pitch (Max MIDI) in this window
    let maxMidiInWindow = -Infinity;
    relevantNotes.forEach(n => {
      const shifted = n.midi + (octaveShift * 12) + semitoneShift;
      if (shifted > maxMidiInWindow) maxMidiInWindow = shifted;
    });

    if (maxMidiInWindow === -Infinity) return;

    // Calculate target scroll position
    // (MAX_MIDI - midi) * NOTE_HEIGHT is the top Y of the note row
    const targetTop = (MAX_MIDI - maxMidiInWindow) * noteHeight - PADDING;
    
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
  }, [currentTime, isPlaying, visibleNotes, octaveShift, semitoneShift, MAX_MIDI, noteHeight, autoScrollMode, channelModes]);

  const arrowGroups = useMemo(() => {
    // Structure: time -> { bassMin, trebleMin }
    const groups: { time: number, bassMin: number | null, trebleMin: number | null }[] = [];
    const sorted = [...visibleNotes].sort((a, b) => a.time - b.time);
    
    sorted.forEach(note => {
      const mode = channelModes[note.channel] || 'muted';
      if (mode === 'muted') return;

      const lastGroup = groups[groups.length - 1];
      const isBass = mode === 'bass';
      
      // Group with last if within tolerance
      if (lastGroup && Math.abs(note.time - lastGroup.time) < 0.02) {
        if (isBass) {
            lastGroup.bassMin = lastGroup.bassMin === null ? note.midi : Math.min(lastGroup.bassMin, note.midi);
        } else {
            lastGroup.trebleMin = lastGroup.trebleMin === null ? note.midi : Math.min(lastGroup.trebleMin, note.midi);
        }
      } else {
        // Create new group
        groups.push({
            time: note.time,
            bassMin: isBass ? note.midi : null,
            trebleMin: !isBass ? note.midi : null
        });
      }
    });
    return groups;
  }, [visibleNotes, channelModes]);

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
        if (onClearSelection) onClearSelection();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, time: currentTime };
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.stopPropagation();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      prevPinchRef.current = {
        distX: Math.abs(t1.clientX - t2.clientX),
        distY: Math.abs(t1.clientY - t2.clientY)
      };
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX, time: currentTime };
  };

  const handleTouchMovePinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && prevPinchRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const distX = Math.abs(t1.clientX - t2.clientX);
      const distY = Math.abs(t1.clientY - t2.clientY);
      
      const prev = prevPinchRef.current;
      
      if (prev.distX > 0) {
        const scaleX = distX / prev.distX;
        setPxPerSec(p => Math.max(50, Math.min(1000, p * scaleX)));
      }
      if (prev.distY > 0) {
        const scaleY = distY / prev.distY;
        setNoteHeight(h => Math.max(10, Math.min(60, h * scaleY)));
      }
      
      prevPinchRef.current = { distX, distY };
    }
  };

  const handleTouchEndPinch = () => {
    prevPinchRef.current = null;
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

  const handleNoteMouseDown = (e: React.MouseEvent, note: MidiNote, dir: Direction) => {
    e.stopPropagation();
    if (!isPlaying && onSelectNote) {
        onSelectNote(note);
    } else if (onNotePreview) {
        onNotePreview(note.midi, dir, true);
    }
  };

  const handleNoteMouseUp = (e: React.MouseEvent, midi: number, dir: Direction) => {
    e.stopPropagation();
    if (isPlaying && onNotePreview) onNotePreview(midi, dir, false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      e.preventDefault();
      const dx = e.clientX - dragStartRef.current.x;
      let newTime = dragStartRef.current.time - (dx / pxPerSec);

      if (isNoteSnapEnabled) {
          const SNAP_WINDOW = 0.15;
          let bestTime = newTime;
          let minDiff = SNAP_WINDOW;
          
          for (const note of visibleNotes) {
              if (note.time > newTime + SNAP_WINDOW) break;
              if (note.time < newTime - SNAP_WINDOW) continue;
              
              const diff = Math.abs(note.time - newTime);
              if (diff < minDiff) {
                  minDiff = diff;
                  bestTime = note.time;
              }
          }
          newTime = bestTime;
      }

      onSeekRef.current(newTime);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      let newTime = dragStartRef.current.time - (dx / pxPerSec);

      if (isNoteSnapEnabled) {
          const SNAP_WINDOW = 0.15;
          let bestTime = newTime;
          let minDiff = SNAP_WINDOW;
          
          for (const note of visibleNotes) {
              if (note.time > newTime + SNAP_WINDOW) break;
              if (note.time < newTime - SNAP_WINDOW) continue;
              
              const diff = Math.abs(note.time - newTime);
              if (diff < minDiff) {
                  minDiff = diff;
                  bestTime = note.time;
              }
          }
          newTime = bestTime;
      }

      onSeekRef.current(newTime);
    };

    const handleEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, pxPerSec, isNoteSnapEnabled, visibleNotes]);

  const rows = useMemo(() => {
    const r = [];
    for (let m = MAX_MIDI; m >= MIN_MIDI; m--) {
      r.push(m);
    }
    return r;
  }, [MAX_MIDI, MIN_MIDI]);

  // Auto-Scroll to Initial Notes (Vertical Centering)
  useEffect(() => {
    if (notes.length === 0 || !scrollContainerRef.current) return;
    
    // Filter visible notes
    const visible = notes.filter(n => {
       const mode = channelModes[n.channel] || 'muted';
       return mode !== 'muted' && mode !== 'hidden';
    });
    
    if (visible.length === 0) return;

    // Determine 'start' time of the song
    const startTime = visible[0].time;
    
    // Look at notes in the first 4 seconds window
    const initialNotes = visible.filter(n => n.time < startTime + 4.0);
    const targetNotes = initialNotes.length > 0 ? initialNotes : visible;

    let maxMidi = -Infinity;
    let minMidi = Infinity;
    
    targetNotes.forEach(n => {
      const shifted = n.midi + (octaveShift * 12) + semitoneShift;
      if (shifted > maxMidi) maxMidi = shifted;
      if (shifted < minMidi) minMidi = shifted;
    });

    if (maxMidi === -Infinity) return;

    // Calculate center pitch
    const centerMidi = (maxMidi + minMidi) / 2;
    
    // Calculate scroll position to center this pitch
    const containerHeight = scrollContainerRef.current.clientHeight;
    // Y position of centerMidi in pixels (from top)
    const centerPixel = (MAX_MIDI - centerMidi) * noteHeight;
    const targetScroll = centerPixel - (containerHeight / 2);
    
    scrollContainerRef.current.scrollTop = Math.max(0, targetScroll);
  }, [notes, octaveShift, semitoneShift, MAX_MIDI, noteHeight, channelModes]);

  // --- Data Processing ---

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
                 height: noteHeight,
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMovePinch}
          onTouchEnd={handleTouchEndPinch}
          onDoubleClick={() => setSelectedTimes(new Set())}
        >
           {/* Background Rows */}
           <div className="absolute inset-0 z-0 pointer-events-none">
             {rows.map(midi => (
               <div
                 key={`row-${midi}`}
                 className="w-full border-b border-gray-100/50"
                 style={{
                   height: noteHeight,
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
             style={{ transform: `translateX(-${currentTime * pxPerSec}px)` }}
           >
              {/* --- NEW: Render Chord Labels --- */}
              {chordLabels.map((label, idx) => (
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
                      height: `${noteHeight}px`,
                      zIndex: (isEditing || isFlashing) ? 50 : (mode === 'treble' || mode === 'bass' ? 20 : 10)
                    }}
                    onMouseDown={(e) => handleNoteMouseDown(e, note, noteDir)}
                    onMouseUp={(e) => handleNoteMouseUp(e, shiftedMidi, noteDir)}
                    onMouseLeave={(e) => handleNoteMouseUp(e, shiftedMidi, noteDir)}
                  >
                    <HandDrawnNote
                      width={width}
                      height={noteHeight}
                      label={label}
                      hasMapping={hasMapping}
                      isHighlighted={!!isHighlighted}
                      isEditing={!!isEditing}
                      isFlashing={!!isFlashing}
                      mode={mode as any}
                      wobbleId={`wobble${wobbleIdx}`}
                    />
                  </div>
                );
              })}

              {/* Arrows */}
              {arrowGroups.map((group) => {
                  const items = [];
                  const dir = getDirectionAtTime(group.time);
                  const isSelected = selectedTimes.has(group.time);
                  const arrowClass = `absolute flex items-center justify-center w-6 h-6 cursor-pointer transition-transform hover:scale-125 z-20 ${isSelected ? 'text-blue-600 drop-shadow-md scale-110' : 'text-gray-800'}`;
                  const Icon = dir === Direction.PUSH ? ArrowRightIcon : ArrowLeftIcon;

                  // Render Bass Arrow
                  if (group.bassMin !== null) {
                      const shiftedMidi = group.bassMin + (octaveShift * 12) + semitoneShift;
                      const top = (MAX_MIDI - shiftedMidi) * noteHeight + noteHeight;
                      const left = group.time * pxPerSec;
                      items.push(
                          <div
                              key={`arrow-bass-${group.time}`}
                              className={arrowClass}
                              style={{ left: `${left}px`, top: `${top - 4}px` }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => handleArrowClick(e, group.time, dir)}
                          >
                             <Icon className="w-[18px] h-[18px]" strokeWidth={3} />
                          </div>
                      );
                  }

                  // Render Treble Arrow
                  if (group.trebleMin !== null) {
                      const shiftedMidi = group.trebleMin + (octaveShift * 12) + semitoneShift;
                      const top = (MAX_MIDI - shiftedMidi) * noteHeight + noteHeight;
                      const left = group.time * pxPerSec;
                      items.push(
                          <div
                              key={`arrow-treble-${group.time}`}
                              className={arrowClass}
                              style={{ left: `${left}px`, top: `${top - 4}px` }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => handleArrowClick(e, group.time, dir)}
                          >
                             <Icon className="w-[18px] h-[18px]" strokeWidth={3} />
                          </div>
                      );
                  }
                  
                  return <React.Fragment key={`group-${group.time}`}>{items}</React.Fragment>;
              })}
           </div>
        </div>
      </div>
    </div>
  );
};