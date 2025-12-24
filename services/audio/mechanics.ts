// file: services/audio/mechanics.ts
import { SoundSettings } from '../../types';
import { MasterChain } from './internalTypes';

export const playMechanicalSound = (
  ctx: AudioContext, 
  masterChain: MasterChain, 
  settings: SoundSettings, 
  time: number, 
  type: 'click' | 'thud', 
  isBass: boolean
) => {
  // 1. Get Base Volume
  let vol = type === 'click' ? settings.buttonClickVolume : settings.palletThudVolume;
  
  // 2. Apply Square Law (makes slider feel more natural)
  vol = vol * vol;

  if (vol <= 0.001) return; // Silence threshold

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Randomness
  const rand = (Math.random() - 0.5) * settings.mechanismNoiseRandomness;
  
  // 3. Calculate Modifiers BEFORE scheduling
  let freqMult = 1.0;
  let volMult = 1.0;
  
  if (isBass && settings.bassButtonClunk > 0) {
      freqMult = (1.0 - settings.bassButtonClunk * 0.4); // Lower pitch
      volMult = (1.0 + settings.bassButtonClunk * 0.5); // Louder
  }

  if (type === 'click') {
      // Sharp click (Attack)
      osc.type = 'sine';
      const baseFreq = isBass ? 150 : 300;
      osc.frequency.setValueAtTime((baseFreq + (rand * 50)) * freqMult, time);
      osc.frequency.exponentialRampToValueAtTime(50, time + 0.05);
      
      filter.type = 'lowpass';
      filter.frequency.value = (isBass ? 800 : 1500) * freqMult;
      
      const peakVol = vol * volMult;
      gain.gain.setValueAtTime(peakVol, time);
      // Use LINEAR ramp to 0 to ensure it actually fades out completely and scales correctly
      gain.gain.linearRampToValueAtTime(0, time + 0.03); 
  } else {
      // Dull thud (Release)
      osc.type = 'triangle';
      const baseFreq = 80;
      osc.frequency.setValueAtTime((baseFreq + (rand * 20)) * freqMult, time);
      osc.frequency.exponentialRampToValueAtTime(20, time + 0.1);
      
      filter.type = 'lowpass';
      filter.frequency.value = 300 * freqMult;
      
      const peakVol = vol * 0.8 * volMult;
      gain.gain.setValueAtTime(peakVol, time);
      // Use LINEAR ramp to 0
      gain.gain.linearRampToValueAtTime(0, time + 0.08); 
  }

  osc.connect(filter).connect(gain).connect(masterChain.preGain);
  osc.start(time);
  osc.stop(time + 0.15);
};