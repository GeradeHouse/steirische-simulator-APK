// file: services/audioService.ts
import { SoundSettings, Direction } from '../types';
import { ActiveVoice, AudioResources, MasterChain } from './audio/internalTypes';
import { setupMasterChain, updateMasterChain } from './audio/master';
import { generateTrebleWave, generateBassWave, generateNoiseBuffer } from './audio/generators';
import { playMechanicalSound } from './audio/mechanics';
import { createVoice, updateVoice, stopVoice } from './audio/voice';

class AudioService {
  private context: AudioContext | null = null;
  private masterChain: MasterChain | null = null;
  private activeVoices: Map<string, ActiveVoice> = new Map();
  private resources: AudioResources = {
    trebleWave: null,
    bassWave: null,
    noiseBuffer: null
  };

  // Default Settings (will be overwritten by App)
  private settings: SoundSettings = {
    musetteDetune: 14, reedAttackTime: 0.03, reedReleaseTime: 0.15, pitchInstability: 2, bellowsPitchBend: 0,
    harmonicBrightness: 1.0, bassGrowl: 1.0, reedStiffness: 1.0, trebleOctaveBalance: 0.5, bassOctaveBalance: 0.5,
    airNoiseLevel: 0.03, airTurbulence: 0.5, bellowsShakeSpeed: 5, bellowsShakeDepth: 0, dynamicRange: 1.0, pushPullVariance: 0,
    buttonClickVolume: 0.4, palletThudVolume: 0.3, mechanismNoiseRandomness: 0.2, bassButtonClunk: 0.5,
    boxResonanceFreq: 400, boxResonanceAmount: 4, grilleFilterCutoff: 5000, cassottoEffect: 0, bassChamberResonance: 2,
    tubeSaturation: 0, inputGain: 0.5, trebleStereoWidth: 0.3, bassStereoWidth: 0.1, reverbSize: 1.5, reverbMix: 0.1,
    eqLow: 0, eqMid: 0, eqHigh: 0, masterVolume: 0.4
  };

  constructor() {}

  init() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 1. Setup Master Chain
      this.masterChain = setupMasterChain(this.context, this.settings);

      // 2. Generate Assets
      this.regenerateAssets();
    }
  }

  private regenerateAssets() {
    if (!this.context) return;
    this.resources.trebleWave = generateTrebleWave(this.context, this.settings);
    this.resources.bassWave = generateBassWave(this.context, this.settings);
    if (!this.resources.noiseBuffer) {
      this.resources.noiseBuffer = generateNoiseBuffer(this.context);
    }
  }

  updateSettings(newSettings: SoundSettings) {
    this.settings = newSettings;
    if (!this.context || !this.masterChain) return;
    const now = this.context.currentTime;

    // 1. Update Master Chain
    updateMasterChain(this.context, this.masterChain, this.settings);

    // 2. Regenerate Waveforms (if harmonic params changed)
    // Optimization: Could check if specific params changed, but for now we regen
    this.regenerateAssets();

    // 3. Update Active Voices
    this.activeVoices.forEach(voice => {
      updateVoice(voice, this.settings, now);
    });
  }

  playNote(noteId: string, midi: number, type: 'bass' | 'chord' | 'treble', chordType: 'major' | 'minor' | '7th' | 'none' = 'major', direction: Direction = Direction.PUSH, options?: { duration?: number }) {
    if (!this.context) this.init();
    if (this.activeVoices.has(noteId)) return;
    if (!this.masterChain) return;

    const ctx = this.context!;
    const now = ctx.currentTime;
    const isBass = type === 'bass';

    // 1. Mechanical Click
    playMechanicalSound(ctx, this.masterChain, this.settings, now, 'click', isBass || type === 'chord');

    // 2. Create Voice
    const voice = createVoice(
      ctx,
      this.masterChain,
      this.resources,
      this.settings,
      midi,
      type,
      chordType,
      direction
    );

    this.activeVoices.set(noteId, voice);

    // Auto-stop if duration provided
    if (options?.duration) {
      setTimeout(() => {
        this.stopNote(noteId);
      }, options.duration * 1000);
    }
  }

  stopNote(noteId: string) {
    if (!this.context || !this.masterChain) return;
    const voice = this.activeVoices.get(noteId);
    if (voice) {
      const now = this.context.currentTime;
      
      // Mechanical Release Thud
      playMechanicalSound(this.context, this.masterChain, this.settings, now, 'thud', voice.type === 'bass' || voice.type === 'chord');

      // Stop Voice
      stopVoice(voice, this.context, this.settings);
      
      this.activeVoices.delete(noteId);
    }
  }

  stopAll() {
    this.activeVoices.forEach((_, key) => this.stopNote(key));
  }
}

export const audioService = new AudioService();