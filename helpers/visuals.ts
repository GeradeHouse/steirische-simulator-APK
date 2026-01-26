// file: helpers/visuals.ts

// Chromatic scale colors (C to B) - High Contrast / No Green
const TREBLE_PALETTE = [
  '#dc2626', // C  - Red
  '#ea580c', // C# - Orange
  '#92400e', // D  - Brown (High contrast vs beige)
  '#0891b2', // D# - Cyan (Replaces Lime)
  '#0284c7', // E  - Sky Blue (Replaces Green)
  '#2563eb', // F  - Royal Blue (Replaces Emerald)
  '#4f46e5', // F# - Indigo
  '#7c3aed', // G  - Violet
  '#c026d3', // G# - Fuchsia
  '#db2777', // A  - Pink
  '#e11d48', // A# - Rose
  '#475569'  // B  - Slate
];

export const getNoteColor = (midi: number, type: 'treble' | 'bass' | 'chord'): string => {
  if (type === 'treble') {
    return TREBLE_PALETTE[midi % 12];
  }
  
  if (type === 'bass') {
    // Purple Gradient (Hue 270). Lightness varies by pitch (36-60 range approx)
    // Map MIDI 36->30% L, MIDI 60->70% L
    const lightness = 30 + ((midi - 36) * 1.6); 
    return `hsl(270, 80%, ${Math.max(25, Math.min(75, lightness))}%)`;
  }
  
  if (type === 'chord') {
    // Orange Gradient (Hue 30). Lightness varies by pitch
    const lightness = 45 + ((midi - 48) * 2);
    return `hsl(30, 90%, ${Math.max(35, Math.min(80, lightness))}%)`;
  }
  
  return '#000000';
};