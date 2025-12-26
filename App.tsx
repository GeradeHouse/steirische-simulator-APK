import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MainStage } from './components/MainStage';
import { SoundControls } from './components/SoundControls';
import { MidiControls } from './components/MidiControls';
import { ProjectLibrary } from './components/ProjectLibrary';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

import { useSoundSettings } from './hooks/useSoundSettings';
import { useLayoutEditor } from './hooks/useLayoutEditor';
import { useAudioController } from './hooks/useAudioController';
import { useBackgroundImage } from './hooks/useBackgroundImage';
import { useMidiPlayer } from './hooks/useMidiPlayer';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- UI State ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<'sound' | 'projects' | null>(null);
  const [showTooltips, setShowTooltips] = useState(false);

  const {
    settings: soundSettings,
    updateSetting,
    resetSetting,
    resetAllSettings
  } = useSoundSettings();

  const {
    layout,
    isEditing,
    setIsEditing,
    selectedButtonId,
    setSelectedButtonId,
    dragTarget,
    handleDragStart,
    saveLayout,
    resetLayout,
    handleImportLayout,
    handleExportLayout
  } = useLayoutEditor(containerRef);

  const audioController = useAudioController(isEditing);
  const {
    direction,
    activeNotes,
    isAiEnabled,
    setIsAiEnabled,
    chordName,
    chordDesc,
    handleNoteStart,
    handleNoteStop
  } = audioController;

  const {
    bgImageSrc,
    bgStatus,
    manualPath,
    setManualPath,
    handleImgError,
    handleImgLoad,
    applyManualPath
  } = useBackgroundImage();

  const midiPlayer = useMidiPlayer(audioController);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportLayout(file);
      e.target.value = '';
    }
  };

  const triggerImport = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleBgDoubleClick = () => {
    if (isEditing) setSelectedButtonId(null);
  };

  return (
    <div className="w-screen h-screen bg-gray-100 overflow-hidden relative select-none">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={onFileChange}
      />

      {/* --- Main Stage (Full Screen) --- */}
      <div className="absolute inset-0 flex flex-col">
        <MainStage
          containerRef={containerRef}
          bgImageSrc={bgImageSrc}
          bgStatus={bgStatus}
          handleImgError={handleImgError}
          handleImgLoad={handleImgLoad}
          manualPath={manualPath}
          setManualPath={setManualPath}
          applyManualPath={applyManualPath}
          layout={layout}
          direction={direction}
          activeNotes={activeNotes}
          isEditing={isEditing}
          dragTarget={dragTarget}
          selectedButtonId={selectedButtonId}
          handleDragStart={handleDragStart}
          handleNoteStart={handleNoteStart}
          handleNoteStop={handleNoteStop}
          handleBgDoubleClick={handleBgDoubleClick}
          showTooltips={showTooltips}
          midiData={{
            notes: midiPlayer.allNotes,
            currentTime: midiPlayer.currentTime,
            channelModes: midiPlayer.channelModes,
            onSeek: midiPlayer.seek,
            octaveShift: midiPlayer.octaveShift,
            semitoneShift: midiPlayer.semitoneShift,
            directionEvents: midiPlayer.directionEvents,
            onUpdateDirections: midiPlayer.updateDirections,
            alternativeButtons: midiPlayer.alternativeButtons,
            onFingeringOverride: midiPlayer.setFingeringOverride,
            isPlaying: midiPlayer.isPlaying,
            editingNote: midiPlayer.editingNote,
            onSelectNote: midiPlayer.selectNote,
            onClearSelection: midiPlayer.clearSelection
          }}
        />
        <MidiControls
          player={midiPlayer}
          showTooltips={showTooltips}
          onToggleTooltips={() => setShowTooltips(!showTooltips)}
        />
      </div>

      {/* --- Floating Menu Button --- */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="absolute top-4 left-4 z-50 p-2.5 bg-white/90 backdrop-blur rounded-full shadow-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        <Bars3Icon className="w-6 h-6" />
      </button>

      {/* --- Main Menu Modal --- */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsMenuOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">Menu</h2>
              <button onClick={() => setIsMenuOpen(false)} className="p-1 text-gray-500"><XMarkIcon className="w-6 h-6"/></button>
            </div>
            
            <div className="p-4 space-y-3">
              <button onClick={() => { setActiveOverlay('sound'); setIsMenuOpen(false); }} className="w-full p-4 bg-indigo-50 text-indigo-900 rounded-xl font-bold text-left hover:bg-indigo-100 transition-colors">
                🎛️ Sound Settings
              </button>
              
              <button onClick={() => { setActiveOverlay('projects'); setIsMenuOpen(false); }} className="w-full p-4 bg-emerald-50 text-emerald-900 rounded-xl font-bold text-left hover:bg-emerald-100 transition-colors">
                📂 MIDI Projects
              </button>

              <div className="border-t border-gray-100 pt-3 mt-2">
                <div className="flex items-center justify-between p-2">
                  <span className="font-medium text-gray-700">Edit Layout</span>
                  <input
                    type="checkbox"
                    checked={isEditing}
                    onChange={(e) => setIsEditing(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600"
                  />
                </div>
                
                {isEditing && (
                  <div className="grid grid-cols-2 gap-2 mt-2 px-2">
                    <button onClick={saveLayout} className="bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">Save Layout</button>
                    <button onClick={resetLayout} className="bg-red-100 text-red-600 py-2 rounded-lg text-sm font-bold">Reset</button>
                    <button onClick={triggerImport} className="col-span-2 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">Import JSON</button>
                    <button onClick={handleExportLayout} className="col-span-2 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">Export JSON</button>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between p-2">
                  <span className="font-medium text-gray-700">AI Analysis</span>
                  <input
                    type="checkbox"
                    checked={isAiEnabled}
                    onChange={(e) => setIsAiEnabled(e.target.checked)}
                    className="w-5 h-5 accent-purple-600"
                  />
                </div>
                {isAiEnabled && (
                  <div className="bg-purple-50 p-3 rounded-lg mt-2 text-center">
                    <div className="font-bold text-purple-900">{chordName || "Waiting for input..."}</div>
                    <div className="text-xs text-purple-700">{chordDesc}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Full Screen Overlays --- */}
      {activeOverlay && (
        <div className="absolute inset-0 z-[55] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-3 border-b bg-gray-50 shadow-sm flex-none">
            <h3 className="font-bold text-lg text-gray-800 pl-2">
              {activeOverlay === 'sound' ? 'Sound Module' : 'MIDI Projects'}
            </h3>
            <button
              onClick={() => setActiveOverlay(null)}
              className="p-2 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {activeOverlay === 'sound' ? (
              <SoundControls
                settings={soundSettings}
                onUpdate={updateSetting}
                onReset={resetSetting}
                onResetAll={resetAllSettings}
              />
            ) : (
              <div className="h-full p-4 overflow-y-auto">
                <ProjectLibrary player={midiPlayer} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}