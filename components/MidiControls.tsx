import React, { useState } from 'react';
import {
  PlayIcon, PauseIcon, StopIcon, FolderOpenIcon,
  PlusIcon, MinusIcon, SpeakerWaveIcon, SpeakerXMarkIcon,
  ChevronUpIcon, ChevronDownIcon, ChatBubbleLeftEllipsisIcon, ArrowsUpDownIcon, BoltIcon
} from '@heroicons/react/24/solid';

interface Props {
  player: any; // ReturnType<typeof useMidiPlayer>
  showTooltips: boolean;
  onToggleTooltips: () => void;
  onOpenLibrary: () => void;
}

export const MidiControls: React.FC<Props> = ({ player, showTooltips, onToggleTooltips, onOpenLibrary }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const pressTimer = React.useRef<any>(null);
  const isLongPress = React.useRef(false);

  const handlePressStart = (ch: number) => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        if (window.confirm(`Delete Channel ${ch + 1}? This action cannot be undone.`)) {
            player.deleteChannel(ch);
        }
    }, 800);
  };

  const handlePressEnd = () => {
    if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
    }
  };

  const handleChannelClick = (ch: number) => {
    if (isLongPress.current) return;
    player.cycleChannelMode(ch);
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`absolute left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur border border-gray-300 p-2 rounded-2xl shadow-xl flex items-center gap-3 z-50 transition-all duration-300 max-w-[98vw] overflow-x-auto scrollbar-hide ${isInputFocused ? 'bottom-1/2' : 'bottom-1'}`}>
      
      {/* --- Transport (Always Visible) --- */}
      <div className="flex items-center gap-2 flex-none">
        <button
          onClick={player.togglePlay}
          disabled={!player.fileName}
          className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {player.isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
        </button>

        <button
          onClick={player.resetPlayer}
          disabled={!player.fileName}
          className="p-2 rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          <StopIcon className="w-6 h-6" />
        </button>
      </div>

      {/* --- Divider --- */}
      <div className="w-px h-8 bg-gray-300 flex-none"></div>

      {/* --- Expanded Controls --- */}
      {isExpanded && (
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
          {/* Library / Load Button */}
          <button
            onClick={onOpenLibrary}
            className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-indigo-600 whitespace-nowrap"
          >
            <FolderOpenIcon className="w-5 h-5" />
            {player.fileName ? <span className="max-w-[80px] truncate">{player.fileName}</span> : "Load"}
          </button>

          <div className="w-px h-6 bg-gray-200"></div>

          {/* Channel Selector */}
          {player.availableChannels.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase">CH</span>
              <div className="flex gap-1">
                {player.availableChannels.map((ch: number) => {
                  const mode = player.channelModes[ch] || 'muted';
                  let bgClass = 'bg-gray-200 text-gray-500';
                  if (mode === 'bass') bgClass = 'bg-purple-600 text-white';
                  else if (mode === 'treble') bgClass = 'bg-green-600 text-white';
                  else if (mode === 'hidden') bgClass = 'bg-gray-800 text-gray-400 line-through';

                  return (
                    <button
                      key={ch}
                      onMouseDown={() => handlePressStart(ch)}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={() => handlePressStart(ch)}
                      onTouchEnd={handlePressEnd}
                      onClick={() => handleChannelClick(ch)}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`w-5 h-5 text-[9px] rounded flex items-center justify-center font-bold select-none touch-none ${bgClass}`}
                    >
                      {ch + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="w-px h-6 bg-gray-200"></div>

          {/* Time & BPM */}
          <div className="flex flex-col text-[10px] text-gray-600 font-mono leading-tight">
            <span>{formatTime(player.currentTime)}</span>
            <span>{formatTime(player.totalTime)}</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-gray-500">BPM</span>
            <input
              type="number"
              value={player.bpm}
              onChange={(e) => player.setBpm(Number(e.target.value))}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onTouchStart={() => setIsInputFocused(true)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              enterKeyHint="done"
              className="w-10 px-1 py-0.5 border rounded text-xs text-center"
            />
          </div>

          {/* Octave Shift */}
          <div className="flex items-center border rounded bg-gray-50">
            <button onClick={() => player.setOctaveShift(player.octaveShift - 1)} className="p-1 hover:bg-gray-200 text-gray-600">
              <MinusIcon className="w-3 h-3" />
            </button>
            <span className="text-xs font-mono w-5 text-center" title="Octave Shift">{player.octaveShift > 0 ? '+' : ''}{player.octaveShift}</span>
            <button onClick={() => player.setOctaveShift(player.octaveShift + 1)} className="p-1 hover:bg-gray-200 text-gray-600">
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>

          {/* Semitone Shift */}
          <div className="flex items-center border rounded bg-gray-50">
            <button onClick={() => player.setSemitoneShift(player.semitoneShift - 1)} className="p-1 hover:bg-gray-200 text-gray-600">
              <MinusIcon className="w-3 h-3" />
            </button>
            <span className="text-xs font-mono w-5 text-center" title="Semitone Shift">{player.semitoneShift > 0 ? '+' : ''}{player.semitoneShift}</span>
            <button onClick={() => player.setSemitoneShift(player.semitoneShift + 1)} className="p-1 hover:bg-gray-200 text-gray-600">
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>

          {/* Scrubbing Sound */}
          <button
            onClick={() => player.setIsScrubbingSoundEnabled(!player.isScrubbingSoundEnabled)}
            className={`p-1.5 rounded-full transition-colors ${
              player.isScrubbingSoundEnabled ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'
            }`}
            title="Toggle Scrubbing Sound"
          >
            {player.isScrubbingSoundEnabled ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
          </button>

          {/* Auto Scroll Toggle */}
          <button
            onClick={player.cycleAutoScrollMode}
            className={`p-1.5 rounded-full transition-colors flex items-center gap-1 ${
              player.autoScrollMode === 'treble' ? 'bg-green-100 text-green-700' :
              player.autoScrollMode === 'bass' ? 'bg-purple-100 text-purple-700' :
              'text-gray-400 hover:bg-gray-100'
            }`}
            title={`Auto Scroll: ${player.autoScrollMode ? player.autoScrollMode.charAt(0).toUpperCase() + player.autoScrollMode.slice(1) : 'Off'}`}
          >
            <ArrowsUpDownIcon className="w-4 h-4" />
            <span className="text-[9px] font-bold uppercase w-3 text-center">
                {player.autoScrollMode === 'treble' ? 'T' : player.autoScrollMode === 'bass' ? 'B' : ''}
            </span>
          </button>

          {/* Snap Toggle */}
          <button
            onClick={() => player.setIsNoteSnapEnabled(!player.isNoteSnapEnabled)}
            className={`p-1.5 rounded-full transition-colors ${
              player.isNoteSnapEnabled ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'
            }`}
            title="Toggle Note Snap"
          >
            <BoltIcon className="w-4 h-4" />
          </button>

          {/* Tooltips Toggle */}
          <button
            onClick={onToggleTooltips}
            className={`p-1.5 rounded-full transition-colors ${
              showTooltips ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'
            }`}
            title="Toggle Note Names"
          >
            <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
          </button>
           
          <div className="w-px h-8 bg-gray-300 flex-none"></div>
        </div>
      )}

      {/* --- Toggle Button --- */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-1 text-gray-400 hover:text-gray-600 flex-none"
      >
        {isExpanded ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronUpIcon className="w-5 h-5" />}
      </button>
    </div>
  );
};