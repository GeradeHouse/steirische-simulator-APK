// file: components/PianoRoll.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import { MidiNote, DirectionEvent, ChannelMode } from '../hooks/midi/types';
import { Direction } from '../types';
import { PianoKeys, PianoGrid, ChordLabels, ArrowLayer } from './piano/PianoRollVisuals';
import { PianoRollNotes } from './piano/PianoRollNotes';
import { usePianoRollController } from '../hooks/usePianoRollController';

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
  autoScrollMode?: 'treble' | 'bass' | 'chord' | 'off';
  isNoteSnapEnabled?: boolean;
}

export const PianoRoll: React.FC<Props> = ({
  notes, currentTime, isPlaying, channelModes, direction, onSeek, octaveShift, semitoneShift,
  directionEvents = [], onUpdateDirections, activeMidiHighlights, onNotePreview, editingNote,
  onSelectNote, onClearSelection, flashingNotes, autoScrollMode, isNoteSnapEnabled
}) => {
  
  const {
    pxPerSec, setPxPerSec, noteHeight, setNoteHeight, isDragging, setIsDragging,
    selectedTimes, setSelectedTimes, scrollContainerRef, dragStartRef, prevPinchRef, pinchAxisRef,
    visibleNotes, chordLabels, arrowGroups, MIN_MIDI, MAX_MIDI, TOTAL_HEIGHT
  } = usePianoRollController({
    notes, currentTime, isPlaying, channelModes, octaveShift, semitoneShift, directionEvents, autoScrollMode, isNoteSnapEnabled, onSeek
  });

  const gestureRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(currentTime);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  useEffect(() => {
    const el = gestureRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation();
        setIsDragging(false);
        dragStartRef.current = null;
        pinchAxisRef.current = null;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        prevPinchRef.current = { distX: Math.abs(t1.clientX - t2.clientX), distY: Math.abs(t1.clientY - t2.clientY) };
      } else if (e.touches.length === 1) {
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.touches[0].clientX, time: currentTimeRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && prevPinchRef.current) {
        e.preventDefault();
        e.stopPropagation();
        
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const distX = Math.abs(t1.clientX - t2.clientX);
        const distY = Math.abs(t1.clientY - t2.clientY);
        const prev = prevPinchRef.current;

        if (!pinchAxisRef.current) {
          const dX = Math.abs(distX - prev.distX);
          const dY = Math.abs(distY - prev.distY);
          if (dX > 10 || dY > 10) {
            pinchAxisRef.current = dX > dY ? 'x' : 'y';
          } else {
            return;
          }
        }

        if (pinchAxisRef.current === 'x') {
          if (prev.distX > 0) setPxPerSec(p => Math.max(50, Math.min(1000, p * (distX / prev.distX))));
        } else {
          if (prev.distY > 0) setNoteHeight(h => Math.max(10, Math.min(60, h * (distY / prev.distY))));
        }
        
        prevPinchRef.current = { distX, distY };
      }
    };

    const onTouchEnd = () => {
      prevPinchRef.current = null;
      pinchAxisRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [setPxPerSec, setNoteHeight, setIsDragging]);

  // Virtualization: Only render items within a safe viewport window
  // Assuming max screen width corresponds to roughly 10-15 seconds at typical zoom
  const windowStart = currentTime - 2;
  const windowEnd = currentTime + 15;

  const renderedNotes = useMemo(() =>
    visibleNotes.filter(n => (n.time + n.duration) > windowStart && n.time < windowEnd),
  [visibleNotes, windowStart, windowEnd]);

  const renderedChords = useMemo(() =>
    chordLabels.filter(l => l.time > windowStart && l.time < windowEnd),
  [chordLabels, windowStart, windowEnd]);

  const renderedArrows = useMemo(() =>
    arrowGroups.filter(g => g.time > windowStart && g.time < windowEnd),
  [arrowGroups, windowStart, windowEnd]);

  const rows = useMemo(() => {
    const r = [];
    for (let m = MAX_MIDI; m >= MIN_MIDI; m--) r.push(m);
    return r;
  }, [MAX_MIDI, MIN_MIDI]);

  const getNoteLabel = (midi: number) => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    return `${notes[midi % 12]}${octave}`;
  };

  const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

  const getDirectionAtTime = (time: number) => {
    let dir = Direction.PUSH;
    for (const event of directionEvents) {
      if (event.time <= time + 0.001) dir = event.direction;
      else break;
    }
    return dir;
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
    const selectedDirs = new Map<number, Direction>();
    newSelected.forEach(t => selectedDirs.set(t, getDirectionAtTime(t)));

    for (const d of selectedDirs.values()) {
        if (firstDir === null) firstDir = d;
        else if (firstDir !== d) { allSame = false; break; }
    }

    const targetDir = !allSame ? currentDir : (firstDir === Direction.PUSH ? Direction.PULL : Direction.PUSH);
    const updates: { time: number, direction: Direction }[] = [];
    newSelected.forEach(t => updates.push({ time: t, direction: targetDir }));
    onUpdateDirections(updates);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.button === 0) {
        if (onClearSelection) onClearSelection();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, time: currentTime };
    }
  };

  return (
    <div ref={scrollContainerRef} className="w-full h-full overflow-y-auto overflow-x-hidden bg-white border-2 border-gray-300 rounded-lg shadow-inner select-none relative">
      <div className="relative" style={{ height: TOTAL_HEIGHT }}>
        <PianoKeys rows={rows} noteHeight={noteHeight} getNoteLabel={getNoteLabel} isBlackKey={isBlackKey} />
        
        <div
          ref={gestureRef}
          className={`absolute top-0 bottom-0 left-12 right-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setSelectedTimes(new Set())}
        >
           <PianoGrid rows={rows} noteHeight={noteHeight} isBlackKey={isBlackKey} />
           <div className="absolute left-[20%] top-0 bottom-0 w-0.5 bg-red-400/60 z-30 pointer-events-none shadow-[0_0_4px_rgba(248,113,113,0.5)]"></div>

           <div className="absolute top-0 bottom-0 left-[20%] will-change-transform z-10" style={{ transform: `translateX(-${currentTime * pxPerSec}px)` }}>
              <ChordLabels labels={renderedChords} pxPerSec={pxPerSec} />
              <PianoRollNotes
                visibleNotes={renderedNotes}
                pxPerSec={pxPerSec}
                noteHeight={noteHeight}
                octaveShift={octaveShift}
                semitoneShift={semitoneShift}
                MAX_MIDI={MAX_MIDI}
                currentTime={currentTime}
                channelModes={channelModes}
                activeMidiHighlights={activeMidiHighlights}
                editingNote={editingNote}
                flashingNotes={flashingNotes}
                getDirectionAtTime={getDirectionAtTime}
                getNoteLabel={getNoteLabel}
                onNoteMouseDown={(e, note, dir) => {
                    e.stopPropagation();
                    if (!isPlaying && onSelectNote) onSelectNote(note);
                    else if (onNotePreview) onNotePreview(note.midi, dir, true);
                }}
                onNoteMouseUp={(e, midi, dir) => {
                    e.stopPropagation();
                    if (isPlaying && onNotePreview) onNotePreview(midi, dir, false);
                }}
              />
              <ArrowLayer
                groups={renderedArrows}
                pxPerSec={pxPerSec}
                noteHeight={noteHeight}
                octaveShift={octaveShift}
                semitoneShift={semitoneShift}
                MAX_MIDI={MAX_MIDI}
                selectedTimes={selectedTimes}
                getDirectionAtTime={getDirectionAtTime}
                onArrowClick={handleArrowClick}
              />
           </div>
        </div>
      </div>
    </div>
  );
};
