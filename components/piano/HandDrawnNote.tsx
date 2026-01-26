import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface Props {
  width: number;
  height: number;
  label: string;
  hasMapping: boolean;
  isHighlighted: boolean;
  isEditing?: boolean;
  isFlashing?: boolean;
  baseColor: string;
}

export const HandDrawnNote: React.FC<Props> = ({ 
  width, height, label, hasMapping, isHighlighted, isEditing, isFlashing, baseColor 
}) => {
  let border = baseColor;
  let fill = baseColor;
  let text = '#000000';
  let opacity = 0.4; // Default for inactive notes in the focus mode

  if (isFlashing) {
    border = '#EC4899'; fill = '#FBCFE8'; text = '#831843'; opacity = 1;
  } else if (isEditing) {
    border = '#BE185D'; fill = '#F472B6'; text = '#FFFFFF'; opacity = 1;
  } else if (isHighlighted) {
    // Active: Full Opacity, White Text
    opacity = 1;
    text = '#FFFFFF';
    border = baseColor;
    fill = baseColor;
  } else {
    // Inactive but visible: Semi-transparent
    opacity = 0.4;
    text = '#000000';
    border = baseColor;
    fill = baseColor;
  }
  
  const pad = 2;
  const w = Math.max(0, width - pad * 2);
  const h = Math.max(0, height - pad * 2);

  return (
    <div className="w-full h-full relative">
      <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
        <rect 
          x={pad} y={pad} width={w} height={h} rx="4" 
          fill={fill} stroke={border} strokeWidth="2" 
          fillOpacity={opacity}
          strokeOpacity={Math.min(1, opacity + 0.2)}
        />
        <text 
          x="50%" y="50%" dy=".35em" textAnchor="middle" 
          fill={text} fontSize="11px" fontWeight="bold" 
          style={{ pointerEvents: 'none', fontFamily: 'sans-serif' }}
        >
          {label}
        </text>
      </svg>
      {!hasMapping && !isFlashing && !isEditing && (
        <div className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-sm z-10">
          <ExclamationTriangleIcon className="w-3 h-3 text-red-600" />
        </div>
      )}
    </div>
  );
};