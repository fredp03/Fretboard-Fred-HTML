/**
 * Basic JS (Node) script:
 * - asks for Key (major only for now), String (1=high E ... 6=low E), and Fret
 * - returns all DIATONIC closed 7th voicings that include the selected note
 * - excludes drop voicings by checking true closed interval stacks
 * - enforces max fret span <= 4
 *
 * Standard tuning assumed: E A D G B E
 */

// ===================== Pitch / Fretboard =====================
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NOTE_TO_PC = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

// String numbering in your app: 1 = high E, 6 = low E
// MIDI values only used for pitch-order checks
const OPEN_STRING_MIDI = {
  1: 64, // E4
  2: 59, // B3
  3: 55, // G3
  4: 50, // D3
  5: 45, // A2
  6: 40, // E2
};

// Adjacent 4-string sets (low -> high)
const STRING_SETS = [
  [6, 5, 4, 3],
  [5, 4, 3, 2],
  [4, 3, 2, 1],
];

// ===================== Diatonic 7ths in a MAJOR key =====================
const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

const MAJOR_DIATONIC_7THS = [
  { quality: 'maj7', formula: [0, 4, 7, 11] }, // I
  { quality: 'm7',   formula: [0, 3, 7, 10] }, // ii
  { quality: 'm7',   formula: [0, 3, 7, 10] }, // iii
  { quality: 'maj7', formula: [0, 4, 7, 11] }, // IV
  { quality: '7',    formula: [0, 4, 7, 10] }, // V
  { quality: 'm7',   formula: [0, 3, 7, 10] }, // vi
  { quality: 'm7b5', formula: [0, 3, 6, 10] }, // viiø7
];

const INVERSION_NAMES = ['root', '1st', '2nd', '3rd'];
const DEGREE_ORDERS = [
  [1, 3, 5, 7],
  [3, 5, 7, 1],
  [5, 7, 1, 3],
  [7, 1, 3, 5],
];

// ===================== Helpers =====================
function mod12(n) {
  return ((n % 12) + 12) % 12;
}

function pcToName(pc) {
  return CHROMATIC[mod12(pc)];
}

function normaliseKeyInput(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+major$/i, '');
  const pretty = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return Object.prototype.hasOwnProperty.call(NOTE_TO_PC, pretty) ? pretty : null;
}

function getDiatonicMajor7thChords(keyName) {
  const keyPc = NOTE_TO_PC[keyName];
  const scale = MAJOR_SCALE_STEPS.map(step => mod12(keyPc + step));

  return MAJOR_DIATONIC_7THS.map((def, i) => ({
    degree: i + 1,
    rootPc: scale[i],
    root: pcToName(scale[i]),
    quality: def.quality,
    formula: def.formula.slice(),
  }));
}

function fretsForPitchClass(stringNumber, targetPc, maxFret = 24) {
  const openMidi = OPEN_STRING_MIDI[stringNumber];
  const out = [];
  for (let fret = 0; fret <= maxFret; fret++) {
    if (mod12(openMidi + fret) === targetPc) out.push(fret);
  }
  return out;
}

function inversionExpectedIntervals(formula, inversionIndex) {
  const rotated = [
    ...formula.slice(inversionIndex),
    ...formula.slice(0, inversionIndex).map(x => x + 12),
  ];
  return [
    rotated[1] - rotated[0],
    rotated[2] - rotated[1],
    rotated[3] - rotated[2],
  ];
}

function cartesianProduct(arrays) {
  return arrays.reduce(
    (acc, arr) => acc.flatMap(prefix => arr.map(v => [...prefix, v])),
    [[]]
  );
}

// ===================== Core Logic =====================
function getAvailableClosed7thVoicings({
  key,
  stringNumber,       // 1 = high E ... 6 = low E
  fret,
  maxFretSpan = 4,
  maxFret = 24,
}) {
  const keyName = normaliseKeyInput(key);
  if (!keyName) throw new Error(`Unsupported key input: "${key}"`);
  if (!Number.isInteger(stringNumber) || stringNumber < 1 || stringNumber > 6) {
    throw new Error('stringNumber must be an integer from 1 (high E) to 6 (low E).');
  }
  if (!Number.isInteger(fret) || fret < 0 || fret > maxFret) {
    throw new Error(`fret must be an integer from 0 to ${maxFret}.`);
  }

  const selectedMidi = OPEN_STRING_MIDI[stringNumber] + fret;
  const selectedPc = mod12(selectedMidi);

  const chords = getDiatonicMajor7thChords(keyName);
  const results = [];

  for (const chord of chords) {
    const chordPcs = new Set(chord.formula.map(intv => mod12(chord.rootPc + intv)));
    if (!chordPcs.has(selectedPc)) continue;

    const degreeToOffset = {
      1: chord.formula[0],
      3: chord.formula[1],
      5: chord.formula[2],
      7: chord.formula[3],
    };

    for (let inversion = 0; inversion < 4; inversion++) {
      const noteOrder = DEGREE_ORDERS[inversion]; // low -> high
      const targetPcsLowToHigh = noteOrder.map(deg => mod12(chord.rootPc + degreeToOffset[deg]));
      const expectedIntervals = inversionExpectedIntervals(chord.formula, inversion);

      for (const stringSet of STRING_SETS) {
        if (!stringSet.includes(stringNumber)) continue;

        const possibleFretsPerString = stringSet.map((s, idx) =>
          fretsForPitchClass(s, targetPcsLowToHigh[idx], maxFret)
        );

        const combos = cartesianProduct(possibleFretsPerString);
        for (const frets of combos) {
          // Must include the selected exact string/fret
          const selectedIndex = stringSet.indexOf(stringNumber);
          if (frets[selectedIndex] !== fret) continue;

          // Fret-span limit
          const minF = Math.min(...frets);
          const maxF = Math.max(...frets);
          if (maxF - minF > maxFretSpan) continue;

          // Must ascend in actual pitch low->high
          const midis = stringSet.map((s, i) => OPEN_STRING_MIDI[s] + frets[i]);
          if (!(midis[0] < midis[1] && midis[1] < midis[2] && midis[2] < midis[3])) continue;

          // Closed-stack check (rejects drop voicings)
          const actualIntervals = [
            midis[1] - midis[0],
            midis[2] - midis[1],
            midis[3] - midis[2],
          ];
          if (!actualIntervals.every((v, i) => v === expectedIntervals[i])) continue;

          results.push({
            chordRoot: chord.root,
            chordQuality: chord.quality,
            chordInversion: INVERSION_NAMES[inversion],
            noteOrder, // degrees low -> high
            notesLowToHigh: targetPcsLowToHigh.map(pcToName),
            voicing: {
              stringSetLowToHigh: stringSet, // e.g. [5,4,3,2]
              fretsLowToHigh: frets,         // aligned with stringSetLowToHigh
              fretSpan: maxF - minF,
            },
          });
        }
      }
    }
  }

  // Stable sort
  results.sort((a, b) => {
    const aKey = [
      a.chordRoot,
      a.chordQuality,
      a.chordInversion,
      a.voicing.stringSetLowToHigh.join('-'),
      a.voicing.fretsLowToHigh.join('-'),
    ].join('|');
    const bKey = [
      b.chordRoot,
      b.chordQuality,
      b.chordInversion,
      b.voicing.stringSetLowToHigh.join('-'),
      b.voicing.fretsLowToHigh.join('-'),
    ].join('|');
    return aKey.localeCompare(bKey);
  });

  return results;
}

// ===================== Simple Prompt UI (browser OR Node) =====================

// Browser prompt version:
async function runBrowserPrompt() {
  const key = prompt('Key (major only, e.g. C, F#, Bb):', 'C');
  const stringNumber = parseInt(prompt('String number (1 = high E ... 6 = low E):', '2'), 10);
  const fret = parseInt(prompt('Fret number:', '5'), 10);

  const results = getAvailableClosed7thVoicings({ key, stringNumber, fret, maxFretSpan: 4, maxFret: 24 });
  console.log(results);
  alert(`Found ${results.length} voicing(s). Check console for output.`);
}

// Node CLI version:
async function runNodePrompt() {
  const readline = require('node:readline/promises');
  const { stdin: input, stdout: output } = require('node:process');
  const rl = readline.createInterface({ input, output });

  try {
    const key = await rl.question('Key (major only, e.g. C, F#, Bb): ');
    const stringNumber = parseInt(await rl.question('String number (1 = high E ... 6 = low E): '), 10);
    const fret = parseInt(await rl.question('Fret number: '), 10);

    const results = getAvailableClosed7thVoicings({ key, stringNumber, fret, maxFretSpan: 4, maxFret: 24 });
    console.log('\nAvailable voicings:\n');
    console.log(JSON.stringify(results, null, 2));
    if (results.length === 0) {
      console.log('\nNo matches under current rules (major-key diatonic 7ths, closed voicings, <=4 frets).');
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    rl.close();
  }
}

// Auto-run whichever environment you're in:
if (typeof window !== 'undefined' && typeof prompt === 'function') {
  // Browser
  // runBrowserPrompt();
} else if (typeof process !== 'undefined' && process.versions?.node) {
  // Node
  runNodePrompt();
}

// Export for your app usage
if (typeof module !== 'undefined') {
  module.exports = { getAvailableClosed7thVoicings };
}

/*
Example (your case):
Key = C
String = 2 (B string)
Fret = 5

Expected results include:
- Fmaj7 (root position), voicing [5,4,3,2] frets [8,7,5,5]
- Am7  (root position), voicing [4,3,2,1] frets [7,5,5,3]
*/