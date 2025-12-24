// file: helpers/appConfig.ts
import { SoundSettings } from '../types';

export const STORAGE_KEY_LAYOUT = 'steirische_layout_v1';
export const STORAGE_KEY_SOUND = 'steirische_sound_v1';
export const FILENAME = 'accordion_line_drawing.jpg';

// Paths to try sequentially if one fails
export const CANDIDATE_PATHS = [
  `assets/${FILENAME}`,      // Standard relative
  `./assets/${FILENAME}`,    // Explicit relative
  `/assets/${FILENAME}`,     // Absolute from root
  `${FILENAME}`,             // Root (if flattened)
  `/${FILENAME}`,            // Absolute root
  `../assets/${FILENAME}`    // Parent relative
];

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  musetteDetune: 14, reedAttackTime: 0.03, reedReleaseTime: 0.15, pitchInstability: 2, bellowsPitchBend: 0,
  harmonicBrightness: 1.0, bassGrowl: 1.0, reedStiffness: 1.0, trebleOctaveBalance: 0.5, bassOctaveBalance: 0.5,
  airNoiseLevel: 0.03, airTurbulence: 0.5, bellowsShakeSpeed: 5, bellowsShakeDepth: 0, dynamicRange: 1.0, pushPullVariance: 0,
  buttonClickVolume: 0.4, palletThudVolume: 0.3, mechanismNoiseRandomness: 0.2, bassButtonClunk: 0.5,
  boxResonanceFreq: 400, boxResonanceAmount: 4, grilleFilterCutoff: 5000, cassottoEffect: 0, bassChamberResonance: 2,
  tubeSaturation: 0, inputGain: 0.5, trebleStereoWidth: 0.3, bassStereoWidth: 0.1, reverbSize: 1.5, reverbMix: 0.1,
  eqLow: 0, eqMid: 0, eqHigh: 0, masterVolume: 0.4
};