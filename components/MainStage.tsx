import React, { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Direction, NoteDefinition, LayoutMap } from '../types';
import { TREBLE_ROWS, BASS_ROWS } from '../constants';
import { AccordionButton } from './AccordionButton';
import { PianoRoll } from './PianoRoll';
import { CANDIDATE_PATHS, SPLIT_LEFT_LIMIT, SPLIT_RIGHT_START } from '../helpers/appConfig';
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
  showTooltips: boolean;
  
  midiData?: {
    notes: any[];
    currentTime: number;
    channelModes: any;
    onSeek: (t: number) => void;
    octaveShift: number;
    semitoneShift: number;
    directionEvents: DirectionEvent[];
    onUpdateDirections: (updates: any) => void;
    alternativeButtons?: Set<string>;
    onFingeringOverride?: (midi: number, time: number, channel: number, btnId: string) => void;
    isPlaying: boolean;
    editingNote?: { midi: number, time: number, channel: number } | null;
    onSelectNote?: (note: any) => void;
    onClearSelection?: () => void;
    flashingNotes?: Set<string>;
  };
}

export const MainStage: React.FC<MainStageProps> = ({
  containerRef,
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
  showTooltips,
  midiData
}) => {
  
  const isAndroid = Capacitor.getPlatform() === 'android';
  const TREBLE_BTN_SIZE = isAndroid ? 4.5 : 3.4;
  const BASS_BTN_SIZE = 4.3;

  // Adjust split start for Android (wider image: ~31.7% width vs 24%)
  const effectiveSplitRightStart = isAndroid ? 68.3 : SPLIT_RIGHT_START;

  // --- 1. Calculate Active MIDI Highlights ---
  const activeMidiHighlights = useMemo(() => {
    const highlights = new Set<string>();
    activeNotes.forEach(id => {
      const parts = id.split('-');
      if (parts.length !== 3) return;
      const type = parts[0];
      const r = parseInt(parts[1]);
      const b = parseInt(parts[2]);
      const rows = type === 'bass' ? BASS_ROWS : TREBLE_ROWS;
      const def = rows.find(row => row.rowId === r)?.buttons[b];
      if (def) {
        const noteDef = direction === Direction.PUSH ? def.push : def.pull;
        highlights.add(`${noteDef.midi}-${direction}`);
      }
    });
    return highlights;
  }, [activeNotes, direction]);

  // --- 2. Handle Piano Roll Note Preview ---
  const handlePianoRollPreview = (midi: number, dir: Direction, start: boolean) => {
    const btnIds = getButtonIdsForNote(midi, dir);
    btnIds.forEach(id => {
      if (start) {
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

  // --- 3. Coordinate Transformation Helper ---
  const transformStyle = (id: string, globalLeft: number, globalTop: number, size: number, panel: 'left' | 'right') => {
    let localLeft = 0;
    let localSize = 0;

    if (panel === 'left') {
      // Map 0 -> SPLIT_LEFT_LIMIT to 0 -> 100%
      localLeft = (globalLeft / SPLIT_LEFT_LIMIT) * 100;
      localSize = (size / SPLIT_LEFT_LIMIT) * 100;
    } else {
      // Map SPLIT_RIGHT_START -> 100 to 0 -> 100%
      const rightWidth = 100 - SPLIT_RIGHT_START;
      localLeft = ((globalLeft - SPLIT_RIGHT_START) / rightWidth) * 100;
      localSize = (size / rightWidth) * 100;
    }

    return {
      left: `${localLeft}%`,
      top: `${globalTop}%`, // Top remains relative to height (unchanged)
      width: `${localSize}%`,
      position: 'absolute' as const,
      transform: 'translate(-50%, -50%)',
      zIndex: isEditing && (dragTarget === id || selectedButtonId === id) ? 50 : 10
    };
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
    
    // Determine Panel
    const isBassPanel = id.startsWith('bass');
    const panel = isBassPanel ? 'left' : 'right';
    const style = transformStyle(id, pos.left, pos.top, size, panel);

    const handleAlternativeClick = () => {
        if (!midiData?.onFingeringOverride) return;
        const currentMidiNote = midiData.notes.find(n => {
            const start = n.time;
            const end = n.time + n.duration;
            const t = midiData.currentTime;
            if (t >= start && t < end) {
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
        showTooltips={showTooltips}
        style={style}
        onDragStart={(e) => handleDragStart(e, id)}
        onPlay={(note, dir) => handleNoteStart(id, note, type, chordType, dir)}
        onStop={() => handleNoteStop(id)}
      />
    );
  };

  return (
    <div className="flex-1 relative overflow-hidden flex items-center justify-center p-0 bg-gray-100 select-none">
      
      {/* Main Flex Container */}
      <div
          ref={containerRef}
          className="relative flex w-full h-full max-h-full items-stretch justify-between overflow-hidden"
          onDoubleClick={handleBgDoubleClick}
          onMouseDown={(e) => {
            // Clear selection if clicking background (not buttons)
            if (midiData?.onClearSelection) midiData.onClearSelection();
          }}
      >
        
        {/* --- LEFT PANEL (Bass) --- */}
        <div className="relative h-full flex-none">
          <img 
            src="assets/ui_bass.png" 
            alt="Bass Section" 
            className="h-full w-auto object-contain pointer-events-none select-none"
          />
          {/* Overlay for Buttons */}
          <div className="absolute inset-0 z-10">
            {BASS_ROWS.map((row, rIdx) => (
                row.buttons.map((btn, bIdx) => renderButton(
                    `bass-${rIdx}-${bIdx}`, 
                    btn, 
                    btn.push.type === 'bass' ? 'bass' : 'chord',
                    btn.push.type === 'chord' ? btn.push.chordType : undefined
                ))
            ))}
          </div>
        </div>

        {/* --- MIDDLE PANEL (Bellows + Piano Roll) --- */}
        <div className="relative flex-1 h-full overflow-hidden">
          <img 
            src="assets/ui_bellow.png" 
            alt="Bellows" 
            className="w-full h-full object-fill pointer-events-none select-none opacity-90"
          />
          
          {/* Piano Roll Container */}
          {midiData && (
            <div className={`absolute ${Capacitor.getPlatform() === 'android' ? 'top-[8%] bottom-[8%]' : 'top-[18%] bottom-[18%]'} left-0 right-0 z-0 opacity-90 shadow-inner`}>
               <PianoRoll
                  notes={midiData.notes}
                  currentTime={midiData.currentTime}
                  isPlaying={midiData.isPlaying}
                  channelModes={midiData.channelModes}
                  direction={direction}
                  onSeek={midiData.onSeek}
                  octaveShift={midiData.octaveShift}
                  semitoneShift={midiData.semitoneShift}
                  directionEvents={midiData.directionEvents}
                  onUpdateDirections={midiData.onUpdateDirections}
                  activeMidiHighlights={activeMidiHighlights}
                  onNotePreview={handlePianoRollPreview}
                  editingNote={midiData.editingNote}
                  onSelectNote={midiData.onSelectNote}
                  onClearSelection={midiData.onClearSelection}
                  flashingNotes={midiData.flashingNotes}
                />
            </div>
          )}
        </div>

        {/* --- RIGHT PANEL (Treble) --- */}
        <div className="relative h-full flex-none">
          <img 
            src="assets/ui_trebble.png" 
            alt="Treble Section" 
            className="h-full w-auto object-contain pointer-events-none select-none"
          />
          {/* Overlay for Buttons */}
          <div className="absolute inset-0 z-10">
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
    </div>
  );
};
