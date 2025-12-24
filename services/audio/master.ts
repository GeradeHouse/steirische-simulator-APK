// file: services/audio/master.ts
import { SoundSettings } from '../../types';
import { MasterChain } from './internalTypes';
import { makeDistortionCurve, generateReverbImpulse } from './generators';

export const setupMasterChain = (ctx: AudioContext, settings: SoundSettings): MasterChain => {
  // Chain: PreGain -> Saturation -> EQ -> Reverb/Dry -> Limiter -> Master -> Dest

  const preGain = ctx.createGain();
  preGain.gain.value = settings.inputGain;

  const tubeDistortion = ctx.createWaveShaper();
  // Cast to any to resolve TS mismatch
  tubeDistortion.curve = makeDistortionCurve(0) as any;
  tubeDistortion.oversample = '4x';

  const eqLowNode = ctx.createBiquadFilter();
  eqLowNode.type = 'lowshelf';
  eqLowNode.frequency.value = 200;

  const eqMidNode = ctx.createBiquadFilter();
  eqMidNode.type = 'peaking';
  eqMidNode.frequency.value = 1000;
  eqMidNode.Q.value = 1;

  const eqHighNode = ctx.createBiquadFilter();
  eqHighNode.type = 'highshelf';
  eqHighNode.frequency.value = 3000;

  // Reverb Send
  const reverbNode = ctx.createConvolver();
  reverbNode.buffer = generateReverbImpulse(ctx, settings.reverbSize);
  
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  // Limiter (Compressor) - Now at the end of the chain
  const inputLimiter = ctx.createDynamicsCompressor();
  inputLimiter.threshold.value = -2; // Higher threshold for safety
  inputLimiter.ratio.value = 12;
  inputLimiter.attack.value = 0.003;
  inputLimiter.release.value = 0.25;
  
  const masterGain = ctx.createGain();
  masterGain.gain.value = settings.masterVolume;

  // Connect Graph
  preGain.connect(tubeDistortion);
  tubeDistortion.connect(eqLowNode);
  eqLowNode.connect(eqMidNode);
  eqMidNode.connect(eqHighNode);

  // Split to Dry/Wet
  eqHighNode.connect(dryGain);
  eqHighNode.connect(reverbNode);
  reverbNode.connect(wetGain);

  // Sum to Limiter -> Master
  dryGain.connect(inputLimiter);
  wetGain.connect(inputLimiter);
  inputLimiter.connect(masterGain);
  masterGain.connect(ctx.destination);

  return {
    preGain,
    inputLimiter,
    tubeDistortion,
    eqLowNode,
    eqMidNode,
    eqHighNode,
    reverbNode,
    dryGain,
    wetGain,
    masterGain
  };
};

export const updateMasterChain = (ctx: AudioContext, chain: MasterChain, settings: SoundSettings) => {
  const now = ctx.currentTime;
  
  chain.preGain.gain.setTargetAtTime(settings.inputGain, now, 0.05);
  chain.masterGain.gain.setTargetAtTime(settings.masterVolume, now, 0.05);
  chain.eqLowNode.gain.setTargetAtTime(settings.eqLow, now, 0.1);
  chain.eqMidNode.gain.setTargetAtTime(settings.eqMid, now, 0.1);
  chain.eqHighNode.gain.setTargetAtTime(settings.eqHigh, now, 0.1);
  
  chain.dryGain.gain.setTargetAtTime(1 - settings.reverbMix, now, 0.1);
  chain.wetGain.gain.setTargetAtTime(settings.reverbMix, now, 0.1);

  // Cast to any to resolve TS mismatch
  chain.tubeDistortion.curve = makeDistortionCurve(settings.tubeSaturation) as any;
};