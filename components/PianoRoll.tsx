// file: components/PianoRoll.tsx
import React, { useMemo, useRef, useEffect, useLayoutEffect } from 'react';
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
  focusMode?: 'treble' | 'bass' | 'chord' | 'off';
}

export const PianoRoll: React.FC<Props> = ({
  notes, currentTime, isPlaying, channelModes, direction, onSeek, octaveShift, semitoneShift,
  directionEvents = [], onUpdateDirections, activeMidiHighlights, onNotePreview, editingNote,
  onSelectNote, onClearSelection, flashingNotes, autoScrollMode, isNoteSnapEnabled, focusMode = 'off'
}) => {
  
  const {
    pxPerSec, setPxPerSec, noteHeight, setNoteHeight, isDragging, setIsDragging,
    selectedTimes, setSelectedTimes, scrollContainerRef, dragStartRef, prevPinchRef, pinchAxisRef,
    visibleNotes, chordLabels, arrowGroups, MIN_MIDI, MAX_MIDI, TOTAL_HEIGHT,
    debugInfo, setDebugInfo
  } = usePianoRollController({
    notes, currentTime, isPlaying, channelModes, octaveShift, semitoneShift, directionEvents, autoScrollMode, isNoteSnapEnabled, onSeek
  });

  const gestureRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(currentTime);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  const noteHeightRef = useRef(noteHeight);
  const pxPerSecRef = useRef(pxPerSec);
  useLayoutEffect(() => { noteHeightRef.current = noteHeight; }, [noteHeight]);
  useLayoutEffect(() => { pxPerSecRef.current = pxPerSec; }, [pxPerSec]);

  const zoomAnchorRef = useRef<{ midi: number, focalY: number } | null>(null);
  const pinchStartRef = useRef<{
    distX: number; distY: number;
    h: number; px: number;
    anchorMidi: number; anchorTime: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (zoomAnchorRef.current && scrollContainerRef.current) {
      const { midi, focalY } = zoomAnchorRef.current;
      const noteTop = (MAX_MIDI - midi) * noteHeight;
      console.error(`[STEIRISCHE] LayoutEffect Scroll: noteHeight=${noteHeight}, midi=${midi.toFixed(2)}, targetTop=${noteTop.toFixed(1)}, scrollTop=${(noteTop - focalY).toFixed(1)}`);
      scrollContainerRef.current.scrollTop = noteTop - focalY;
    }
  }, [noteHeight, MAX_MIDI]);

  // Add a mount log to verify logging works immediately
  useEffect(() => {
      console.error("[STEIRISCHE] PianoRoll Controller Mounted - Ready for input");
  }, []);

  useEffect(() => {
    const el = gestureRef.current;
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation();
        setIsDragging(false);
        dragStartRef.current = null;
        pinchAxisRef.current = null;
        
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const rect = container.getBoundingClientRect();
        
        // Initial Distances
        const distX = Math.abs(t1.clientX - t2.clientX);
        const distY = Math.abs(t1.clientY - t2.clientY);
        
        // Initial Anchors
        const focalX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const focalY = (t1.clientY + t2.clientY) / 2 - rect.top;
        
        // Calculate Anchor Points based on CURRENT state
        const absoluteY = container.scrollTop + focalY;
        const anchorMidi = MAX_MIDI - (absoluteY / noteHeightRef.current);
        
        const playheadX = rect.width * 0.2;
        const distFromPlayhead = focalX - playheadX;
        const anchorTime = currentTimeRef.current + (distFromPlayhead / pxPerSecRef.current);

        pinchStartRef.current = {
          distX, distY,
          h: noteHeightRef.current,
          px: pxPerSecRef.current,
          anchorMidi, anchorTime
        };
        console.error(`[STEIRISCHE] Pinch Start: distY=${distY.toFixed(1)}, h=${noteHeightRef.current}, anchorMidi=${anchorMidi.toFixed(2)}`);
        
        // Keep prevPinchRef for delta checks (locking)
        prevPinchRef.current = { distX, distY };

      } else if (e.touches.length === 1) {
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: currentTimeRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartRef.current) {
        e.preventDefault();
        e.stopPropagation();
        
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const distX = Math.abs(t1.clientX - t2.clientX);
        const distY = Math.abs(t1.clientY - t2.clientY);
        const start = pinchStartRef.current;

        // Axis Locking
        if (!pinchAxisRef.current) {
          const dX = Math.abs(distX - start.distX);
          const dY = Math.abs(distY - start.distY);
          if (dX > 10 || dY > 10) {
            pinchAxisRef.current = dX > dY ? 'x' : 'y';
            
            // Reset start values to prevent jump when threshold is crossed
            const rect = container.getBoundingClientRect();
            const focalX = (t1.clientX + t2.clientX) / 2 - rect.left;
            const focalY = (t1.clientY + t2.clientY) / 2 - rect.top;
            
            const absoluteY = container.scrollTop + focalY;
            const anchorMidi = MAX_MIDI - (absoluteY / noteHeightRef.current);
            
            const playheadX = rect.width * 0.2;
            const distFromPlayhead = focalX - playheadX;
            const anchorTime = currentTimeRef.current + (distFromPlayhead / pxPerSecRef.current);

            pinchStartRef.current = {
              distX, distY,
              h: noteHeightRef.current,
              px: pxPerSecRef.current,
              anchorMidi, anchorTime
            };
            console.error(`[STEIRISCHE] Axis Locked (${pinchAxisRef.current}). Re-based start values to prevent jump.`);
            return;
          } else {
            return;
          }
        }

        const rect = container.getBoundingClientRect();

        if (pinchAxisRef.current === 'x') {
          if (start.distX > 10) {
            const scale = distX / start.distX;
            const newVal = Math.max(50, Math.min(1000, start.px * scale));
            
            const focalX = (t1.clientX + t2.clientX) / 2 - rect.left;
            const playheadX = rect.width * 0.2;
            const distFromPlayhead = focalX - playheadX;
            const newCurrentTime = start.anchorTime - (distFromPlayhead / newVal);
            
            setPxPerSec(newVal);
            pxPerSecRef.current = newVal;
            
            if (Math.abs(newCurrentTime - currentTimeRef.current) > 0.001) {
                onSeek(Math.max(0, newCurrentTime));
                currentTimeRef.current = Math.max(0, newCurrentTime);
            }
          }
        } else {
          if (start.distY > 10) {
            const scale = distY / start.distY;
            const rawVal = start.h * scale;
            const newVal = Math.max(10, Math.min(60, rawVal));
            
            const focalY = (t1.clientY + t2.clientY) / 2 - rect.top;
            
            // Store anchor for useLayoutEffect (handles the scale change)
            zoomAnchorRef.current = { midi: start.anchorMidi, focalY };
            
            // Only manually set scrollTop if height is NOT changing (clamped).
            // If height IS changing, useLayoutEffect will handle the scroll sync to avoid jitter.
            if (Math.abs(newVal - noteHeightRef.current) < 0.001) {
                const currentH = noteHeightRef.current;
                const noteTop = (MAX_MIDI - start.anchorMidi) * currentH;
                container.scrollTop = noteTop - focalY;
            }

            setNoteHeight(newVal);
            
            const msg = `[STEIRISCHE] Y-Zoom: ${newVal.toFixed(1)}px (Raw: ${rawVal.toFixed(1)}), DistY: ${distY.toFixed(1)}/${start.distY.toFixed(1)}, Scale: ${scale.toFixed(3)}, FocalY: ${focalY.toFixed(0)}`;
            setDebugInfo(msg);
            console.error(msg);
          } else {
             console.error(`[STEIRISCHE] Y-Zoom Skipped: start.distY too small (${start.distY})`);
          }
        }
      }
    };

    const onTouchEnd = () => {
      if (pinchStartRef.current) console.error("[STEIRISCHE] Pinch End");
      pinchStartRef.current = null;
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
        dragStartRef.current = { x: e.clientX, y: e.clientY, time: currentTime };
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
                focusMode={focusMode}
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
