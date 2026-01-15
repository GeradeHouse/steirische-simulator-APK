// file: helpers/musicTheory.ts

// Using mixed naming to keep it compact and recognizable
export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

// Definitions of chord shapes (intervals in semitones relative to root)
const CHORD_SHAPES = [
  { name: '', intervals: [0, 4, 7] },          // Major
  { name: 'm', intervals: [0, 3, 7] },         // Minor
  { name: '7', intervals: [0, 4, 10] },        // Dom7 (Shell - no 5th)
  { name: '7', intervals: [0, 4, 7, 10] },     // Dom7
  { name: 'maj7', intervals: [0, 4, 11] },     // Maj7 (Shell)
  { name: 'maj7', intervals: [0, 4, 7, 11] },  // Maj7
  { name: 'm7', intervals: [0, 3, 10] },       // Min7 (Shell)
  { name: 'm7', intervals: [0, 3, 7, 10] },    // Min7
  { name: '°', intervals: [0, 3, 6] },         // Dim
  { name: '°7', intervals: [0, 3, 6, 9] },     // Full Dim
  { name: '+', intervals: [0, 4, 8] },         // Aug
  { name: '5', intervals: [0, 7] },            // Power Chord
];

/**
 * Analyzes a set of MIDI numbers and returns the Root Pitch Class and Chord Type.
 */
export const analyzeChordStructure = (midiNotes: number[]): { rootPC: number, type: string } | null => {
  if (midiNotes.length < 2) return null;

  // 1. Get unique Pitch Classes (0-11)
  const pcs = Array.from(new Set(midiNotes.map(n => n % 12))).sort((a, b) => a - b);

  // 2. Try 2-note specific logic (Dyads)
  if (pcs.length === 2) {
    const dist = (pcs[1] - pcs[0] + 12) % 12;
    const n1 = pcs[0];
    const n2 = pcs[1];

    // Distance between the two notes
    switch (dist) {
      case 3: return { rootPC: n1, type: 'minor' }; // Minor 3rd -> Implies Minor
      case 4: return { rootPC: n1, type: 'major' }; // Major 3rd -> Implies Major
      case 7: return { rootPC: n1, type: '5' };     // Perfect 5th -> Power chord
      // Inversions
      case 5: return { rootPC: n2, type: 'major' }; // Perfect 4th (G-C) -> C Major
      case 8: return { rootPC: n2, type: 'major' }; // Minor 6th (E-C) -> C Major
      case 9: return { rootPC: n2, type: 'minor' }; // Major 6th (G-E) -> E Minor
      default: break;
    }
  }

  // 3. Shape Matching
  for (let i = 0; i < pcs.length; i++) {
    const rootPC = pcs[i];
    const currentIntervals = pcs.map(pc => (pc - rootPC + 12) % 12).sort((a, b) => a - b);

    for (const shape of CHORD_SHAPES) {
      const isMatch = shape.intervals.every(interval => currentIntervals.includes(interval));
      if (isMatch) {
        // Map internal shape names to standard types
        let type = 'major';
        if (shape.name === 'm' || shape.name === 'm7') type = 'minor';
        else if (shape.name === '7' || shape.name === 'maj7') type = 'major';
        else if (shape.name) type = shape.name;
        
        return { rootPC, type };
      }
    }
  }

  return null;
};

/**
 * Converts a set of MIDI numbers into a compact chord name.
 * Handles inversions and shell voicings (missing 5ths).
 */
export const getCompactChordName = (midiNotes: number[]): string | null => {
  const analysis = analyzeChordStructure(midiNotes);
  if (!analysis) return null;
  
  const rootName = NOTE_NAMES[analysis.rootPC];
  // Convert back to display name if needed, or just use the type
  let suffix = '';
  if (analysis.type === 'minor') suffix = 'm';
  else if (analysis.type === 'major') suffix = '';
  else suffix = analysis.type;

  return `${rootName}${suffix}`;
};
