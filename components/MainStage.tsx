import React, { useMemo } from 'react';
import { Direction, NoteDefinition, LayoutMap } from '../types';
import { TREBLE_ROWS, BASS_ROWS } from '../constants';
import { AccordionButton } from './AccordionButton';
import { PianoRoll } from './PianoRoll';
import { CANDIDATE_PATHS } from '../helpers/appConfig';
import { DirectionEvent } from '../hooks/useMidiPlayer';
import { getButtonIdsForNote } from '../helpers/midiMap';
import {
  PencilSquareIcon,
  ExclamationTriangleIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';

interface MainStageProps {
  containerRef: React.RefObject<HTMLDivElement>;
  bgImageSrc: string;
  bgStatus: 'loading' | 'loaded' | 'error';
  handleImgError: () => void;
  handleImgLoad: () => void;
  manualPath: string;
  setManualPath: (val: string) => void;
  applyManualPath: (e: React.FormEvent) => void;
  
  layout: LayoutMap;
  direction: Direction;
  activeNotes: Set<string>;
  isEditing: boolean;
  dragTarget: string | null;
  selectedButtonId: string | null;
  handleDragStart: (e: React.MouseEvent | React.TouchEvent, id: string) => void;
  handleNoteStart: (id: string, noteDef: NoteDefinition, type: 'bass' | 'chord' | 'treble', chordType?: any, direction?: Direction) => void;
  handleNoteStop: (id: string) => void;
  handleBgDoubleClick: () => void;
  
  midiData?: {
    notes: any[];
    currentTime: number;
    channelModes: any;
    onSeek: (t: number) => void;
    octaveShift: number;
    directionEvents: DirectionEvent[];
    onUpdateDirections: (updates: any) => void;
    alternativeButtons?: Set<string>;
    onFingeringOverride?: (midi: number, time: number, channel: number, btnId: string) => void;
    isPlaying: boolean;
  };
}

export const MainStage: React.FC<MainStageProps> = ({
  containerRef,
  bgImageSrc,
  bgStatus,
  handleImgError,
  handleImgLoad,
  manualPath,
  setManualPath,
  applyManualPath,
  layout,
  direction,
  activeNotes,
  isEditing,
  dragTarget,
  selectedButtonId,
  handleDragStart,
  handleNoteStart,
  handleNoteStop,
  handleBgDoubleClick,
  midiData
}) => {
  
  const TREBLE_BTN_SIZE = 3.0; 
  const BASS_BTN_SIZE = 3.85;   

  // --- 1. Calculate Active MIDI Highlights (Button -> Piano Roll) ---
  const activeMidiHighlights = useMemo(() => {
    const highlights = new Set<string>();
    
    activeNotes.forEach(id => {
      // Parse ID: type-row-col
      const parts = id.split('-');
      if (parts.length !== 3) return;
      const type = parts[0];
      const r = parseInt(parts[1]);
      const b = parseInt(parts[2]);
      
      const rows = type === 'bass' ? BASS_ROWS : TREBLE_ROWS;
      const def = rows.find(row => row.rowId === r)?.buttons[b];
      
      if (def) {
        // We need to know which direction is active for this button press.
        // The 'direction' prop is the global bellows direction.
        // If the button is pressed, it plays the note corresponding to the global direction.
        const noteDef = direction === Direction.PUSH ? def.push : def.pull;
        highlights.add(`${noteDef.midi}-${direction}`);
      }
    });
    
    return highlights;
  }, [activeNotes, direction]);

  // --- 2. Handle Piano Roll Note Preview (Piano Roll -> Button) ---
  const handlePianoRollPreview = (midi: number, dir: Direction, start: boolean) => {
    const btnIds = getButtonIdsForNote(midi, dir);
    
    btnIds.forEach(id => {
      if (start) {
        // Find definition to get type/chordType
        const parts = id.split('-');
        const typeStr = parts[0];
        const r = parseInt(parts[1]);
        const b = parseInt(parts[2]);
        const rows = typeStr === 'bass' ? BASS_ROWS : TREBLE_ROWS;
        const def = rows.find(row => row.rowId === r)?.buttons[b];
        
        if (def) {
          const noteDef = dir === Direction.PUSH ? def.push : def.pull;
          const type = noteDef.type as any;
          const chordType = noteDef.chordType;
          handleNoteStart(id, { midi, label: 'Preview' }, type, chordType, dir);
        }
      } else {
        handleNoteStop(id);
      }
    });
  };

  const renderButton = (
    id: string,
    mapping: { push: NoteDefinition, pull: NoteDefinition, isMarked?: boolean },
    type: 'treble' | 'bass' | 'chord',
    chordType?: any
  ) => {
    const pos = layout[id] || { left: 50, top: 50 };
    const isActive = activeNotes.has(id);
    const isSelected = id === selectedButtonId;
    const isAlternative = midiData?.alternativeButtons?.has(id);
    const size = type === 'treble' ? TREBLE_BTN_SIZE : BASS_BTN_SIZE;

    // Handle click on alternative button
    const handleAlternativeClick = () => {
        if (!midiData?.onFingeringOverride) return;
        
        // Find the note that triggered this alternative
        const currentMidiNote = midiData.notes.find(n => {
            const start = n.time;
            const end = n.time + n.duration;
            const t = midiData.currentTime;
            if (t >= start && t < end) {
                // Check if this note maps to this button
                const shifted = n.midi + (midiData.octaveShift * 12);
                const noteDef = direction === Direction.PUSH ? mapping.push : mapping.pull;
                return shifted === noteDef.midi;
            }
            return false;
        });

        if (currentMidiNote) {
            midiData.onFingeringOverride(currentMidiNote.midi, currentMidiNote.time, currentMidiNote.channel, id);
        }
    };

    return (
      <AccordionButton
        key={id}
        pushNote={mapping.push}
        pullNote={mapping.pull}
        direction={direction}
        isActive={isActive}
        isSelected={isSelected}
        isBass={type !== 'treble'}
        isMarked={mapping.isMarked}
        isEditing={isEditing}
        idLabel={isEditing ? id : undefined}
        isAlternative={isAlternative}
        onAlternativeClick={handleAlternativeClick}
        style={{
          left: `${pos.left}%`,
          top: `${pos.top}%`,
          width: `${size}%`,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          zIndex: isEditing && (dragTarget === id || isSelected) ? 50 : 10
        }}
        onDragStart={(e) => handleDragStart(e, id)}
        onPlay={(note, dir) => handleNoteStart(id, note, type, chordType, dir)}
        onStop={() => handleNoteStop(id)}
      />
    );
  };

  return (
    <>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 bg-gray-200/50 select-none">
        
        <div 
            ref={containerRef}
            className="relative w-full max-w-6xl aspect-[4/3] bg-white shadow-2xl rounded-xl overflow-hidden border border-gray-300"
            onDoubleClick={handleBgDoubleClick}
        >
          <img 
            src={bgImageSrc}
            alt="Technical Drawing" 
            className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-90 transition-opacity duration-300"
            onError={handleImgError}
            onLoad={handleImgLoad}
          />

          {bgStatus === 'error' && (
             <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded z-50 shadow-lg">
                <div className="flex items-center gap-2 font-bold mb-2">
                    <ExclamationTriangleIcon className="w-6 h-6" />
                    <span>Background Image Failed to Load</span>
                </div>
                <div className="text-sm mb-3 space-y-1">
                    <p>The app could not find the background image. Check the console (F12) for paths.</p>
                    <p className="text-xs">Tried: {CANDIDATE_PATHS.map(p => p.split('/').pop()).join(', ')}</p>
                </div>
                
                <form onSubmit={applyManualPath} className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Paste URL or path here (e.g. /assets/my_photo.jpg)"
                        className="flex-1 border border-red-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-red-500"
                        value={manualPath}
                        onChange={(e) => setManualPath(e.target.value)}
                    />
                    <button type="submit" className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                        Try
                    </button>
                </form>
             </div>
          )}

          {bgStatus === 'loading' && (
             <div className="absolute top-4 left-4 z-50 text-gray-500 text-sm bg-white/90 p-2 rounded shadow backdrop-blur border border-gray-200 flex items-center gap-2">
                <PhotoIcon className="w-4 h-4 animate-pulse" />
                <span>Searching for image: {bgImageSrc}...</span>
             </div>
          )}

          {midiData && (
            <div className="absolute top-[18%] bottom-[18%] left-[23.8%] right-[30.4%] z-0 opacity-90 shadow-2xl">
               <PianoRoll
                  notes={midiData.notes}
                  currentTime={midiData.currentTime}
                  isPlaying={midiData.isPlaying}
                  channelModes={midiData.channelModes}
                  direction={direction}
                  onSeek={midiData.onSeek}
                  octaveShift={midiData.octaveShift}
                  directionEvents={midiData.directionEvents}
                  onUpdateDirections={midiData.onUpdateDirections}
                  activeMidiHighlights={activeMidiHighlights}
                  onNotePreview={handlePianoRollPreview}
                />
            </div>
          )}

          <div className="absolute inset-0 z-10 pointer-events-none">
            {BASS_ROWS.map((row, rIdx) => (
                row.buttons.map((btn, bIdx) => renderButton(
                    `bass-${rIdx}-${bIdx}`, 
                    btn, 
                    btn.push.type === 'bass' ? 'bass' : 'chord',
                    btn.push.type === 'chord' ? btn.push.chordType : undefined
                ))
            ))}

            {TREBLE_ROWS.map((row, rIdx) => (
                row.buttons.map((btn, bIdx) => renderButton(
                    `treble-${rIdx}-${bIdx}`, 
                    btn, 
                    'treble'
                ))
            ))}
          </div>

        </div>
      </div>
      
    </>
  );
};