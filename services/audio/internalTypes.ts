// file: services/audio/internalTypes.ts
import { SoundSettings } from '../../types';

export interface ActiveVoice {
  sourceNodes: AudioScheduledSourceNode[]; 
  gain: GainNode; 
  nodesToDisconnect: AudioNode[];
  // References for real-time updates
  panner: StereoPannerNode;
  peakFilter: BiquadFilterNode;
  lpFilter: BiquadFilterNode;
  noiseGain: GainNode;
  oscillators: OscillatorNode[]; 
  baseFreq: number; 
  type: 'bass' | 'chord' | 'treble';
  startTime: number;
}

export interface AudioResources {
  trebleWave: PeriodicWave | null;
  bassWave: PeriodicWave | null;
  noiseBuffer: AudioBuffer | null;
}

export interface MasterChain {
  preGain: GainNode;
  inputLimiter: DynamicsCompressorNode;
  tubeDistortion: WaveShaperNode;
  eqLowNode: BiquadFilterNode;
  eqMidNode: BiquadFilterNode;
  eqHighNode: BiquadFilterNode;
  reverbNode: ConvolverNode;
  dryGain: GainNode;
  wetGain: GainNode;
  masterGain: GainNode;
}