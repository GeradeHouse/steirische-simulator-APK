import { useState, useRef, useEffect, useMemo } from 'react';
import { MidiNote, ChannelMode, DirectionEvent } from './midi/types';
import { Direction } from '../types';
import { getCompactChordName } from '../helpers/musicTheory';

interface Props {
  notes: MidiNote[];
  currentTime: number;
  isPlaying: boolean;
  channelModes: Record<number, ChannelMode>;
  octaveShift: number;
  semitoneShift: number;
  directionEvents: DirectionEvent[];
  autoScrollMode?: 'treble' | 'bass' | 'chord' | 'off';
  isNoteSnapEnabled?: boolean;
  onSeek: (time: number) => void;
}

export const usePianoRollController = ({
  notes, currentTime, isPlaying, channelModes, octaveShift, semitoneShift, directionEvents, autoScrollMode, isNoteSnapEnabled, onSeek
}: Props) => {
  const [pxPerSec, setPxPerSec] = useState(150);
  const [noteHeight, setNoteHeight] = useState(26);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<Set<number>>(new Set());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; time: number } | null>(null);
  const prevPinchRef = useRef<{ distX: number; distY: number } | null>(null);
  const pinchAxisRef = useRef<'x' | 'y' | null>(null);
  const onSeekRef = useRef(onSeek);

  const MIN_MIDI = 0;
  const MAX_MIDI = 127;
  const TOTAL_HEIGHT = (MAX_MIDI - MIN_MIDI + 1) * noteHeight;

  useEffect(() => { onSeekRef.current = onSeek; }, [onSeek]);

  // Wheel Zoom
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

  const visibleNotes = useMemo(() => notes.filter(n => (channelModes[n.channel] || 'muted') !== 'hidden'), [notes, channelModes]);

  const chordLabels = useMemo(() => {
    const getLabels = (subset: MidiNote[]) => {
        if (subset.length < 2) return [];
        const result: { time: number; text: string; top: number; left: number }[] = [];
        const groups: MidiNote[][] = [];
        let currentGroup: MidiNote[] = [];
        const sorted = [...subset].sort((a, b) => a.time - b.time);

        sorted.forEach((note) => {
            if (currentGroup.length === 0) currentGroup.push(note);
            else {
                if (Math.abs(note.time - currentGroup[0].time) < 0.05) currentGroup.push(note);
                else { groups.push(currentGroup); currentGroup = [note]; }
            }
        });
        if (currentGroup.length > 0) groups.push(currentGroup);

        groups.forEach(group => {
            if (group.length < 2) return;
            const shiftedMidis = group.map(n => n.midi + (octaveShift * 12) + semitoneShift);
            const name = getCompactChordName(shiftedMidis);
            if (name) {
                const maxMidi = Math.max(...shiftedMidis);
                const top = (MAX_MIDI - maxMidi) * noteHeight;
                result.push({ time: group[0].time, text: name, top: top, left: group[0].time });
            }
        });
        return result;
    };
    const trebleNotes = visibleNotes.filter(n => (channelModes[n.channel] || 'muted') === 'treble');
    const chordNotes = visibleNotes.filter(n => (channelModes[n.channel] || 'muted') === 'chord');
    return [...getLabels(trebleNotes), ...getLabels(chordNotes)];
  }, [visibleNotes, channelModes, octaveShift, semitoneShift, noteHeight, MAX_MIDI]);

  const arrowGroups = useMemo(() => {
    const groups: { time: number, bassMin: number | null, trebleMin: number | null }[] = [];
    const sorted = [...visibleNotes].sort((a, b) => a.time - b.time);
    sorted.forEach(note => {
      const mode = channelModes[note.channel] || 'muted';
      if (mode === 'muted') return;
      const lastGroup = groups[groups.length - 1];
      const isBass = mode === 'bass';
      if (lastGroup && Math.abs(note.time - lastGroup.time) < 0.02) {
        if (isBass) lastGroup.bassMin = lastGroup.bassMin === null ? note.midi : Math.min(lastGroup.bassMin, note.midi);
        else lastGroup.trebleMin = lastGroup.trebleMin === null ? note.midi : Math.min(lastGroup.trebleMin, note.midi);
      } else {
        groups.push({ time: note.time, bassMin: isBass ? note.midi : null, trebleMin: !isBass ? note.midi : null });
      }
    });
    return groups;
  }, [visibleNotes, channelModes]);

  // Auto Scroll
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current || autoScrollMode === 'off' || !autoScrollMode) return;
    const LOOK_AHEAD = 1.8;
    const PADDING = 50;
    const relevantNotes = visibleNotes.filter(n => n.time < currentTime + LOOK_AHEAD && (n.time + n.duration) > currentTime && channelModes[n.channel] === autoScrollMode);
    if (relevantNotes.length === 0) return;
    let maxMidiInWindow = -Infinity;
    relevantNotes.forEach(n => {
      const shifted = n.midi + (octaveShift * 12) + semitoneShift;
      if (shifted > maxMidiInWindow) maxMidiInWindow = shifted;
    });
    if (maxMidiInWindow === -Infinity) return;
    const targetTop = (MAX_MIDI - maxMidiInWindow) * noteHeight - PADDING;
    const container = scrollContainerRef.current;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const clampedTarget = Math.max(0, Math.min(targetTop, maxScroll));
    const diff = clampedTarget - container.scrollTop;
    if (Math.abs(diff) > 1.0) container.scrollTop = container.scrollTop + (diff * 0.08);
  }, [currentTime, isPlaying, visibleNotes, octaveShift, semitoneShift, MAX_MIDI, noteHeight, autoScrollMode, channelModes]);

  // Initial Scroll
  useEffect(() => {
    if (notes.length === 0 || !scrollContainerRef.current) return;
    const visible = notes.filter(n => (channelModes[n.channel] || 'muted') !== 'muted' && (channelModes[n.channel] || 'muted') !== 'hidden');
    if (visible.length === 0) return;
    const startTime = visible[0].time;
    const targetNotes = visible.filter(n => n.time < startTime + 4.0).length > 0 ? visible.filter(n => n.time < startTime + 4.0) : visible;
    let maxMidi = -Infinity, minMidi = Infinity;
    targetNotes.forEach(n => {
      const shifted = n.midi + (octaveShift * 12) + semitoneShift;
      if (shifted > maxMidi) maxMidi = shifted;
      if (shifted < minMidi) minMidi = shifted;
    });
    if (maxMidi === -Infinity) return;
    const centerMidi = (maxMidi + minMidi) / 2;
    const centerPixel = (MAX_MIDI - centerMidi) * noteHeight;
    scrollContainerRef.current.scrollTop = Math.max(0, centerPixel - (scrollContainerRef.current.clientHeight / 2));
  }, [notes, octaveShift, semitoneShift, MAX_MIDI, noteHeight, channelModes]);

  // Drag Logic
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const dx = clientX - dragStartRef.current.x;
      let newTime = dragStartRef.current.time - (dx / pxPerSec);
      if (isNoteSnapEnabled) {
          const SNAP_WINDOW = 0.15;
          let bestTime = newTime;
          let minDiff = SNAP_WINDOW;
          for (const note of visibleNotes) {
              if (note.time > newTime + SNAP_WINDOW) break;
              if (note.time < newTime - SNAP_WINDOW) continue;
              const diff = Math.abs(note.time - newTime);
              if (diff < minDiff) { minDiff = diff; bestTime = note.time; }
          }
          newTime = bestTime;
      }
      onSeekRef.current(newTime);
    };
    const handleEnd = () => { setIsDragging(false); dragStartRef.current = null; };
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, pxPerSec, isNoteSnapEnabled, visibleNotes]);

  return {
    pxPerSec, setPxPerSec, noteHeight, setNoteHeight, isDragging, setIsDragging,
    selectedTimes, setSelectedTimes, scrollContainerRef, dragStartRef, prevPinchRef, pinchAxisRef,
    visibleNotes, chordLabels, arrowGroups, MIN_MIDI, MAX_MIDI, TOTAL_HEIGHT
  };
};
