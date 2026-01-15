import { Direction } from '../../types';

export type ChannelMode = 'both' | 'bass' | 'treble' | 'muted' | 'hidden' | 'chord';

export interface MidiNote {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  channel: number;
  name: string;
}

export interface MidiEvent {
  time: number;
  type: 'noteOn' | 'noteOff' | 'direction';
  midi?: number;
  velocity?: number;
  direction?: Direction;
  id?: string;
  noteType?: 'bass' | 'chord' | 'treble';
  channel?: number;
}

export interface DirectionEvent {
  time: number;
  direction: Direction;
}

export interface ActiveMidiMapping {
  btnId: string;
  channel: number;
  midi: number;
}
