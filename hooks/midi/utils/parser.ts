import { Midi } from '@tonejs/midi';
import { Direction } from '../../../types';
import { MidiEvent, MidiNote, DirectionEvent, ChannelMode } from '../types';

export interface ParseResult {
  fileName: string;
  bpm: number;
  totalTime: number;
  allNotes: MidiNote[];
  directionEvents: DirectionEvent[];
  availableChannels: number[];
  initialChannelModes: Record<number, ChannelMode>;
  eventQueue: MidiEvent[];
}

export const parseMidiData = async (buffer: ArrayBuffer, name: string): Promise<ParseResult> => {
  const midi = new Midi(buffer);
  
  let bpm = 120;
  if (midi.header.tempos.length > 0) {
    bpm = Math.round(midi.header.tempos[0].bpm);
  }
  const totalTime = midi.duration;

  const events: MidiEvent[] = [];
  const foundChannels = new Set<number>();
  const initialDirEvents: DirectionEvent[] = [];

  midi.tracks.forEach(track => {
    foundChannels.add(track.channel);
    track.notes.forEach(note => {
      events.push({ time: note.time, type: 'noteOn', midi: note.midi, velocity: note.velocity, channel: track.channel });
      events.push({ time: note.time + note.duration, type: 'noteOff', midi: note.midi, channel: track.channel });
    });
    // @ts-ignore
    const trackEvents = track.events || [];
    trackEvents.forEach((e: any) => {
        if (e.type === 'text' || e.type === 'meta') {
            const text = (e.text || '').toUpperCase();
            if (text.includes('PUSH')) {
                events.push({ time: e.time, type: 'direction', direction: Direction.PUSH });
                initialDirEvents.push({ time: e.time, direction: Direction.PUSH });
            } else if (text.includes('PULL')) {
                events.push({ time: e.time, type: 'direction', direction: Direction.PULL });
                initialDirEvents.push({ time: e.time, direction: Direction.PULL });
            }
        }
    });
  });

  const parsedNotes: MidiNote[] = [];
  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      parsedNotes.push({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        channel: track.channel,
        name: note.name
      });
    });
  });
  parsedNotes.sort((a, b) => a.time - b.time);
  initialDirEvents.sort((a, b) => a.time - b.time);

  const availableChannels = Array.from(foundChannels).sort((a, b) => a - b);
  const initialChannelModes: Record<number, ChannelMode> = {};
  foundChannels.forEach(ch => { initialChannelModes[ch] = 'muted'; });

  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    if (a.type === 'direction' && b.type !== 'direction') return -1;
    if (a.type !== 'direction' && b.type === 'direction') return 1;
    return 0;
  });

  return {
    fileName: name,
    bpm,
    totalTime,
    allNotes: parsedNotes,
    directionEvents: initialDirEvents,
    availableChannels,
    initialChannelModes,
    eventQueue: events
  };
};
