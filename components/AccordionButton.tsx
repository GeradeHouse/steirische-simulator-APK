// file: components/AccordionButton.tsx
import React, { useRef, useState, useEffect } from 'react';
import { NoteDefinition, Direction } from '../types';

interface Props {
  pushNote: NoteDefinition;
  pullNote: NoteDefinition;
  direction: Direction;
  isActive: boolean;
  isSelected?: boolean;
  isBass?: boolean;
  isMarked?: boolean;
  isEditing?: boolean;
  idLabel?: string;
  isAlternative?: boolean;
  isGleichton?: boolean;
  onAlternativeClick?: () => void;
  showTooltips?: boolean;
  onPlay: (note: NoteDefinition, direction: Direction) => void;
  onStop: () => void;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  style?: React.CSSProperties;
}

// Helper to separate "C#3 (des)" into { midi: "C#3", german: "des" }
const parseLabel = (fullLabel: string) => {
  const match = fullLabel.match(/^(.+?)\s*\((.+?)\)$/);
  if (match) {
    return { 
      midi: match[1].trim().replace(' Major', ''), 
      german: match[2].trim() 
    };
  }
  return { midi: fullLabel, german: fullLabel };
};

export const AccordionButton: React.FC<Props> = ({
  pushNote,
  pullNote,
  direction,
  isActive,
  isSelected,
  isBass,
  isMarked,
  isEditing,
  idLabel,
  isAlternative,
  isGleichton,
  onAlternativeClick,
  showTooltips = true,
  onPlay,
  onStop,
  onDragStart,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const isInteractionRef = useRef(false);

  const handleStop = () => {
    isInteractionRef.current = false;
    onStop();
  };

  const pushData = parseLabel(pushNote.label);
  const pullData = parseLabel(pullNote.label);

  // --- Styles ---
  const containerStyle = "rounded-full overflow-hidden shadow-sm transition-all duration-75 select-none absolute touch-none flex flex-col aspect-square pointer-events-auto";
  const cursorClass = isEditing ? "cursor-move" : "cursor-pointer";
  
  const borderClass = (isEditing && isSelected) 
    ? "ring-2 ring-blue-500 z-30" 
    : "border border-[#b0a890] hover:border-[#8c8272]";

  const markedClass = (!isEditing && isMarked) ? 'ring-2 ring-red-400/50 ring-offset-1 ring-offset-transparent' : '';

  const getTextStyle = (isActiveDir: boolean) => {
    const weight = isActiveDir ? "font-bold" : "font-normal";
    const size = isBass
      ? (isActiveDir ? "0.45rem" : "0.4rem")
      : (isActiveDir ? "0.5rem" : "0.45rem");
    return `text-[${size}] ${weight} leading-tight`;
  };
  const commonTextClasses = `w-full h-full flex justify-center ${isGleichton ? 'text-white' : 'text-black'}`;

  // Active State Visuals
  const isPushActive = isActive && direction === Direction.PUSH;
  const isPullActive = isActive && direction === Direction.PULL;
  // Changed from yellow to bright blue with a background tint for better visibility
  const activeRingClass = "ring-2 ring-inset ring-blue-600 z-20 shadow-[inset_0_0_15px_rgba(37,99,235,0.5)] bg-blue-400/20";
  const alternativeRingClass = "ring-2 ring-inset ring-blue-300 bg-blue-300/40 z-30";

  // --- 1. Tooltip Delay Logic ---
  // Only show tooltip if the note has been active for >100ms.
  // This prevents tooltips from flashing during fast glissando playing.
  useEffect(() => {
    let timer: number;
    if (isActive && !isEditing) {
      timer = window.setTimeout(() => {
        setShowTooltip(true);
      }, 100); 
    } else {
      setShowTooltip(false);
    }
    return () => clearTimeout(timer);
  }, [isActive, isEditing]);

  // --- 2. Global Safety Check ---
  // If the note is active, watch the GLOBAL mouse position.
  // If the mouse escapes the button rect (even if mouseleave missed it), stop the note.
  useEffect(() => {
    if (!isActive || isEditing) return;

    const handleGlobalMove = (e: MouseEvent) => {
      if (!isInteractionRef.current) return;

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Check if cursor is outside the button
        const isOutside =
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom;
        
        if (isOutside) {
          handleStop();
        }
      }
    };

    const handleGlobalUp = () => {
      if (isInteractionRef.current) {
        handleStop();
      }
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [isActive, isEditing, onStop]);

  // --- Logic Helpers ---

  const getTargetFromEvent = (clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const isTop = relativeY < (rect.height / 2);
    
    return {
      dir: isTop ? Direction.PUSH : Direction.PULL,
      note: isTop ? pushNote : pullNote
    };
  };

  const triggerNote = (clientY: number) => {
    const target = getTargetFromEvent(clientY);
    if (!target) return;

    if (isActive && direction === target.dir) return;

    if (isActive) {
      onStop();
    }

    onPlay(target.note, target.dir);
  };

  // --- Event Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) {
      onDragStart(e);
      return;
    }
    
    // Intercept for alternative selection
    if (isAlternative && onAlternativeClick) {
        e.preventDefault();
        e.stopPropagation();
        onAlternativeClick();
        return;
    }

    if (e.button !== 0) return;
    e.preventDefault();
    isInteractionRef.current = true;
    triggerNote(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (e.buttons === 1) {
      e.preventDefault();
      isInteractionRef.current = true;
      triggerNote(e.clientY);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isEditing) {
      onDragStart(e);
      return;
    }
    e.preventDefault();
    isInteractionRef.current = true;
    triggerNote(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isEditing) return;
    if (e.cancelable) e.preventDefault();
    triggerNote(e.touches[0].clientY);
  };

  return (
    <>
      {/* Main Container */}
      <div
        ref={containerRef}
        className={`${containerStyle} ${cursorClass} ${borderClass} ${markedClass}`}
        style={style}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleStop}
        onMouseLeave={handleStop}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleStop}
        onTouchCancel={handleStop}
        onDragStart={(e) => { if (!isEditing) e.preventDefault(); }}
      >
        {/* Top Half (Push) */}
        <div className={`flex-1 w-full ${isGleichton ? 'bg-[#9C6F44]' : 'bg-[#F8FAEB]'} relative rounded-t-full pointer-events-none border-b border-[#d1cbb8] transition-all duration-75 ${
            isPushActive
              ? activeRingClass
              : (isAlternative && direction === Direction.PUSH ? alternativeRingClass : '')
          }`}>
          <div className={`${commonTextClasses} ${getTextStyle(direction === Direction.PUSH)} items-end pb-[1px]`}>
            {pushData.midi}
          </div>
        </div>

        {/* Bottom Half (Pull) */}
        <div className={`flex-1 w-full ${isGleichton ? 'bg-[#7E5635]' : 'bg-[#E5DDBA]'} relative rounded-b-full pointer-events-none transition-all duration-75 ${
            isPullActive
              ? activeRingClass
              : (isAlternative && direction === Direction.PULL ? alternativeRingClass : '')
          }`}>
          <div className={`${commonTextClasses} ${getTextStyle(direction === Direction.PULL)} items-start pt-[1px]`}>
            {pullData.midi}
          </div>
        </div>

        {/* Debug/Editing ID Label */}
        {idLabel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
             <span className={`bg-white/80 px-1 rounded text-[8px] font-bold text-red-600 ${isActive || isEditing ? 'opacity-100' : 'opacity-0'}`}>
              {idLabel}
            </span>
          </div>
        )}
      </div>
      
      {/* Active Note Pop-up (Debounced) */}
      {showTooltip && showTooltips && !isEditing && (
        <div 
            className="absolute z-50 pointer-events-none select-none"
            style={{ 
                left: style?.left, 
                top: style?.top, 
                width: 'auto',
                transform: 'translate(-50%, -140%)' 
            }}
        >
          <div className="flex flex-col items-center bg-gray-900/90 text-white text-xs rounded px-2 py-1 shadow-xl backdrop-blur-sm whitespace-nowrap">
            <span className="font-bold text-yellow-400">
              {direction === Direction.PUSH ? pushData.german : pullData.german}
            </span>
          </div>
        </div>
      )}
    </>
  );
};