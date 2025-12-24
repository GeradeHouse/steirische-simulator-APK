// file: constants.ts
import { NoteDefinition } from './types';

interface ButtonDef {
  push: NoteDefinition;
  pull: NoteDefinition;
}

interface RowDef {
  rowId: number;
  buttons: ButtonDef[];
}

export const BASS_ROWS: RowDef[] = [
  {
    rowId: 0,
    buttons: [
      // bass-0-0: Bass Note -> Push: C#2 (MIDI 37), Pull: G#2 (MIDI 44)
      { 
        push: { midi: 37, label: "C#2 (des)", type: "bass" }, 
        pull: { midi: 44, label: "G#2 (as)", type: "bass" } 
      },
      // bass-0-1: Chord -> Push: C#3 Major, Pull: G#3 Major
      { 
        push: { midi: 49, label: "C#3 Major (Des)", type: "chord", chordType: "major" }, 
        pull: { midi: 56, label: "G#3 Major (As)", type: "chord", chordType: "major" } 
      },
      // bass-0-2: Bass Note -> Push: G#2 (MIDI 44), Pull: D#2 (MIDI 39)
      { 
        push: { midi: 44, label: "G#2 (as)", type: "bass" }, 
        pull: { midi: 39, label: "D#2 (es)", type: "bass" } 
      },
      // bass-0-3: Chord -> Push: G#3 Major, Pull: D#3 Major
      { 
        push: { midi: 56, label: "G#3 Major (As)", type: "chord", chordType: "major" }, 
        pull: { midi: 51, label: "D#3 Major (Es)", type: "chord", chordType: "major" } 
      },
      // bass-0-4: Bass Note -> Push: D#2 (MIDI 39), Pull: A#2 (MIDI 46)
      { 
        push: { midi: 39, label: "D#2 (es)", type: "bass" }, 
        pull: { midi: 46, label: "A#2 (b)", type: "bass" } 
      },
      // bass-0-5: Chord -> Push: D#3 Major, Pull: A#2 Major
      { 
        push: { midi: 51, label: "D#3 Major (Es)", type: "chord", chordType: "major" }, 
        pull: { midi: 46, label: "A#2 Major (B)", type: "chord", chordType: "major" } 
      },
      // bass-0-6: Bass Note -> Push: A#2 (MIDI 46), Pull: F2 (MIDI 41)
      { 
        push: { midi: 46, label: "A#2 (b)", type: "bass" }, 
        pull: { midi: 41, label: "F2 (f)", type: "bass" } 
      },
      // bass-0-7: Chord -> Push: A#2 Major, Pull: F3 Major
      { 
        push: { midi: 46, label: "A#2 Major (B)", type: "chord", chordType: "major" }, 
        pull: { midi: 53, label: "F3 Major (F)", type: "chord", chordType: "major" } 
      },
    ]
  },
  {
    rowId: 1,
    buttons: [
      // bass-1-0: Bass Note -> Push: F2 (MIDI 41), Pull: F#2 (MIDI 42)
      { 
        push: { midi: 41, label: "F2 (f)", type: "bass" }, 
        pull: { midi: 42, label: "F#2 (ges)", type: "bass" } 
      },
      // bass-1-1: Chord -> Push: F3 Major, Pull: F#3 Major
      { 
        push: { midi: 53, label: "F3 Major (F)", type: "chord", chordType: "major" }, 
        pull: { midi: 54, label: "F#3 Major (Ges)", type: "chord", chordType: "major" } 
      },
      // bass-1-2: Bass Note -> Push: C2 (MIDI 36), Pull: C#2 (MIDI 37)
      { 
        push: { midi: 36, label: "C2 (c)", type: "bass" }, 
        pull: { midi: 37, label: "C#2 (des)", type: "bass" } 
      },
      // bass-1-3: Chord -> Push: C3 Major, Pull: C#3 Major
      { 
        push: { midi: 48, label: "C3 Major (C)", type: "chord", chordType: "major" }, 
        pull: { midi: 49, label: "C#3 Major (Des)", type: "chord", chordType: "major" } 
      },
      // bass-1-4: Bass Note -> Push: G2 (MIDI 43), Pull: G#2 (MIDI 44)
      { 
        push: { midi: 43, label: "G2 (g)", type: "bass" }, 
        pull: { midi: 44, label: "G#2 (as)", type: "bass" } 
      },
      // bass-1-5: Chord -> Push: G3 Major, Pull: A#2 Major
      { 
        push: { midi: 55, label: "G3 Major (G)", type: "chord", chordType: "major" }, 
        pull: { midi: 46, label: "A#2 Major (B)", type: "chord", chordType: "major" } 
      },
      // bass-1-6: Bass Note -> Push: C#2 (MIDI 37), Pull: C2 (MIDI 36)
      { 
        push: { midi: 37, label: "C#2 (des)", type: "bass" }, 
        pull: { midi: 36, label: "C2 (c)", type: "bass" } 
      },
    ]
  }
];

export const TREBLE_ROWS: RowDef[] = [
  {
    rowId: 0,
    buttons: [
      // treble-0-0: Push: C#7 (des''''), Pull: A#6 (b''')
      { push: { midi: 97, label: "C#7 (des'''')", type: "treble" }, pull: { midi: 94, label: "A#6 (b''')", type: "treble" } },
      // treble-0-1: Push: G#6 (as'''), Pull: F#6 (ges''')
      { push: { midi: 92, label: "G#6 (as''')", type: "treble" }, pull: { midi: 90, label: "F#6 (ges''')", type: "treble" } },
      // treble-0-2: Push: F6 (f'''), Pull: D#6 (es''')
      { push: { midi: 89, label: "F6 (f''')", type: "treble" }, pull: { midi: 87, label: "D#6 (es''')", type: "treble" } },
      // treble-0-3: Push: C#6 (des'''), Pull: C6 (c''')
      { push: { midi: 85, label: "C#6 (des''')", type: "treble" }, pull: { midi: 84, label: "C6 (c''')", type: "treble" } },
      // treble-0-4: Push: G#5 (as''), Pull: G#5 (as'')
      { push: { midi: 80, label: "G#5 (as'')", type: "treble" }, pull: { midi: 80, label: "G#5 (as'')", type: "treble" } },
      // treble-0-5: Push: F5 (f''), Pull: F#5 (ges'')
      { push: { midi: 77, label: "F5 (f'')", type: "treble" }, pull: { midi: 78, label: "F#5 (ges'')", type: "treble" } },
      // treble-0-6: Push: C#5 (des''), Pull: D#5 (es'')
      { push: { midi: 73, label: "C#5 (des'')", type: "treble" }, pull: { midi: 75, label: "D#5 (es'')", type: "treble" } },
      // treble-0-7: Push: G#4 (as'), Pull: C5 (c'')
      { push: { midi: 68, label: "G#4 (as')", type: "treble" }, pull: { midi: 72, label: "C5 (c'')", type: "treble" } },
      // treble-0-8: Push: F4 (f'), Pull: G#4 (as')
      { push: { midi: 65, label: "F4 (f')", type: "treble" }, pull: { midi: 68, label: "G#4 (as')", type: "treble" } },
      // treble-0-9: Push: C#4 (des'), Pull: F#4 (ges')
      { push: { midi: 61, label: "C#4 (des')", type: "treble" }, pull: { midi: 66, label: "F#4 (ges')", type: "treble" } },
    ]
  },
  {
    rowId: 1,
    buttons: [
      // treble-1-0: Push: C7 (c''''), Pull: G6 (g''')
      { push: { midi: 96, label: "C7 (c'''')", type: "treble" }, pull: { midi: 91, label: "G6 (g''')", type: "treble" } },
      // treble-1-1: Push: G#6 (as'''), Pull: F6 (f''')
      { push: { midi: 92, label: "G#6 (as''')", type: "treble" }, pull: { midi: 89, label: "F6 (f''')", type: "treble" } },
      // treble-1-2: Push: D#6 (es'''), Pull: C#6 (des''')
      { push: { midi: 87, label: "D#6 (es''')", type: "treble" }, pull: { midi: 85, label: "C#6 (des''')", type: "treble" } },
      // treble-1-3: Push: C6 (c'''), Pull: A#5 (b'')
      { push: { midi: 84, label: "C6 (c''')", type: "treble" }, pull: { midi: 82, label: "A#5 (b'')", type: "treble" } },
      // treble-1-4: Push: G#5 (as''), Pull: G5 (g'')
      { push: { midi: 80, label: "G#5 (as'')", type: "treble" }, pull: { midi: 79, label: "G5 (g'')", type: "treble" } },
      // treble-1-5: Push: D#5 (es''), Pull: D#5 (es'')
      { push: { midi: 75, label: "D#5 (es'')", type: "treble" }, pull: { midi: 75, label: "D#5 (es'')", type: "treble" } },
      // treble-1-6: Push: C5 (c''), Pull: C#5 (des'')
      { push: { midi: 72, label: "C5 (c'')", type: "treble" }, pull: { midi: 73, label: "C#5 (des'')", type: "treble" } },
      // treble-1-7: Push: G#4 (as'), Pull: A#4 (b')
      { push: { midi: 68, label: "G#4 (as')", type: "treble" }, pull: { midi: 70, label: "A#4 (b')", type: "treble" } },
      // treble-1-8: Push: D#4 (es'), Pull: G4 (g')
      { push: { midi: 63, label: "D#4 (es')", type: "treble" }, pull: { midi: 67, label: "G4 (g')", type: "treble" } },
      // treble-1-9: Push: C4 (c'), Pull: D#4 (es')
      { push: { midi: 60, label: "C4 (c')", type: "treble" }, pull: { midi: 63, label: "D#4 (es')", type: "treble" } },
      // treble-1-10: Push: G#3 (as), Pull: C#4 (des')
      { push: { midi: 56, label: "G#3 (as)", type: "treble" }, pull: { midi: 61, label: "C#4 (des')", type: "treble" } },
    ]
  },
  {
    rowId: 2,
    buttons: [
      // treble-2-0: Push: A#6 (b'''), Pull: F6 (f''')
      { push: { midi: 94, label: "A#6 (b''')", type: "treble" }, pull: { midi: 89, label: "F6 (f''')", type: "treble" } },
      // treble-2-1: Push: G6 (g'''), Pull: D6 (d''')
      { push: { midi: 91, label: "G6 (g''')", type: "treble" }, pull: { midi: 86, label: "D6 (d''')", type: "treble" } },
      // treble-2-2: Push: D#6 (es'''), Pull: C6 (c''')
      { push: { midi: 87, label: "D#6 (es''')", type: "treble" }, pull: { midi: 84, label: "C6 (c''')", type: "treble" } },
      // treble-2-3: Push: A#5 (b''), Pull: G#5 (as'')
      { push: { midi: 82, label: "A#5 (b'')", type: "treble" }, pull: { midi: 80, label: "G#5 (as'')", type: "treble" } },
      // treble-2-4: Push: G5 (g''), Pull: F5 (f'')
      { push: { midi: 79, label: "G5 (g'')", type: "treble" }, pull: { midi: 77, label: "F5 (f'')", type: "treble" } },
      // treble-2-5: Push: D#5 (es''), Pull: D5 (d'')
      { push: { midi: 75, label: "D#5 (es'')", type: "treble" }, pull: { midi: 74, label: "D5 (d'')", type: "treble" } },
      // treble-2-6: Push: A#4 (b'), Pull: A#4 (b')
      { push: { midi: 70, label: "A#4 (b')", type: "treble" }, pull: { midi: 70, label: "A#4 (b')", type: "treble" } },
      // treble-2-7: Push: G4 (g'), Pull: G#4 (as')
      { push: { midi: 67, label: "G4 (g')", type: "treble" }, pull: { midi: 68, label: "G#4 (as')", type: "treble" } },
      // treble-2-8: Push: D#4 (es'), Pull: F4 (f')
      { push: { midi: 63, label: "D#4 (es')", type: "treble" }, pull: { midi: 65, label: "F4 (f')", type: "treble" } },
      // treble-2-9: Push: A#3 (b), Pull: D4 (d')
      { push: { midi: 58, label: "A#3 (b)", type: "treble" }, pull: { midi: 62, label: "D4 (d')", type: "treble" } },
      // treble-2-10: Push: G3 (g), Pull: A#3 (b)
      { push: { midi: 55, label: "G3 (g)", type: "treble" }, pull: { midi: 58, label: "A#3 (b)", type: "treble" } },
      // treble-2-11: Push: D#3 (es), Pull: G#3 (as)
      { push: { midi: 51, label: "D#3 (es)", type: "treble" }, pull: { midi: 56, label: "G#3 (as)", type: "treble" } },
    ]
  },
  {
    rowId: 3,
    buttons: [
      // treble-3-0: Push: A#6 (b'''), Pull: D#6 (es''')
      { push: { midi: 94, label: "A#6 (b''')", type: "treble" }, pull: { midi: 87, label: "D#6 (es''')", type: "treble" } },
      // treble-3-1: Push: F6 (f'''), Pull: C6 (c''')
      { push: { midi: 89, label: "F6 (f''')", type: "treble" }, pull: { midi: 84, label: "C6 (c''')", type: "treble" } },
      // treble-3-2: Push: D6 (d'''), Pull: A5 (a'')
      { push: { midi: 86, label: "D6 (d''')", type: "treble" }, pull: { midi: 81, label: "A5 (a'')", type: "treble" } },
      // treble-3-3: Push: A#5 (b''), Pull: G5 (g'')
      { push: { midi: 82, label: "A#5 (b'')", type: "treble" }, pull: { midi: 79, label: "G5 (g'')", type: "treble" } },
      // treble-3-4: Push: F5 (f''), Pull: D#5 (es'')
      { push: { midi: 77, label: "F5 (f'')", type: "treble" }, pull: { midi: 75, label: "D#5 (es'')", type: "treble" } },
      // treble-3-5: Push: D5 (d''), Pull: C5 (c'')
      { push: { midi: 74, label: "D5 (d'')", type: "treble" }, pull: { midi: 72, label: "C5 (c'')", type: "treble" } },
      // treble-3-6: Push: A#4 (b'), Pull: A4 (a')
      { push: { midi: 70, label: "A#4 (b')", type: "treble" }, pull: { midi: 69, label: "A4 (a')", type: "treble" } },
      // treble-3-7: Push: F4 (f'), Pull: G4 (g')
      { push: { midi: 65, label: "F4 (f')", type: "treble" }, pull: { midi: 67, label: "G4 (g')", type: "treble" } },
      // treble-3-8: Push: D4 (d'), Pull: D#4 (es')
      { push: { midi: 62, label: "D4 (d')", type: "treble" }, pull: { midi: 63, label: "D#4 (es')", type: "treble" } },
      // treble-3-9: Push: A#3 (b), Pull: C4 (c')
      { push: { midi: 58, label: "A#3 (b)", type: "treble" }, pull: { midi: 60, label: "C4 (c')", type: "treble" } },
      // treble-3-10: Push: F3 (f), Pull: A3 (a)
      { push: { midi: 53, label: "F3 (f)", type: "treble" }, pull: { midi: 57, label: "A3 (a)", type: "treble" } },
      // treble-3-11: Push: D3 (d), Pull: F3 (f)
      { push: { midi: 50, label: "D3 (d)", type: "treble" }, pull: { midi: 53, label: "F3 (f)", type: "treble" } },
      // treble-3-12: Push: A#2 (B), Pull: D#3 (es)
      { push: { midi: 46, label: "A#2 (B)", type: "treble" }, pull: { midi: 51, label: "D#3 (es)", type: "treble" } },
    ]
  }
];