import { useState, useEffect } from 'react';
import { Direction, NoteDefinition } from '../types';
import { audioService } from '../services/audioService';
import { analyzeChord } from '../services/geminiService';

export const useAudioController = (isEditing: boolean) => {
  const [direction, setDirection] = useState<Direction>(Direction.PUSH);
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  
  // AI State
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [chordName, setChordName] = useState<string>('');
  const [chordDesc, setChordDesc] = useState<string>('AI analysis is disabled');

  const handleNoteStart = (
    id: string,
    noteDef: NoteDefinition,
    type: 'bass' | 'chord' | 'treble',
    chordType?: any,
    newDirection?: Direction,
    options?: { silent?: boolean; duration?: number }
  ) => {
    if (isEditing) return;
    
    if (newDirection) {
      setDirection(newDirection);
    }

    // Only play audio if not silent
    if (!options?.silent) {
      audioService.playNote(id, noteDef.midi, type, chordType, newDirection || direction, { duration: options?.duration });
    }
    
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleNoteStop = (id: string) => {
    audioService.stopNote(id);
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const stopAllNotes = () => {
    audioService.stopAll();
    setActiveNotes(new Set());
  };

  // AI Analysis Effect
  useEffect(() => {
    if (!isAiEnabled) {
      setChordName('');
      setChordDesc('AI analysis is disabled');
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (activeNotes.size > 0 && !isEditing) {
        const currentNoteIds = Array.from(activeNotes);
        const notesList = currentNoteIds.map(id => (id as string).includes('bass') ? 'Bass/Chord' : 'Melody');
        
        if (notesList.length > 0) {
            try {
                setChordDesc('Analyzing...');
                const analysis = await analyzeChord(notesList, direction);
                setChordName(analysis.chordName);
                setChordDesc(analysis.description);
            } catch (err) {
                console.error("Analysis failed", err);
                setChordDesc('Analysis error (check API key)');
            }
        }
      } else if (activeNotes.size === 0) {
        setChordName('');
        setChordDesc('Play notes to analyze...');
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [activeNotes, isEditing, direction, isAiEnabled]);

  return {
    direction,
    setDirection,
    activeNotes,
    isAiEnabled,
    setIsAiEnabled,
    chordName,
    chordDesc,
    handleNoteStart,
    handleNoteStop,
    stopAllNotes // Added this export
  };
};