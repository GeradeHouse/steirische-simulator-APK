// file: helpers/musicTheory.ts

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Converts a set of MIDI numbers into a compact chord name.
 * Prioritizes 2-note intervals and standard triads.
 */
export const getCompactChordName = (midiNotes: number[]): string | null => {
  if (midiNotes.length < 2) return null;

  // 1. Sort and normalize to 0-11 (Pitch Classes)
  // We keep the original sorted MIDI to determine the bass note vs highest note later if needed,
  // but for theory, we need the unique pitch classes.
  const sortedMidi = [...midiNotes].sort((a, b) => a - b);
  const rootMidi = sortedMidi[0];
  
  // Calculate intervals relative to the lowest note (in semitones)
  const intervals = sortedMidi.map(n => n - rootMidi);
  
  // Get Pitch Classes (0-11) for naming
  const pcs = sortedMidi.map(n => n % 12);
  const rootPC = pcs[0];
  const rootName = NOTE_NAMES[rootPC];

  // --- 2-Note Logic (Dyads) ---
  if (midiNotes.length === 2) {
    const interval = intervals[1]; // Distance between the two notes
    
    // Reduce large intervals (octaves) to simple intervals
    const simpleInterval = interval % 12;

    switch (simpleInterval) {
      case 3: return `${rootName}m`; // Minor 3rd (e.g., C + Eb) -> Cm
      case 4: return `${rootName}`;  // Major 3rd (e.g., C + E)  -> C
      case 7: return `${rootName}5`; // Perfect 5th (e.g., C + G) -> C5 (Power chord)
      
      // Inversions (The lower note is NOT the root)
      case 5: // Perfect 4th (e.g., G + C). C is root.
        return NOTE_NAMES[pcs[1]]; // Return the top note name (Major implied)
      case 8: // Minor 6th (e.g., E + C). C is root.
        return NOTE_NAMES[pcs[1]]; // Return top note (Major implied)
      case 9: // Major 6th (e.g., G + E). E is root.
        return `${NOTE_NAMES[pcs[1]]}m`; // Return top note as Minor
        
      default: return null; // Too ambiguous or dissonant to label compactly
    }
  }

  // --- 3+ Note Logic (Triads/Tetrads) ---
  
  // Normalize intervals to 0-11 set to detect shapes regardless of voicing
  const uniqueIntervals = new Set(pcs.map(pc => (pc - rootPC + 12) % 12));
  
  const hasMin3 = uniqueIntervals.has(3);
  const hasMaj3 = uniqueIntervals.has(4);
  const hasPerf5 = uniqueIntervals.has(7);
  const hasMin7 = uniqueIntervals.has(10);
  const hasMaj7 = uniqueIntervals.has(11);
  const hasDim5 = uniqueIntervals.has(6);

  // Basic Triads
  if (hasMaj3 && hasPerf5) return hasMin7 ? `${rootName}7` : rootName; // Major or Dom7
  if (hasMin3 && hasPerf5) return hasMin7 ? `${rootName}m7` : `${rootName}m`; // Minor
  
  // Diminished
  if (hasMin3 && hasDim5) return `${rootName}°`;

  // Augmented
  if (hasMaj3 && uniqueIntervals.has(8)) return `${rootName}+`;

  // Inversion Handling (Simple check: if we didn't find a match, try assuming other notes are root)
  // This is a simplified check for common 1st/2nd inversions if the root position check failed
  if (!hasMaj3 && !hasMin3) {
    // Try treating the second note as root
    // (This logic can be expanded, but keeping it simple for performance)
    return null; 
  }

  return null;
};