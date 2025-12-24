// file: services/audio/generators.ts
import { SoundSettings } from '../../types';

export const midiToFreq = (midi: number): number => {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

export const makeDistortionCurve = (amount: number): Float32Array => {
  const k = amount;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  if (amount === 0) {
      for (let i = 0; i < n_samples; ++i) curve[i] = (i / n_samples) * 2 - 1;
      return curve;
  }
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
};

export const generateReverbImpulse = (ctx: AudioContext, duration: number): AudioBuffer => {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const decay = Math.pow(1 - i / length, 2); // Exponential decay
    left[i] = (Math.random() * 2 - 1) * decay;
    right[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
};

export const generateNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  const bufferSize = ctx.sampleRate * 2; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    data[i] *= 0.11; 
    b6 = white * 0.115926;
  }
  return buffer;
};

export const generateTrebleWave = (ctx: AudioContext, settings: SoundSettings): PeriodicWave => {
  const numCoeffs = 128;
  const real = new Float32Array(numCoeffs);
  const imag = new Float32Array(numCoeffs);
  for (let n = 1; n < numCoeffs; n++) {
    let amp = 1.0 / Math.pow(n, 2.5 - settings.harmonicBrightness); // Brightness control
    if (n === 3) amp *= 1.5; 
    if (n === 5) amp *= 1.2; 
    imag[n] = amp;
  }
  return ctx.createPeriodicWave(real, imag);
};

export const generateBassWave = (ctx: AudioContext, settings: SoundSettings): PeriodicWave => {
  const numCoeffs = 128;
  const real = new Float32Array(numCoeffs);
  const imag = new Float32Array(numCoeffs);
  for (let n = 1; n < numCoeffs; n++) {
    let amp = 1.0 / Math.pow(n, 0.9); 
    if (n % 2 === 0) amp *= (1.0 + settings.bassGrowl); // Growl control
    imag[n] = amp;
  }
  return ctx.createPeriodicWave(real, imag);
};