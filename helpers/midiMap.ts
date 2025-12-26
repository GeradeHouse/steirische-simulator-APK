import { BASS_ROWS, TREBLE_ROWS } from '../constants';
import { Direction } from '../types';

// Change: Map to string[] instead of string
type NoteMap = Map<number, string[]>; 

let pushMap: NoteMap | null = null;
let pullMap: NoteMap | null = null;

export const getButtonIdsForNote = (midi: number, direction: Direction): string[] => {
  if (!pushMap || !pullMap) buildMaps();
  
  const map = direction === Direction.PUSH ? pushMap : pullMap;
  return map?.get(midi) || [];
};

// Keep the singular version for backward compatibility if needed, or just use the first one
export const getButtonIdForNote = (midi: number, direction: Direction): string | undefined => {
  const ids = getButtonIdsForNote(midi, direction);
  return ids.length > 0 ? ids[0] : undefined;
};

const buildMaps = () => {
  pushMap = new Map();
  pullMap = new Map();

  const processRows = (rows: any[], prefix: string) => {
    rows.forEach((row, rIdx) => {
      row.buttons.forEach((btn: any, bIdx: number) => {
        const id = `${prefix}-${rIdx}-${bIdx}`;
        
        // Map Push
        if (!pushMap!.has(btn.push.midi)) {
          pushMap!.set(btn.push.midi, []);
        }
        pushMap!.get(btn.push.midi)!.push(id);

        // Map Pull
        if (!pullMap!.has(btn.pull.midi)) {
          pullMap!.set(btn.pull.midi, []);
        }
        pullMap!.get(btn.pull.midi)!.push(id);
      });
    });
  };

  processRows(BASS_ROWS, 'bass');
  processRows(TREBLE_ROWS, 'treble');
};

export const getNoteKey = (midi: number, time: number, channel: number) => {
  return `${midi}-${time.toFixed(3)}-${channel}`;
};