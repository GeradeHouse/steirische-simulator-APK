// file: components/SoundControls.tsx
import React from 'react';
import { SoundSettings } from '../types';
import { AdjustmentsHorizontalIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Props {
  settings: SoundSettings;
  onUpdate: (key: keyof SoundSettings, value: number) => void;
  onReset: (key: keyof SoundSettings) => void;
  onResetAll: () => void;
}

interface ControlDef {
  key: keyof SoundSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
  unit?: string;
}

const CATEGORIES: { name: string; controls: ControlDef[] }[] = [
  {
    name: "Reed Physics & Tuning",
    controls: [
      { key: "musetteDetune", label: "Musette Detune", min: 0, max: 50, step: 0.5, unit: "ct", tooltip: "Pitch difference between treble reeds (Wetness)." },
      { key: "reedAttackTime", label: "Attack Time", min: 0.001, max: 0.1, step: 0.001, unit: "s", tooltip: "How fast the reed speaks after air hits it." },
      { key: "reedReleaseTime", label: "Release Time", min: 0.05, max: 1.0, step: 0.01, unit: "s", tooltip: "Vibration inertia after button release." },
      { key: "pitchInstability", label: "Pitch Drift", min: 0, max: 10, step: 0.1, unit: "ct", tooltip: "Random organic pitch wandering." },
      { key: "bellowsPitchBend", label: "Bellows Bend", min: 0, max: 20, step: 0.5, unit: "ct", tooltip: "Pitch drop under high pressure." },
      { key: "harmonicBrightness", label: "Harmonic Brightness", min: 0.5, max: 2.5, step: 0.1, tooltip: "Waveform shape: Low=Dull, High=Buzzy." },
      { key: "bassGrowl", label: "Bass Growl", min: 0, max: 3.0, step: 0.1, tooltip: "Boosts even harmonics for Helikon rasp." },
      { key: "reedStiffness", label: "Reed Stiffness", min: 0.5, max: 2.0, step: 0.1, tooltip: "Modulates the attack curve shape." },
      { key: "trebleOctaveBalance", label: "Treble Octave Mix", min: 0, max: 1, step: 0.05, tooltip: "Balance of high octave reeds." },
      { key: "bassOctaveBalance", label: "Bass Octave Mix", min: 0, max: 1, step: 0.05, tooltip: "Balance of upper bass octave." },
    ]
  },
  {
    name: "Bellows & Air",
    controls: [
      { key: "airNoiseLevel", label: "Air Noise", min: 0, max: 0.2, step: 0.001, tooltip: "Hiss of air through valves." },
      { key: "airTurbulence", label: "Air Turbulence", min: 0, max: 1, step: 0.05, tooltip: "Random fluctuations in air noise." },
      { key: "bellowsShakeSpeed", label: "Shake Speed", min: 0, max: 15, step: 0.5, unit: "Hz", tooltip: "Vibrato speed for bellows shake." },
      { key: "bellowsShakeDepth", label: "Shake Depth", min: 0, max: 1, step: 0.05, tooltip: "Intensity of bellows shake." },
      { key: "dynamicRange", label: "Dynamic Range", min: 0, max: 1, step: 0.05, tooltip: "Volume response to pressure." },
      { key: "pushPullVariance", label: "Push/Pull Var", min: 0, max: 1, step: 0.05, tooltip: "Timbre shift between directions." },
    ]
  },
  {
    name: "Mechanics",
    controls: [
      { key: "buttonClickVolume", label: "Click Volume", min: 0, max: 1, step: 0.05, tooltip: "Volume of the button press 'clack'." },
      { key: "palletThudVolume", label: "Thud Volume", min: 0, max: 1, step: 0.05, tooltip: "Volume of the release 'thump'." },
      { key: "mechanismNoiseRandomness", label: "Mech Randomness", min: 0, max: 1, step: 0.05, tooltip: "Variance in mechanical noises." },
      { key: "bassButtonClunk", label: "Bass Clunk", min: 0, max: 1, step: 0.05, tooltip: "Heavier noise for bass buttons." },
    ]
  },
  {
    name: "Body & Resonance",
    controls: [
      { key: "boxResonanceFreq", label: "Box Freq", min: 200, max: 1000, step: 10, unit: "Hz", tooltip: "Wooden body resonant frequency." },
      { key: "boxResonanceAmount", label: "Box Amount", min: 0, max: 20, step: 0.5, unit: "dB", tooltip: "Intensity of wood resonance." },
      { key: "grilleFilterCutoff", label: "Grille Cutoff", min: 1000, max: 10000, step: 100, unit: "Hz", tooltip: "Muffling effect of the grille." },
      { key: "cassottoEffect", label: "Cassotto", min: 0, max: 1, step: 0.05, tooltip: "Tone chamber simulation (nasal/round)." },
      { key: "bassChamberResonance", label: "Bass Chamber", min: 0, max: 20, step: 0.5, unit: "dB", tooltip: "Resonance of the bass cavity." },
    ]
  },
  {
    name: "Effects & Environment",
    controls: [
      { key: "inputGain", label: "Input Drive", min: 0, max: 2.0, step: 0.05, tooltip: "Pre-amp gain. Increase to drive distortion." },
      { key: "tubeSaturation", label: "Saturation", min: 0, max: 100, step: 1, tooltip: "Harmonic distortion/warmth." },
      { key: "trebleStereoWidth", label: "Treble Width", min: 0, max: 1, step: 0.05, tooltip: "Stereo panning spread for treble." },
      { key: "bassStereoWidth", label: "Bass Width", min: 0, max: 1, step: 0.05, tooltip: "Stereo panning spread for bass." },
      { key: "reverbSize", label: "Reverb Size", min: 0.1, max: 5.0, step: 0.1, unit: "s", tooltip: "Room size/decay time." },
      { key: "reverbMix", label: "Reverb Mix", min: 0, max: 1, step: 0.05, tooltip: "Wet/Dry balance." },
      { key: "eqLow", label: "EQ Low", min: -20, max: 20, step: 1, unit: "dB", tooltip: "Bass frequencies." },
      { key: "eqMid", label: "EQ Mid", min: -20, max: 20, step: 1, unit: "dB", tooltip: "Middle frequencies." },
      { key: "eqHigh", label: "EQ High", min: -20, max: 20, step: 1, unit: "dB", tooltip: "Treble frequencies." },
    ]
  }
];

export const SoundControls: React.FC<Props> = ({ settings, onUpdate, onReset, onResetAll }) => {
  return (
    <div className="w-full bg-white border-r border-gray-200 flex flex-col shadow-xl z-30 h-full overflow-y-auto select-none">
      <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800 font-bold">
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
            <span>Sound Module</span>
          </div>
          <button 
            onClick={onResetAll}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Reset All to Default"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3">
           <div className="flex justify-between text-xs mb-1 text-gray-600 font-bold">
            <span>Master Volume</span>
            <span>{Math.round(settings.masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={settings.masterVolume}
            onChange={(e) => onUpdate("masterVolume", parseFloat(e.target.value))}
            onDoubleClick={() => onReset("masterVolume")}
            className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      </div>
      
      <div className="p-4 space-y-6">
        {CATEGORIES.map((cat) => (
          <div key={cat.name}>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3 border-b pb-1">
              {cat.name}
            </h3>
            <div className="space-y-3">
              {cat.controls.map((ctrl) => (
                <div key={ctrl.key} className="group relative">
                  <div className="flex justify-between text-[10px] mb-1 text-gray-600 font-medium items-center">
                    <div className="flex items-center gap-1 cursor-help">
                      <span>{ctrl.label}</span>
                      {/* Tooltip */}
                      <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 bg-gray-800 text-white text-[10px] p-2 rounded shadow-lg z-50 pointer-events-none">
                        {ctrl.tooltip}
                      </div>
                    </div>
                    <span>{settings[ctrl.key]} {ctrl.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    step={ctrl.step}
                    value={settings[ctrl.key]}
                    onChange={(e) => onUpdate(ctrl.key, parseFloat(e.target.value))}
                    onDoubleClick={() => onReset(ctrl.key)}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-500 hover:accent-indigo-500 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-auto p-4 bg-gray-50 text-[10px] text-gray-400 text-center border-t">
        Double-click slider to reset.
      </div>
    </div>
  );
};