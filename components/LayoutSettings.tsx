import React from 'react';
import { LayoutSettings as ILayoutSettings } from '../types';
import { XMarkIcon, ArrowPathIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline';

interface Props {
  settings: ILayoutSettings;
  onUpdate: (key: keyof ILayoutSettings, value: number) => void;
  onReset: () => void;
  onClose: () => void;
}

const NumberControl: React.FC<{ 
  label: string; 
  value: number; 
  step: number; 
  onChange: (val: number) => void; 
  unit?: string;
}> = ({ label, value, step, onChange, unit }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
    <span className="text-xs font-medium text-gray-700">{label}</span>
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Number((value - step).toFixed(2)))} className="p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">
        <MinusIcon className="w-3 h-3" />
      </button>
      <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-2 py-0.5 w-16 justify-center">
        <input 
          type="number" 
          value={value} 
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-transparent text-center text-xs font-mono outline-none"
        />
        {unit && <span className="text-[10px] text-gray-400 ml-1">{unit}</span>}
      </div>
      <button onClick={() => onChange(Number((value + step).toFixed(2)))} className="p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">
        <PlusIcon className="w-3 h-3" />
      </button>
    </div>
  </div>
);

export const LayoutSettings: React.FC<Props> = ({ settings, onUpdate, onReset, onClose }) => {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 shadow-sm flex-none">
        <h3 className="font-bold text-lg text-gray-800 pl-2">Layout Settings</h3>
        <button onClick={onClose} className="p-2 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100">
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Piano Roll Defaults</h4>
          <div className="bg-white rounded-lg border border-gray-200 px-3">
            <NumberControl label="Default Note Height" value={settings.defaultNoteHeight} step={1} unit="px" onChange={(v) => onUpdate('defaultNoteHeight', v)} />
            <NumberControl label="Default Width (Speed)" value={settings.defaultPxPerSec} step={10} unit="px/s" onChange={(v) => onUpdate('defaultPxPerSec', v)} />
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Button Typography</h4>
          <div className="bg-white rounded-lg border border-gray-200 px-3">
            <NumberControl label="Active Font Size" value={settings.activeFontSize} step={0.05} unit="rem" onChange={(v) => onUpdate('activeFontSize', v)} />
            <NumberControl label="Inactive Font Size" value={settings.inactiveFontSize} step={0.05} unit="rem" onChange={(v) => onUpdate('inactiveFontSize', v)} />
            <NumberControl label="Label Vertical Offset" value={settings.labelVerticalOffset} step={1} unit="px" onChange={(v) => onUpdate('labelVerticalOffset', v)} />
          </div>
        </section>

        <button 
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors font-bold text-xs"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};