// file: types.ts

export enum Direction {
  PUSH = 'push',
  PULL = 'pull'
}

export interface NoteDefinition {
  midi: number;
  label: string;
  type: 'treble' | 'bass' | 'chord';
  chordType?: string;
}

export interface ButtonPosition {
  left: number;
  top: number;
}

export interface LayoutMap {
  [key: string]: ButtonPosition;
}

export interface ChordAnalysis {
  chordName: string;
  description: string;
  notes: string[];
}

export interface SoundSettings {
  // Category 1: Reed Physics & Tuning
  musetteDetune: number;      // 0-50 cents
  reedAttackTime: number;     // 0.001-0.1s
  reedReleaseTime: number;    // 0.05-0.5s
  pitchInstability: number;   // 0-10 cents (random drift)
  bellowsPitchBend: number;   // 0-20 cents (flattening)
  harmonicBrightness: number; // 0.5-2.0 (Waveform shape)
  bassGrowl: number;          // 0-2.0 (Even harmonic boost)
  reedStiffness: number;      // 0.5-2.0 (Attack curve modifier)
  trebleOctaveBalance: number;// 0-1 (Mix of high octave)
  bassOctaveBalance: number;  // 0-1 (Mix of upper bass octave)

  // Category 2: Bellows & Air
  airNoiseLevel: number;      // 0-0.2
  airTurbulence: number;      // 0-1 (LFO on noise)
  bellowsShakeSpeed: number;  // 0-10 Hz
  bellowsShakeDepth: number;  // 0-1 (Amplitude mod)
  dynamicRange: number;       // 0-1 (Compression ratio inverse)
  pushPullVariance: number;   // 0-1 (Timbre shift)

  // Category 3: Mechanics
  buttonClickVolume: number;  // 0-1
  palletThudVolume: number;   // 0-1
  mechanismNoiseRandomness: number; // 0-1
  bassButtonClunk: number;    // 0-1 (Bass click EQ/Pitch)

  // Category 4: Body & Resonance
  boxResonanceFreq: number;   // 200-800 Hz
  boxResonanceAmount: number; // 0-20 dB
  grilleFilterCutoff: number; // 1000-10000 Hz
  cassottoEffect: number;     // 0-1 (Tone chamber simulation)
  bassChamberResonance: number; // 0-20 dB

  // Category 5: Audio Effects & Environment
  tubeSaturation: number;     // 0-100
  inputGain: number;          // 0-2.0 (Pre-amp drive)
  trebleStereoWidth: number;  // 0-1
  bassStereoWidth: number;    // 0-1
  reverbSize: number;         // 0.1-5.0s
  reverbMix: number;          // 0-1
  eqLow: number;              // -20 to +20 dB
  eqMid: number;              // -20 to +20 dB
  eqHigh: number;             // -20 to +20 dB
  
  masterVolume: number;       // 0-1
}

export interface SavedDirectionEvent {
  time: number;
  direction: Direction;
}

export interface MidiProject {
  id: string;
  name: string;
  lastModified: number;
  midiBase64: string;
  bpm: number;
  octaveShift: number;
  semitoneShift: number; // Added
  channelModes: Record<number, 'both' | 'bass' | 'treble' | 'muted'>;
  directionEvents: SavedDirectionEvent[];
  fingeringOverrides?: Record<string, string>; // Key: "midi-time-channel", Value: buttonId
}