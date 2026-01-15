import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { Direction } from '../../types';

interface Props {
  width: number;
  height: number;
  label: string;
  hasMapping: boolean;
  isHighlighted: boolean;
  isEditing?: boolean;
  isFlashing?: boolean;
  mode: 'bass' | 'treble' | 'muted' | 'chord';
  direction: Direction;
  wobbleId: string;
}

export const HandDrawnNote: React.FC<Props> = ({ width, height, label, hasMapping, isHighlighted, isEditing, isFlashing, mode, direction }) => {
  let border = '#9CA3AF';
  let fill = '#E5E7EB';
  let text = '#374151';

  if (isFlashing) {
    border = '#EC4899'; fill = '#FBCFE8'; text = '#831843';
  } else if (isEditing) {
    border = '#BE185D'; fill = '#F472B6'; text = '#FFFFFF';
  } else {
    // Color Palette: [Border, Fill, Text]
    // Highlighted = Saturated/Bright. Not Highlighted = Dull/Desaturated.
    
    const getColors = (pushColors: string[], pullColors: string[]) => {
        const c = direction === Direction.PUSH ? pushColors : pullColors;
        if (isHighlighted) return { border: c[0], fill: c[1], text: '#FFFFFF' };
        return { border: c[2], fill: c[3], text: c[4] };
    };

    if (mode === 'bass') {
        // Push: Bright Purple, Pull: Deep Purple
        // Format: [BrightBorder, BrightFill, DullBorder, DullFill, DullText]
        const push = ['#9333EA', '#D8B4FE', '#C084FC', '#F3E8FF', '#6B21A8'];
        const pull = ['#7E22CE', '#C4B5FD', '#A855F7', '#E9D5FF', '#581C87'];
        ({ border, fill, text } = getColors(push, pull));
    } else if (mode === 'treble') {
        // Push: Green, Pull: Emerald
        const push = ['#16A34A', '#86EFAC', '#4ADE80', '#DCFCE7', '#14532D'];
        const pull = ['#059669', '#6EE7B7', '#34D399', '#D1FAE5', '#064E3B'];
        ({ border, fill, text } = getColors(push, pull));
    } else if (mode === 'chord') {
        // Push: Orange, Pull: Red-Orange
        const push = ['#EA580C', '#FDBA74', '#FB923C', '#FFEDD5', '#7C2D12'];
        const pull = ['#DC2626', '#FCA5A5', '#F87171', '#FEE2E2', '#7F1D1D'];
        ({ border, fill, text } = getColors(push, pull));
    }
  }
  
  const pad = 2;
  const w = Math.max(0, width - pad * 2);
  const h = Math.max(0, height - pad * 2);

  return (
    <div className="w-full h-full relative">
      <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
        <rect x={pad} y={pad} width={w} height={h} rx="4" fill={fill} stroke={border} strokeWidth="2" />
        <text x="50%" y="50%" dy=".35em" textAnchor="middle" fill={text} fontSize="11px" fontWeight="bold" style={{ pointerEvents: 'none', fontFamily: 'sans-serif' }}>
          {label}
        </text>
      </svg>
      {!hasMapping && mode !== 'muted' && (
        <div className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 shadow-sm z-10">
          <ExclamationTriangleIcon className="w-3 h-3 text-red-600" />
        </div>
      )}
    </div>
  );
};
