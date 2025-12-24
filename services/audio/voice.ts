// file: services/audio/voice.ts
import { SoundSettings, Direction } from '../../types';
import { ActiveVoice, AudioResources, MasterChain } from './internalTypes';
import { midiToFreq } from './generators';

// Helper to create a single oscillator
const createOscillator = (
  ctx: AudioContext, 
  destination: AudioNode, 
  freq: number, 
  baseVol: number, 
  wave: PeriodicWave, 
  tracker: AudioScheduledSourceNode[],
  oscTracker: OscillatorNode[],
  now: number,
  settings: SoundSettings,
  applyLFO: boolean = false,
  fixedDetune: number = 0
) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (wave) osc.setPeriodicWave(wave);
  else osc.type = 'sawtooth';

  osc.frequency.value = freq;
  
  // Pitch Instability + Bellows Bend
  const drift = (Math.random() - 0.5) * settings.pitchInstability;
  const bend = settings.bellowsPitchBend; // Usually negative
  osc.detune.value = fixedDetune + drift - bend;

  // Bellows Shake LFO
  if (settings.bellowsShakeDepth > 0) {
      const shake = ctx.createOscillator();
      shake.frequency.value = settings.bellowsShakeSpeed;
      const shakeGain = ctx.createGain();
      shakeGain.gain.value = settings.bellowsShakeDepth * 10; // Pitch wobble
      shake.connect(shakeGain).connect(osc.detune);
      shake.start(now);
      tracker.push(shake);
      
      // Also modulate volume
      const volShake = ctx.createGain();
      volShake.gain.value = settings.bellowsShakeDepth * 0.2;
      shake.connect(volShake).connect(gain.gain);
  }

  if (applyLFO) {
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5 + Math.random() * 2; 
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4; 
    lfo.connect(lfoGain).connect(osc.detune);
    lfo.start(now);
    tracker.push(lfo);
  }

  const randomLevel = 0.95 + (Math.random() * 0.1);
  gain.gain.value = baseVol * randomLevel;

  const randomOffset = Math.random() * 0.015;

  osc.connect(gain).connect(destination);
  osc.start(now + randomOffset);
  
  tracker.push(osc);
  oscTracker.push(osc);
};

export const createVoice = (
  ctx: AudioContext,
  masterChain: MasterChain,
  resources: AudioResources,
  settings: SoundSettings,
  midi: number,
  type: 'bass' | 'chord' | 'treble',
  chordType: string = 'major',
  direction: Direction = Direction.PUSH
): ActiveVoice => {
  const now = ctx.currentTime;
  const isBass = type === 'bass';

  // 1. Channel Strip
  const envelopeGain = ctx.createGain();
  envelopeGain.gain.setValueAtTime(0, now);

  const panner = ctx.createStereoPanner();
  const width = isBass ? settings.bassStereoWidth : settings.trebleStereoWidth;
  panner.pan.value = (Math.random() * width * 2) - width;

  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = isBass ? 40 : 100;

  const peakFilter = ctx.createBiquadFilter();
  peakFilter.type = 'peaking';
  peakFilter.frequency.value = isBass ? 200 : settings.boxResonanceFreq;
  peakFilter.Q.value = 1.5;
  peakFilter.gain.value = isBass ? settings.bassChamberResonance : settings.boxResonanceAmount;

  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  let cutoff = settings.grilleFilterCutoff;
  if (isBass) cutoff = 800;
  if (settings.cassottoEffect > 0 && !isBass) cutoff *= (1 - settings.cassottoEffect * 0.5);
  lpFilter.frequency.value = cutoff;

  // Push/Pull Variance (Subtle EQ shift)
  if (settings.pushPullVariance > 0) {
      if (direction === Direction.PULL) {
          peakFilter.frequency.value *= 1.1; // Pulling tightens the box slightly
      }
  }

  hpFilter.connect(peakFilter);
  peakFilter.connect(lpFilter);
  lpFilter.connect(panner);
  panner.connect(envelopeGain);
  envelopeGain.connect(masterChain.preGain);

  const sourceNodes: AudioScheduledSourceNode[] = [];
  const oscNodes: OscillatorNode[] = [];
  const nodesToDisconnect: AudioNode[] = [hpFilter, peakFilter, lpFilter, panner, envelopeGain];

  // 2. Air Noise
  const noiseGain = ctx.createGain();
  if (resources.noiseBuffer && settings.airNoiseLevel > 0) {
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = resources.noiseBuffer;
    noiseNode.loop = true;
    
    const baseNoise = isBass ? 1.5 : 1.0;
    noiseGain.gain.value = settings.airNoiseLevel * baseNoise;
    
    // Turbulence LFO
    if (settings.airTurbulence > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.5 + Math.random();
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = settings.airTurbulence * 0.01;
        lfo.connect(lfoGain).connect(noiseGain.gain);
        lfo.start(now);
        sourceNodes.push(lfo);
    }

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1500;
    noiseFilter.Q.value = 1;

    noiseNode.connect(noiseFilter).connect(noiseGain).connect(panner);
    noiseNode.start(now);
    sourceNodes.push(noiseNode);
    nodesToDisconnect.push(noiseGain, noiseFilter);
  }

  // 3. Voice Config
  const freq = midiToFreq(midi);
  const attack = settings.reedAttackTime * settings.reedStiffness;

  if (type === 'bass') {
    envelopeGain.gain.linearRampToValueAtTime(0.95, now + attack * 1.5);
    
    // Reduced gains to prevent clipping (0.6 -> 0.35)
    createOscillator(ctx, hpFilter, freq, 0.35, resources.bassWave!, sourceNodes, oscNodes, now, settings, true, -2);
    createOscillator(ctx, hpFilter, freq, 0.35, resources.bassWave!, sourceNodes, oscNodes, now, settings, true, 2);
    // Octave (0.2 -> 0.15)
    createOscillator(ctx, hpFilter, freq * 2, 0.15 * settings.bassOctaveBalance, resources.bassWave!, sourceNodes, oscNodes, now, settings);

  } else if (type === 'chord') {
    envelopeGain.gain.linearRampToValueAtTime(0.8, now + attack);

    let voicing: [number, number][] = [];
    if (chordType === 'major') voicing = [[0, 0.30], [4, 0.50], [7, 0.50], [12, 0.75], [16, 0.40], [19, 0.35], [24, 0.20]];
    else if (chordType === 'minor') voicing = [[0, 0.30], [3, 0.50], [7, 0.50], [12, 0.75], [15, 0.40], [19, 0.35], [24, 0.20]];
    else voicing = [[0, 0.30], [4, 0.50], [10, 0.45], [12, 0.75], [16, 0.40], [22, 0.30], [24, 0.20]];

    voicing.forEach(([interval, vol], index) => {
      const noteFreq = midiToFreq(midi + interval);
      const useLFO = index === 3;
      // Reduced multiplier (0.25 -> 0.15)
      createOscillator(ctx, hpFilter, noteFreq, vol * 0.15, resources.trebleWave!, sourceNodes, oscNodes, now, settings, useLFO);
    });

  } else {
    // Treble
    envelopeGain.gain.linearRampToValueAtTime(1.0, now + attack);

    // Reduced gains (0.3/0.25 -> 0.2/0.15)
    createOscillator(ctx, hpFilter, freq, 0.2, resources.trebleWave!, sourceNodes, oscNodes, now, settings, true);
    createOscillator(ctx, hpFilter, freq, 0.15, resources.trebleWave!, sourceNodes, oscNodes, now, settings, false, settings.musetteDetune);
    createOscillator(ctx, hpFilter, freq, 0.15, resources.trebleWave!, sourceNodes, oscNodes, now, settings, false, -settings.musetteDetune);
    
    if (settings.trebleOctaveBalance > 0) {
        createOscillator(ctx, hpFilter, freq * 2, 0.1 * settings.trebleOctaveBalance, resources.trebleWave!, sourceNodes, oscNodes, now, settings);
    }
  }

  return { 
    sourceNodes, 
    gain: envelopeGain, 
    nodesToDisconnect,
    panner,
    peakFilter,
    lpFilter,
    noiseGain,
    oscillators: oscNodes,
    baseFreq: freq,
    type,
    startTime: now
  };
};

export const updateVoice = (voice: ActiveVoice, settings: SoundSettings, now: number) => {
  // Box Resonance
  const isBass = voice.type === 'bass';
  const resFreq = isBass ? 200 : settings.boxResonanceFreq;
  const resGain = isBass ? settings.bassChamberResonance : settings.boxResonanceAmount;
  
  voice.peakFilter.frequency.setTargetAtTime(resFreq, now, 0.1);
  voice.peakFilter.gain.setTargetAtTime(resGain, now, 0.1);

  // Grille / Brightness
  let cutoff = settings.grilleFilterCutoff;
  if (isBass) cutoff = 800; // Bass always lower
  if (settings.cassottoEffect > 0 && !isBass) {
    cutoff *= (1 - settings.cassottoEffect * 0.5); // Cassotto muffles highs
  }
  voice.lpFilter.frequency.setTargetAtTime(cutoff, now, 0.1);

  // Air Noise
  const baseNoise = isBass ? 1.5 : 1.0;
  voice.noiseGain.gain.setTargetAtTime(settings.airNoiseLevel * baseNoise, now, 0.1);

  // Musette Detune (Treble/Chord only)
  if (!isBass) {
    voice.oscillators.forEach((osc, idx) => {
       // idx 1 = sharp, idx 2 = flat
       if (idx === 1) osc.detune.setTargetAtTime(settings.musetteDetune + settings.bellowsPitchBend, now, 0.1);
       if (idx === 2) osc.detune.setTargetAtTime(-settings.musetteDetune + settings.bellowsPitchBend, now, 0.1);
       if (idx === 0) osc.detune.setTargetAtTime(settings.bellowsPitchBend, now, 0.1);
    });
  }
};

export const stopVoice = (voice: ActiveVoice, ctx: AudioContext, settings: SoundSettings) => {
  const now = ctx.currentTime;
  
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
  // Use Release Time Setting
  voice.gain.gain.exponentialRampToValueAtTime(0.001, now + settings.reedReleaseTime);

  voice.sourceNodes.forEach(node => node.stop(now + settings.reedReleaseTime + 0.1));
  
  setTimeout(() => {
    voice.gain.disconnect();
    voice.nodesToDisconnect.forEach(node => node.disconnect());
  }, (settings.reedReleaseTime * 1000) + 200);
};