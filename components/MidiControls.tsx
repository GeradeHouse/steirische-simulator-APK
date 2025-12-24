import React, { useRef } from 'react';
import { PlayIcon, PauseIcon, StopIcon, FolderOpenIcon, PlusIcon, MinusIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid';

interface Props {
  player: any; // ReturnType<typeof useMidiPlayer>
}

export const MidiControls: React.FC<Props> = ({ player }) => {
  const fileInput = useRef<HTMLInputElement>(null);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-gray-300 p-3 rounded-xl shadow-xl flex items-center gap-4 z-50">
      {/* File Upload */}
      <input 
        type="file" 
        accept=".mid,.midi" 
        ref={fileInput} 
        className="hidden"
        onChange={(e) => e.target.files?.[0] && player.loadMidiFile(e.target.files[0])}
      />
      <button 
        onClick={() => fileInput.current?.click()}
        className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-indigo-600"
      >
        <FolderOpenIcon className="w-5 h-5" />
        {player.fileName ? <span className="max-w-[100px] truncate">{player.fileName}</span> : "Load MIDI"}
      </button>

      <div className="w-px h-8 bg-gray-300"></div>

      {/* Transport */}
      <button 
        onClick={player.togglePlay}
        disabled={!player.fileName}
        className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {player.isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
      </button>

      <button
        onClick={player.resetPlayer}
        disabled={!player.fileName}
        className="p-2 rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50"
      >
        <StopIcon className="w-5 h-5" />
      </button>

      {/* Channel Selector */}
      {player.availableChannels.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">CH</span>
          <div className="flex gap-1 max-w-[150px] overflow-x-auto scrollbar-hide">
            {player.availableChannels.map((ch: number) => {
              const mode = player.channelModes[ch] || 'muted';
              
              let bgClass = 'bg-gray-200 text-gray-500'; // Muted
              if (mode === 'both') bgClass = 'bg-indigo-600 text-white';
              else if (mode === 'bass') bgClass = 'bg-amber-600 text-white';
              else if (mode === 'treble') bgClass = 'bg-emerald-600 text-white';

              return (
                <button
                  key={ch}
                  onClick={() => player.cycleChannelMode(ch)}
                  className={`w-5 h-5 text-[9px] rounded flex items-center justify-center transition-colors font-bold ${bgClass}`}
                  title={`Channel ${ch + 1}: ${mode.toUpperCase()}`}
                >
                  {ch + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="w-px h-8 bg-gray-300"></div>

      {/* Time & BPM */}
      <div className="flex flex-col text-xs text-gray-600 font-mono">
        <span>{formatTime(player.currentTime)} / {formatTime(player.totalTime)}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500">BPM</span>
        <input 
          type="number" 
          value={player.bpm}
          onChange={(e) => player.setBpm(Number(e.target.value))}
          className="w-14 px-1 py-0.5 border rounded text-xs text-center"
        />
      </div>

      {/* Octave Shift */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-bold text-gray-500">OCT</span>
        <div className="flex items-center border rounded bg-gray-50">
          <button
            onClick={() => player.setOctaveShift(player.octaveShift - 1)}
            className="px-1.5 py-0.5 hover:bg-gray-200 text-gray-600"
          >
            <MinusIcon className="w-3 h-3" />
          </button>
          <span className="text-xs font-mono w-6 text-center">{player.octaveShift > 0 ? '+' : ''}{player.octaveShift}</span>
          <button
            onClick={() => player.setOctaveShift(player.octaveShift + 1)}
            className="px-1.5 py-0.5 hover:bg-gray-200 text-gray-600"
          >
            <PlusIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="w-px h-8 bg-gray-300"></div>

      {/* Scrubbing Sound Toggle */}
      <button
        onClick={() => player.setIsScrubbingSoundEnabled(!player.isScrubbingSoundEnabled)}
        className={`p-2 rounded-full transition-colors ${
          player.isScrubbingSoundEnabled
            ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
            : 'text-gray-400 hover:bg-gray-100'
        }`}
        title={player.isScrubbingSoundEnabled ? "Scrubbing Sound ON" : "Scrubbing Sound OFF"}
      >
        {player.isScrubbingSoundEnabled ? (
          <SpeakerWaveIcon className="w-5 h-5" />
        ) : (
          <SpeakerXMarkIcon className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};