import { useState, useEffect, useRef } from 'react';
import { Midi } from '@tonejs/midi';
import { Direction, MidiProject, SavedDirectionEvent } from '../types';
import { getButtonIdForNote, getButtonIdsForNote, getNoteKey } from '../helpers/midiMap';
import { BASS_ROWS } from '../constants';

export type ChannelMode = 'both' | 'bass' | 'treble' | 'muted' | 'hidden';

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
  const [semitoneShift, setSemitoneShiftState] = useState(0); // New State
  const [isScrubbingSoundEnabled, setIsScrubbingSoundEnabled] = useState(false);
  
  // Project Storage State
  const [rawMidiBase64, setRawMidiBase64] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);

  // New: Fingering Override State
  const [fingeringOverrides, setFingeringOverrides] = useState<Record<string, string>>({});
  const fingeringOverridesRef = useRef<Record<string, string>>({});
  const [flashingNotes, setFlashingNotes] = useState<Set<string>>(new Set()); // Visual feedback
  const [alternativeButtons, setAlternativeButtons] = useState<Set<string>>(new Set());
  const [autoScrollMode, setAutoScrollMode] = useState<'treble' | 'bass' | 'off'>('treble');
  const [isNoteSnapEnabled, setIsNoteSnapEnabled] = useState(false);

  const cycleAutoScrollMode = () => {
    setAutoScrollMode(prev => {
      if (prev === 'treble') return 'bass';
      if (prev === 'bass') return 'off';
      return 'treble';
    });
  };

  useEffect(() => {
    fingeringOverridesRef.current = fingeringOverrides;
  }, [fingeringOverrides]);

  // Clear flashing notes after render
  useEffect(() => {
    if (flashingNotes.size > 0) {
      const timer = setTimeout(() => {
        setFlashingNotes(new Set());
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [flashingNotes]);

  const [editingNote, setEditingNote] = useState<{ midi: number, time: number, channel: number } | null>(null);

  const setFingeringOverride = (midi: number, time: number, channel: number, btnId: string) => {
    const targetKey = getNoteKey(midi, time, channel);
    
    // Batch Logic: Propagate to subsequent identical notes
    const newOverrides = { ...fingeringOverrides };
    const newFlashing = new Set<string>();
    
    // 1. Apply to target
    newOverrides[targetKey] = btnId;
    newFlashing.add(targetKey);

    // 2. Find start index and propagate
    const startIndex = allNotes.findIndex(n =>
        n.midi === midi && Math.abs(n.time - time) < 0.001 && n.channel === channel
    );

    if (startIndex !== -1) {
        let currentTarget = allNotes[startIndex];

        for (let i = startIndex + 1; i < allNotes.length; i++) {
            const nextNote = allNotes[i];
            if (nextNote.channel !== channel) continue;
            
            if (nextNote.midi === midi) {
                // Found same note - update override and current reference
                const nextKey = getNoteKey(nextNote.midi, nextNote.time, nextNote.channel);
                newOverrides[nextKey] = btnId;
                newFlashing.add(nextKey);
                currentTarget = nextNote;
            } else {
                // Different note - check if it's harmony or melody
                
                // 1. Overlap with current target note? (Harmony of previous/current)
                // If it starts before the current note ends (with small buffer), it's simultaneous/harmony
                if (nextNote.time < (currentTarget.time + currentTarget.duration - 0.05)) {
                    continue;
                }

                // 2. Overlap with a future target note? (Harmony of next)
                // Look ahead to find the next instance of the target note
                let futureTarget = null;
                for (let j = i + 1; j < allNotes.length; j++) {
                    if (allNotes[j].channel === channel && allNotes[j].midi === midi) {
                        futureTarget = allNotes[j];
                        break;
                    }
                }

                if (futureTarget) {
                    // Check if nextNote overlaps with futureTarget
                    // Since notes are sorted by time, nextNote.time <= futureTarget.time
                    // We just need to check if nextNote ends after futureTarget starts (with buffer)
                    if ((nextNote.time + nextNote.duration) > (futureTarget.time + 0.05)) {
                         continue;
                    }
                }

                // If neither, it's a melodic interruption -> Break chain
                break;
            }
        }
    }

    setFingeringOverrides(newOverrides);
    fingeringOverridesRef.current = newOverrides; // Sync Ref immediately
    
    // Trigger Flash
    setFlashingNotes(newFlashing);

    // Immediate visual update if paused
    if (!isPlaying) {
      setTimeout(() => seek(currentTime), 0);
    }
  };

  const clearSelection = () => setEditingNote(null);

  const selectNote = (note: MidiNote) => {
    // Cycle Logic if already editing this note
    if (editingNote &&
        editingNote.midi === note.midi &&
        Math.abs(editingNote.time - note.time) < 0.001 &&
        editingNote.channel === note.channel) {
        
        const dir = directionRef.current;
        const shiftedMidi = note.midi + (octaveShiftRef.current * 12) + semitoneShiftRef.current;
        const candidates = getButtonIdsForNote(shiftedMidi, dir);
        
        if (candidates.length > 1) {
            const key = getNoteKey(note.midi, note.time, note.channel);
            // Use Ref to get the absolute latest state
            const currentId = fingeringOverridesRef.current[key];
            
            let nextIndex = 0;
            if (currentId) {
                const currIdx = candidates.indexOf(currentId);
                if (currIdx !== -1) {
                    nextIndex = (currIdx + 1) % candidates.length;
                }
            } else {
                // Default to second option if no override exists yet
                nextIndex = 1 % candidates.length;
            }
            
            setFingeringOverride(note.midi, note.time, note.channel, candidates[nextIndex]);
        }
        return;
    }

    setIsPlaying(false);
    // Seek slightly into the note (50ms) to avoid start-boundary overlaps with previous notes
    seek(note.time + 0.05);
    setEditingNote({ midi: note.midi, time: note.time, channel: note.channel });
  };

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
  const semitoneShiftRef = useRef(0); // New Ref
  const activeScrubbingNotes = useRef<Set<string>>(new Set());

  // --- Helpers ---

  const setOctaveShift = (val: number) => {
    setOctaveShiftState(val);
    octaveShiftRef.current = val;
    activeScrubbingNotes.current.clear(); // Fix desync
    audioController.stopAllNotes();
  };

  const setSemitoneShift = (val: number) => {
    setSemitoneShiftState(val);
    semitoneShiftRef.current = val;
    activeScrubbingNotes.current.clear(); // Fix desync
    audioController.stopAllNotes();
  };

  const cycleChannelMode = (channel: number) => {
    setChannelModes(prev => {
      const current = prev[channel] || 'muted';
      let next: ChannelMode = 'treble';
      if (current === 'muted') next = 'treble';
      else if (current === 'treble') next = 'bass';
      else if (current === 'bass') next = 'hidden';
      else next = 'muted'; // from hidden back to muted

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
    foundChannels.forEach(ch => { initialModes[ch] = 'muted'; });
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
      
      // Stop any scrubbing notes
      activeScrubbingNotes.current.forEach(id => audioController.handleNoteStop(id));
      activeScrubbingNotes.current.clear();

      // Rebuild activeMidiMapping if empty (e.g. after seek)
      if (activeMidiMapping.current.size === 0) {
         const time = pausedTimeRef.current;
         const dir = directionRef.current;
         
         allNotes.forEach(note => {
             if (time >= note.time && time < note.time + note.duration) {
                 const mode = channelModes[note.channel] || 'muted';
                 if (mode === 'muted' || mode === 'hidden') return;
                 
                 const shiftedMidi = note.midi + (octaveShiftRef.current * 12) + semitoneShiftRef.current;
                 const candidates = getButtonIdsForNote(shiftedMidi, dir);
                 const validCandidates = candidates.filter(id => {
                     const isBass = id.startsWith('bass');
                     if (mode === 'bass' && !isBass) return false;
                     if (mode === 'treble' && isBass) return false;
                     return true;
                 });
                 
                 if (validCandidates.length > 0) {
                     const key = getNoteKey(note.midi, note.time, note.channel);
                     let btnId = fingeringOverridesRef.current[key];
                     if (!btnId || !validCandidates.includes(btnId)) btnId = validCandidates[0];
                     activeMidiMapping.current.set(note.midi, { btnId, channel: note.channel });
                 }
             }
         });
      }

      // Re-trigger all notes in mapping
      activeMidiMapping.current.forEach((data, midi) => {
          const shiftedMidi = midi + (octaveShiftRef.current * 12) + semitoneShiftRef.current;
          const isBassRow = data.btnId.startsWith('bass');
          let type: 'bass' | 'chord' | 'treble' = 'treble';
          let chordType = undefined;
          
          if (isBassRow) {
             const [_, rStr, bStr] = data.btnId.split('-');
             const r = parseInt(rStr);
             const b = parseInt(bStr);
             const def = BASS_ROWS.find(row => row.rowId === r)?.buttons[b];
             if (def) {
                 const noteDef = directionRef.current === Direction.PUSH ? def.push : def.pull;
                 type = noteDef.type as any;
                 chordType = noteDef.chordType;
             }
          }
          
          audioController.handleNoteStart(
              data.btnId,
              { midi: shiftedMidi, label: 'Resume' },
              type,
              chordType,
              directionRef.current
          );
      });

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
       if (mode === 'muted' || mode === 'hidden') return;
       
       // Apply Octave AND Semitone Shift
       const shiftedMidi = e.midi! + (octaveShiftRef.current * 12) + semitoneShiftRef.current;
       
       // Get Candidates
       const allIds = getButtonIdsForNote(shiftedMidi, currentDir);
       const candidates = allIds.filter(id => {
          const isBass = id.startsWith('bass');
          if (mode === 'bass' && !isBass) return false;
          if (mode === 'treble' && isBass) return false;
          return true;
       });

       if (candidates.length === 0) return;

       // Check Override
       const key = getNoteKey(e.midi!, e.time, e.channel || 0);
       const overrideId = fingeringOverridesRef.current[key];

       let validIds = candidates;
       if (overrideId && candidates.includes(overrideId)) {
         validIds = [overrideId];
       }
       
       notesToSolve.push({ event: e, candidates: validIds });
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
        // Apply Shifts
        const shiftedMidi = event.midi! + (octaveShiftRef.current * 12) + semitoneShiftRef.current;
        
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

  const deleteChannel = (channel: number) => {
    // 1. Stop active notes for this channel
    activeMidiMapping.current.forEach((data, midi) => {
      if (data.channel === channel) {
        audioController.handleNoteStop(data.btnId);
        activeMidiMapping.current.delete(midi);
      }
    });

    // 2. Remove from State
    setAvailableChannels(prev => prev.filter(c => c !== channel));
    setChannelModes(prev => {
      const next = { ...prev };
      delete next[channel];
      return next;
    });
    setAllNotes(prev => prev.filter(n => n.channel !== channel));
    
    // 3. Clean up Event Queue (keep global events or other channels)
    eventQueue.current = eventQueue.current.filter(e => e.channel === undefined || e.channel !== channel);
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
    // 1. Determine Direction
    let dir = Direction.PUSH;
    if (directionEvents.length > 0) {
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
      activeScrubbingNotes.current.forEach(id => audioController.handleNoteStop(id));
      activeScrubbingNotes.current.clear();
    }

    // 2. Gather Notes
    const notesToSolve: { note: MidiNote, candidates: string[], allCandidates: string[], shiftedMidi: number }[] = [];

    allNotes.forEach(note => {
      if (time >= note.time && time < note.time + note.duration - 0.03) {
        const mode = channelModes[note.channel] || 'muted';
        if (mode === 'muted' || mode === 'hidden') return;

        const shiftedMidi = note.midi + (octaveShiftRef.current * 12) + semitoneShiftRef.current;
        const allBtnIds = getButtonIdsForNote(shiftedMidi, dir);
        
        const candidates = allBtnIds.filter(btnId => {
            const isBassBtn = btnId.startsWith('bass');
            const isTrebleBtn = btnId.startsWith('treble');
            if (mode === 'bass' && !isBassBtn) return false;
            if (mode === 'treble' && !isTrebleBtn) return false;
            return true;
        });

        if (candidates.length === 0) return;

        const key = getNoteKey(note.midi, note.time, note.channel);
        const overrideId = fingeringOverridesRef.current[key];

        let validIds = candidates;
        if (overrideId && candidates.includes(overrideId)) {
            validIds = [overrideId];
        }

        notesToSolve.push({ note, candidates: validIds, allCandidates: candidates, shiftedMidi });
      }
    });

    // 3. Group by Time & Sort
    const groups = new Map<number, typeof notesToSolve>();
    notesToSolve.forEach(item => {
        const t = item.note.time;
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t)!.push(item);
    });
    const sortedTimes = Array.from(groups.keys()).sort((a, b) => a - b);

    // 4. Incremental Solve
    const finalAssignment: string[] = [];
    const prevActive: string[] = Array.from(activeScrubbingNotes.current);

    const getCost = (id1: string, id2: string) => {
        const p1 = id1.split('-');
        const p2 = id2.split('-');
        if (p1[0] !== p2[0]) return 100;
        const r1 = parseInt(p1[1]), c1 = parseInt(p1[2]);
        const r2 = parseInt(p2[1]), c2 = parseInt(p2[2]);
        return Math.abs(c1 - c2) + Math.abs(r1 - r2) * 4;
    };

    sortedTimes.forEach(t => {
        const groupItems = groups.get(t)!;
        let bestGroupCost = Infinity;
        let bestGroupAssign: string[] = [];

        const search = (idx: number, current: string[]) => {
            if (idx === groupItems.length) {
                let cost = 0;
                // Internal
                for (let i = 0; i < current.length; i++) {
                    for (let j = i + 1; j < current.length; j++) {
                        cost += getCost(current[i], current[j]);
                    }
                }
                // External (to previously assigned in this frame)
                for (let i = 0; i < current.length; i++) {
                    for (const assigned of finalAssignment) {
                        cost += getCost(current[i], assigned);
                    }
                }
                // External (to prevActive - stability)
                for (let i = 0; i < current.length; i++) {
                    for (const active of prevActive) {
                        cost += getCost(current[i], active);
                    }
                }

                if (cost < bestGroupCost) {
                    bestGroupCost = cost;
                    bestGroupAssign = [...current];
                }
                return;
            }

            const candidates = groupItems[idx].candidates;
            for (const cand of candidates) {
                current.push(cand);
                search(idx + 1, current);
                current.pop();
            }
        };

        search(0, []);
        finalAssignment.push(...bestGroupAssign);
    });

    // 5. Sync & Alternatives
    const nextActiveIds = new Set<string>(finalAssignment);
    const calculatedAlternatives = new Set<string>();

    activeScrubbingNotes.current.forEach(id => {
        if (!nextActiveIds.has(id)) {
            audioController.handleNoteStop(id);
            activeScrubbingNotes.current.delete(id);
        }
    });

    let assignIdx = 0;
    sortedTimes.forEach(t => {
        const groupItems = groups.get(t)!;
        groupItems.forEach(item => {
            const btnId = finalAssignment[assignIdx++];
            
            item.allCandidates.forEach(cand => {
                if (cand !== btnId) calculatedAlternatives.add(cand);
            });

            if (!activeScrubbingNotes.current.has(btnId)) {
                 const isBassRow = btnId.startsWith('bass');
                 let type: 'bass' | 'chord' | 'treble' = 'treble';
                 let chordType = undefined;

                 if (isBassRow) {
                    const [_, rStr, bStr] = btnId.split('-');
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
                   btnId,
                   { midi: item.shiftedMidi, label: 'Scrub' },
                   type,
                   chordType,
                   dir,
                   {
                     silent: !isScrubbingSoundEnabled,
                     duration: 2.0
                   }
                 );
                 activeScrubbingNotes.current.add(btnId);
            }
        });
    });
    
    setAlternativeButtons(calculatedAlternatives);
  };

const seek = (time: number) => {
    const newTime = Math.max(0, Math.min(time, totalTime));
    setCurrentTime(newTime);
    
    // Sync eventIndex to new time
    const newIndex = eventQueue.current.findIndex(e => e.time >= newTime);
    eventIndex.current = newIndex === -1 ? eventQueue.current.length : newIndex;
    
    // Clear playback state since we jumped
    activeMidiMapping.current.clear();
    
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
    setSemitoneShift(project.semitoneShift || 0); // Load Semitone
    setChannelModes(project.channelModes);
    updateDirections(project.directionEvents);
    setFingeringOverrides(project.fingeringOverrides || {});
    fingeringOverridesRef.current = project.fingeringOverrides || {}; // Restore overrides to Ref
  };

  const getProjectState = (): Omit<MidiProject, 'id' | 'name' | 'lastModified'> | null => {
    if (!rawMidiBase64) return null;
    return {
      midiBase64: rawMidiBase64,
      bpm,
      octaveShift,
      semitoneShift, // Save Semitone
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
    semitoneShift, // Export
    setSemitoneShift, // Export
    directionEvents,
    updateDirections,
    isScrubbingSoundEnabled,
    setIsScrubbingSoundEnabled,
    currentProjectId,
    loadProject,
    getProjectState,
    alternativeButtons,
    setFingeringOverride,
    editingNote,
    selectNote,
    clearSelection,
    flashingNotes,
    deleteChannel,
    autoScrollMode,
    cycleAutoScrollMode,
    isNoteSnapEnabled,
    setIsNoteSnapEnabled,
    isAutoSaveEnabled,
    setIsAutoSaveEnabled
  };
};
