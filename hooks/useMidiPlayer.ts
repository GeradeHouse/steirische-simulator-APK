import { useState, useEffect, useRef } from 'react';
import { Midi } from '@tonejs/midi';
import { Direction, MidiProject, SavedDirectionEvent } from '../types';
import { getButtonIdForNote, getButtonIdsForNote } from '../helpers/midiMap';
import { BASS_ROWS } from '../constants';

export type ChannelMode = 'both' | 'bass' | 'treble' | 'muted';

export interface MidiNote {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  channel: number;
  name: string;
}

interface MidiEvent {
  time: number;
  type: 'noteOn' | 'noteOff' | 'direction';
  midi?: number;
  velocity?: number;
  direction?: Direction;
  id?: string;
  noteType?: 'bass' | 'chord' | 'treble';
  channel?: number;
}

export interface DirectionEvent {
  time: number;
  direction: Direction;
}

export const useMidiPlayer = (
  audioController: any
) => {
  // --- State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [originalBpm, setOriginalBpm] = useState(120);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const [availableChannels, setAvailableChannels] = useState<number[]>([]);
  const [channelModes, setChannelModes] = useState<Record<number, ChannelMode>>({});
  const [allNotes, setAllNotes] = useState<MidiNote[]>([]);
  
  // New: Direction Events & Octave Shift
  const [directionEvents, setDirectionEvents] = useState<DirectionEvent[]>([]);
  const [octaveShift, setOctaveShiftState] = useState(0);
  const [isScrubbingSoundEnabled, setIsScrubbingSoundEnabled] = useState(false);
  
  // Project Storage State
  const [rawMidiBase64, setRawMidiBase64] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // New: Fingering Override State
  const [fingeringOverrides, setFingeringOverrides] = useState<Record<string, string>>({});
  const [alternativeButtons, setAlternativeButtons] = useState<Set<string>>(new Set());

  // --- Refs ---
  const eventQueue = useRef<MidiEvent[]>([]);
  const eventIndex = useRef(0);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const directionRef = useRef<Direction>(Direction.PUSH);
  // Store btnId AND channel to allow re-triggering on direction change
  const activeMidiMapping = useRef<Map<number, { btnId: string, channel: number }>>(new Map());
  const octaveShiftRef = useRef(0);
  const activeScrubbingNotes = useRef<Set<string>>(new Set());

  // --- Helpers ---

  // Helper to generate unique key for a note event
  const getNoteKey = (midi: number, time: number, channel: number) => {
    return `${midi}-${time.toFixed(3)}-${channel}`;
  };

  const setFingeringOverride = (midi: number, time: number, channel: number, btnId: string) => {
    const key = getNoteKey(midi, time, channel);
    setFingeringOverrides(prev => ({ ...prev, [key]: btnId }));
    
    // Immediate visual update if paused
    if (!isPlaying) {
      // Re-run sync to reflect change immediately
      setTimeout(() => seek(currentTime), 0);
    }
  };

  const setOctaveShift = (val: number) => {
    setOctaveShiftState(val);
    octaveShiftRef.current = val;
    activeScrubbingNotes.current.clear(); // Fix desync
    audioController.stopAllNotes();
  };

  const cycleChannelMode = (channel: number) => {
    setChannelModes(prev => {
      const current = prev[channel] || 'muted';
      let next: ChannelMode = 'both';
      if (current === 'both') next = 'bass';
      else if (current === 'bass') next = 'treble';
      else if (current === 'treble') next = 'muted';
      else next = 'both';

      activeScrubbingNotes.current.clear(); // Fix desync
      audioController.stopAllNotes();
      return { ...prev, [channel]: next };
    });
  };

  const updateDirections = (updates: { time: number, direction: Direction }[]) => {
    // 1. Update State
    setDirectionEvents(prev => {
      const newEvents = [...prev];
      updates.forEach(update => {
        const idx = newEvents.findIndex(e => Math.abs(e.time - update.time) < 0.001);
        if (idx >= 0) newEvents.splice(idx, 1);
        newEvents.push(update);
      });
      return newEvents.sort((a, b) => a.time - b.time);
    });

    // 2. Update Event Queue
    const currentQueue = eventQueue.current;
    const filteredQueue = currentQueue.filter(e => {
      if (e.type !== 'direction') return true;
      return !updates.some(u => Math.abs(u.time - e.time) < 0.001);
    });

    updates.forEach(u => {
      filteredQueue.push({ time: u.time, type: 'direction', direction: u.direction });
    });

    filteredQueue.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      if (a.type === 'direction' && b.type !== 'direction') return -1;
      if (a.type !== 'direction' && b.type === 'direction') return 1;
      return 0;
    });

    eventQueue.current = filteredQueue;
  };

  const loadMidiFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        // result is DataURL: "data:audio/midi;base64,..."
        const base64 = result.split(',')[1];
        setRawMidiBase64(base64);
        
        // Decode for Tone.js
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        await parseAndLoadMidi(bytes.buffer, file.name);
        setCurrentProjectId(null); // New file = new project context
      }
    };
    reader.readAsDataURL(file);
  };

  const parseAndLoadMidi = async (buffer: ArrayBuffer, name: string) => {
    const midi = new Midi(buffer);
    setFileName(name);
    
    if (midi.header.tempos.length > 0) {
      setOriginalBpm(Math.round(midi.header.tempos[0].bpm));
      setBpm(Math.round(midi.header.tempos[0].bpm));
    }
    setTotalTime(midi.duration);

    const events: MidiEvent[] = [];
    const foundChannels = new Set<number>();
    const initialDirEvents: DirectionEvent[] = [];

    midi.tracks.forEach(track => {
      foundChannels.add(track.channel);
      track.notes.forEach(note => {
        events.push({ time: note.time, type: 'noteOn', midi: note.midi, velocity: note.velocity, channel: track.channel });
        events.push({ time: note.time + note.duration, type: 'noteOff', midi: note.midi, channel: track.channel });
      });
      // @ts-ignore
      const trackEvents = track.events || [];
      trackEvents.forEach((e: any) => {
          if (e.type === 'text' || e.type === 'meta') {
              const text = (e.text || '').toUpperCase();
              if (text.includes('PUSH')) {
                  events.push({ time: e.time, type: 'direction', direction: Direction.PUSH });
                  initialDirEvents.push({ time: e.time, direction: Direction.PUSH });
              } else if (text.includes('PULL')) {
                  events.push({ time: e.time, type: 'direction', direction: Direction.PULL });
                  initialDirEvents.push({ time: e.time, direction: Direction.PULL });
              }
          }
      });
    });

    const parsedNotes: MidiNote[] = [];
    midi.tracks.forEach(track => {
      track.notes.forEach(note => {
        parsedNotes.push({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
          channel: track.channel,
          name: note.name
        });
      });
    });
    parsedNotes.sort((a, b) => a.time - b.time);
    setAllNotes(parsedNotes);
    setDirectionEvents(initialDirEvents.sort((a, b) => a.time - b.time));

    setAvailableChannels(Array.from(foundChannels).sort((a, b) => a - b));
    const initialModes: Record<number, ChannelMode> = {};
    foundChannels.forEach(ch => { initialModes[ch] = 'both'; });
    setChannelModes(initialModes);

    events.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      if (a.type === 'direction' && b.type !== 'direction') return -1;
      if (a.type !== 'direction' && b.type === 'direction') return 1;
      return 0;
    });
    
    eventQueue.current = events;
    resetPlayer();
  };

  const resetPlayer = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    eventIndex.current = 0;
    pausedTimeRef.current = 0;
    directionRef.current = Direction.PUSH;
    activeMidiMapping.current.clear();
    activeScrubbingNotes.current.clear();
    audioController.stopAllNotes();
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      pausedTimeRef.current = currentTime;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioController.stopAllNotes();
    } else {
      setIsPlaying(true);
      directionRef.current = audioController.direction; 
      startTimeRef.current = performance.now() - (pausedTimeRef.current * 1000 * (originalBpm / bpm));
      loop();
    }
  };

  // --- Smart Fingering Solver ---
  const solveAndPlayBatch = (events: MidiEvent[]) => {
    const currentDir = directionRef.current;
    // Extract btnIds from the mapping objects
    const activeIds = Array.from(activeMidiMapping.current.values()).map((v: { btnId: string, channel: number }) => v.btnId);
    
    // 1. Prepare Candidates
    const notesToSolve: { event: MidiEvent, candidates: string[] }[] = [];
    
    events.forEach(e => {
       const mode = e.channel !== undefined ? (channelModes[e.channel] || 'muted') : 'both';
       if (mode === 'muted') return;
       
       const shiftedMidi = e.midi! + (octaveShiftRef.current * 12);
       
       // Check Override
       const key = getNoteKey(e.midi!, e.time, e.channel || 0);
       const overrideId = fingeringOverrides[key];

       let validIds: string[] = [];

       if (overrideId) {
         // If override exists, force it as the only candidate
         validIds = [overrideId];
       } else {
         const allIds = getButtonIdsForNote(shiftedMidi, currentDir);
         validIds = allIds.filter(id => {
            const isBass = id.startsWith('bass');
            if (mode === 'bass' && !isBass) return false;
            if (mode === 'treble' && isBass) return false;
            return true;
         });
       }
       
       if (validIds.length > 0) {
          notesToSolve.push({ event: e, candidates: validIds });
       }
    });

    if (notesToSolve.length === 0) return;

    // 2. Solver (Minimize Distance)
    let bestCost = Infinity;
    let bestAssignment: string[] = [];

    const getCost = (id1: string, id2: string) => {
        const p1 = id1.split('-');
        const p2 = id2.split('-');
        // type-row-col
        if (p1[0] !== p2[0]) return 100; // Different hands (infinite distance)
        const r1 = parseInt(p1[1]), c1 = parseInt(p1[2]);
        const r2 = parseInt(p2[1]), c2 = parseInt(p2[2]);
        // Heuristic: Row changes are "expensive" (4x), column changes are "cheap" (1x)
        return Math.abs(c1 - c2) + Math.abs(r1 - r2) * 4;
    };

    const search = (idx: number, current: string[]) => {
        if (idx === notesToSolve.length) {
            let cost = 0;
            // Internal spread (pairwise among new notes)
            for (let i = 0; i < current.length; i++) {
                for (let j = i + 1; j < current.length; j++) {
                    cost += getCost(current[i], current[j]);
                }
            }
            // Distance to existing hand position (active notes)
            for (let i = 0; i < current.length; i++) {
                for (const active of activeIds) {
                    cost += getCost(current[i], active);
                }
            }
            
            if (cost < bestCost) {
                bestCost = cost;
                bestAssignment = [...current];
            }
            return;
        }

        const candidates = notesToSolve[idx].candidates;
        for (const cand of candidates) {
            current.push(cand);
            search(idx + 1, current);
            current.pop();
        }
    };

    search(0, []);

    // 3. Play Selected Buttons
    bestAssignment.forEach((btnId, idx) => {
        const event = notesToSolve[idx].event;
        const shiftedMidi = event.midi! + (octaveShiftRef.current * 12);
        
        // Store btnId AND channel
        activeMidiMapping.current.set(event.midi!, { btnId, channel: event.channel || 0 });
        
        const isBassRow = btnId.startsWith('bass');
        let type: 'bass' | 'chord' | 'treble' = 'treble';
        let chordType = undefined;
        
        if (isBassRow) {
             const [_, rStr, bStr] = btnId.split('-');
             const r = parseInt(rStr);
             const b = parseInt(bStr);
             const def = BASS_ROWS.find(row => row.rowId === r)?.buttons[b];
             if (def) {
                 const noteDef = currentDir === Direction.PUSH ? def.push : def.pull;
                 type = noteDef.type as any;
                 chordType = noteDef.chordType;
             }
        }
        
        audioController.handleNoteStart(btnId, { midi: shiftedMidi, label: 'MIDI' }, type, chordType, currentDir);
    });
  };

  const loop = () => {
    const now = performance.now();
    const rawElapsed = (now - startTimeRef.current) / 1000;
    const speedRatio = bpm / originalBpm;
    const scaledTime = rawElapsed * speedRatio;

    setCurrentTime(scaledTime);

    const batch: MidiEvent[] = [];

    const flushBatch = () => {
      if (batch.length === 0) return;
      solveAndPlayBatch(batch);
      batch.length = 0;
    };

    while (eventIndex.current < eventQueue.current.length) {
      const event = eventQueue.current[eventIndex.current];
      if (event.time > scaledTime) break;

      if (event.type === 'noteOn') {
        batch.push(event);
      } else {
        // Flush pending notes before changing direction or stopping notes
        flushBatch();
        processEvent(event);
      }
      eventIndex.current++;
    }
    flushBatch();

    if (scaledTime >= totalTime) {
      setIsPlaying(false);
      return;
    }

    if (isPlaying) {
       animationFrameRef.current = requestAnimationFrame(loop);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, bpm]);

  const processEvent = (event: MidiEvent) => {
    // NoteOn is now handled by solveAndPlayBatch in the loop
    
    if (event.type === 'direction' && event.direction) {
      const newDir = event.direction;
      if (directionRef.current !== newDir) {
          // 1. Capture currently playing notes
          const activeNotesData = Array.from(activeMidiMapping.current.entries());
          
          // 2. Stop everything physically
          audioController.stopAllNotes();
          activeMidiMapping.current.clear();
          
          // 3. Update Direction
          audioController.setDirection(newDir);
          directionRef.current = newDir;
          
          // 4. Re-trigger notes in new direction (if they exist)
          if (activeNotesData.length > 0) {
              const syntheticEvents: MidiEvent[] = activeNotesData.map(([midi, data]) => ({
                  time: currentTime,
                  type: 'noteOn',
                  midi: midi,
                  velocity: 0.8,
                  channel: data.channel
              }));
              solveAndPlayBatch(syntheticEvents);
          }
      }
      return;
    }

    if (!event.midi) return;

    if (event.type === 'noteOff') {
      const data = activeMidiMapping.current.get(event.midi);
      if (data) {
        audioController.handleNoteStop(data.btnId);
        activeMidiMapping.current.delete(event.midi);
      }
    }
  };

  const syncScrubbingNotes = (time: number) => {
    // 1. Determine Direction at this time using binary search
    let dir = Direction.PUSH;
    
    if (directionEvents.length > 0) {
      // Binary search to find the last direction event at or before the current time
      let left = 0;
      let right = directionEvents.length - 1;
      let lastValidIndex = -1;
      
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const event = directionEvents[mid];
        
        if (event.time <= time + 0.001) {
          lastValidIndex = mid;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }
      
      if (lastValidIndex >= 0) {
        dir = directionEvents[lastValidIndex].direction;
      }
    }
    
    if (dir !== directionRef.current) {
      directionRef.current = dir;
      audioController.setDirection(dir);
      // If direction changes, clear previous notes to avoid stuck buttons
      activeScrubbingNotes.current.forEach(id => audioController.handleNoteStop(id));
      activeScrubbingNotes.current.clear();
    }

    // 2. Find Active Notes
    const activeIds = new Set<string>();
    const newAlternatives = new Set<string>();
    
    allNotes.forEach(note => {
      // Check if note overlaps current time
      if (time >= note.time && time < note.time + note.duration) {
        const shiftedMidi = note.midi + (octaveShiftRef.current * 12);
        
        const mode = channelModes[note.channel] || 'muted';
        if (mode === 'muted') return;

        const allBtnIds = getButtonIdsForNote(shiftedMidi, dir);
        
        // Filter valid candidates
        const candidates = allBtnIds.filter(btnId => {
            const isBassBtn = btnId.startsWith('bass');
            const isTrebleBtn = btnId.startsWith('treble');
            if (mode === 'bass' && !isBassBtn) return false;
            if (mode === 'treble' && !isTrebleBtn) return false;
            return true;
        });

        if (candidates.length === 0) return;

        // Determine Primary Button
        const key = getNoteKey(note.midi, note.time, note.channel);
        let primaryId = fingeringOverrides[key];

        // If override is invalid or missing, default to first candidate (or heuristic)
        if (!primaryId || !candidates.includes(primaryId)) {
            primaryId = candidates[0];
        }

        activeIds.add(primaryId);

        // Mark others as alternatives
        candidates.forEach(id => {
            if (id !== primaryId) newAlternatives.add(id);
        });

        // Play Primary
        if (!activeScrubbingNotes.current.has(primaryId)) {
             const isBassRow = primaryId.startsWith('bass');
             let type: 'bass' | 'chord' | 'treble' = 'treble';
             let chordType = undefined;

             if (isBassRow) {
                const [_, rStr, bStr] = primaryId.split('-');
                const r = parseInt(rStr);
                const b = parseInt(bStr);
                const def = BASS_ROWS.find(row => row.rowId === r)?.buttons[b];
                if (def) {
                    const noteDef = dir === Direction.PUSH ? def.push : def.pull;
                    type = noteDef.type as any;
                    chordType = noteDef.chordType;
                }
             }

             audioController.handleNoteStart(
               primaryId,
               { midi: shiftedMidi, label: 'Scrub' },
               type,
               chordType,
               dir,
               {
                 silent: !isScrubbingSoundEnabled,
                 duration: 2.0
               }
             );
             activeScrubbingNotes.current.add(primaryId);
        }
      }
    });

    setAlternativeButtons(newAlternatives);

    // 3. Stop notes that are no longer active
    activeScrubbingNotes.current.forEach(id => {
      if (!activeIds.has(id)) {
        audioController.handleNoteStop(id);
        activeScrubbingNotes.current.delete(id);
      }
    });
  };

  const seek = (time: number) => {
    const newTime = Math.max(0, Math.min(time, totalTime));
    setCurrentTime(newTime);
    
    if (isPlaying) {
      const speedRatio = bpm / originalBpm;
      startTimeRef.current = performance.now() - (newTime * 1000 / speedRatio);
    } else {
      pausedTimeRef.current = newTime;
      syncScrubbingNotes(newTime);
    }
  };

  const loadProject = async (project: MidiProject) => {
    if (!project.midiBase64) return;
    setRawMidiBase64(project.midiBase64);
    setCurrentProjectId(project.id);
    
    const binaryString = atob(project.midiBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    await parseAndLoadMidi(bytes.buffer, project.name);
    
    setBpm(project.bpm);
    setOctaveShift(project.octaveShift);
    setChannelModes(project.channelModes);
    updateDirections(project.directionEvents);
    setFingeringOverrides(project.fingeringOverrides || {}); // Restore overrides
  };

  const getProjectState = (): Omit<MidiProject, 'id' | 'name' | 'lastModified'> | null => {
    if (!rawMidiBase64) return null;
    return {
      midiBase64: rawMidiBase64,
      bpm,
      octaveShift,
      channelModes,
      directionEvents,
      fingeringOverrides // Save overrides
    };
  };

  return {
    isPlaying,
    currentTime,
    totalTime,
    bpm,
    setBpm,
    fileName,
    loadMidiFile,
    togglePlay,
    resetPlayer,
    availableChannels,
    channelModes,
    cycleChannelMode,
    allNotes,
    seek,
    octaveShift,
    setOctaveShift,
    directionEvents,
    updateDirections,
    isScrubbingSoundEnabled,
    setIsScrubbingSoundEnabled,
    currentProjectId,
    loadProject,
    getProjectState,
    alternativeButtons,
    setFingeringOverride
  };
};
