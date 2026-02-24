/**
 * Basic JS (Node) script:
 * - asks for Key (major only for now), String (1=high E ... 6=low E), and Fret
 * - asks for string-group filter: Top / Middle / Bottom (comma-separated allowed)
 * - returns all DIATONIC 7th-chord voicings in DROP 2 (all inversions included)
 * - enforces max fret span <= 5
 * - prints formatted output like:
 *   1. G7 - 2nd Inv Drop 2 - 5 1 3 b7 - R5 - [ 10 9 7 6 ]
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
const OPEN_STRING_MIDI = {
  1: 64, // E4 (high E)
  2: 59, // B3
  3: 55, // G3
  4: 50, // D3
  5: 45, // A2
  6: 40, // E2 (low E)
};

// Named adjacent 4-string sets (low -> high)
const STRING_SET_PRESETS = {
  bottom: [6, 5, 4, 3], // Low E A D G
  middle: [5, 4, 3, 2], // A D G B
  top: [4, 3, 2, 1],    // D G B E
};

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

// Closed-position inversion note orders (low -> high)
const CLOSED_DEGREE_ORDERS = [
  [1, 3, 5, 7], // root position
  [3, 5, 7, 1], // 1st inversion
  [5, 7, 1, 3], // 2nd inversion
  [7, 1, 3, 5], // 3rd inversion
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

function cartesianProduct(arrays) {
  return arrays.reduce(
    (acc, arr) => acc.flatMap(prefix => arr.map(v => [...prefix, v])),
    [[]]
  );
}

// Build the absolute semitone layout (relative to root=0) for a CLOSED 7th inversion.
// Example root-position maj7 -> [0,4,7,11]
// Example 2nd inversion dominant7 -> [7,10,12,16]
function closedInversionAbsFormula(formula, inversionIndex) {
  return [
    ...formula.slice(inversionIndex),
    ...formula.slice(0, inversionIndex).map(x => x + 12),
  ];
}

// Given a closed inversion absolute layout [a,b,c,d], create DROP 2 by dropping c (2nd highest) one octave:
// result order low->high becomes [c-12, a, b, d]
function drop2AbsFromClosedAbs(closedAbs) {
  return [closedAbs[2] - 12, closedAbs[0], closedAbs[1], closedAbs[3]];
}

function intervalsFromAbs(absArray) {
  return [
    absArray[1] - absArray[0],
    absArray[2] - absArray[1],
    absArray[3] - absArray[2],
  ];
}

// Degree order (low->high) for drop2 derived from a closed inversion degree order [a,b,c,d]
// Drop2 -> [c, a, b, d]
function drop2DegreeOrderFromClosedOrder(closedOrder) {
  return [closedOrder[2], closedOrder[0], closedOrder[1], closedOrder[3]];
}

function inversionNameFromBassDegree(deg) {
  switch (deg) {
    case 1: return 'Root';
    case 3: return '1st';
    case 5: return '2nd';
    case 7: return '3rd';
    default: return `${deg}`;
  }
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function stringSetLabelFromArray(setArr) {
  if (arraysEqual(setArr, STRING_SET_PRESETS.top)) return 'top';
  if (arraysEqual(setArr, STRING_SET_PRESETS.middle)) return 'middle';
  if (arraysEqual(setArr, STRING_SET_PRESETS.bottom)) return 'bottom';
  return 'custom';
}

/**
 * Parse user input like:
 * - "Top"
 * - "Top, Bottom"
 * - "middle bottom"
 * - "t,b"
 * Blank => all groups
 */
function parseStringGroupInput(raw) {
  if (!raw || !raw.trim()) return ['top', 'middle', 'bottom'];

  const tokens = raw
    .toLowerCase()
    .split(/[,\s]+/)
    .map(t => t.trim())
    .filter(Boolean);

  const out = [];
  for (const token of tokens) {
    let canon = null;
    if (token === 'top' || token === 't') canon = 'top';
    else if (token === 'middle' || token === 'mid' || token === 'm') canon = 'middle';
    else if (token === 'bottom' || token === 'bot' || token === 'b') canon = 'bottom';

    if (canon && !out.includes(canon)) out.push(canon);
  }

  if (out.length === 0) {
    throw new Error('Invalid string-group input. Use Top, Middle, Bottom (comma-separated allowed).');
  }

  return out;
}

function resolveStringSets(groupChoices) {
  const groups = groupChoices && groupChoices.length ? groupChoices : ['top', 'middle', 'bottom'];
  return groups.map(g => STRING_SET_PRESETS[g]);
}

// ===================== Display formatting =====================
function chordSymbol(root, quality) {
  switch (quality) {
    case 'maj7': return `${root}maj7`;
    case 'm7': return `${root}m7`;
    case '7': return `${root}7`;
    case 'm7b5': return `${root}m7b5`;
    default: return `${root}${quality}`;
  }
}

function degreeLabelsForVoicing(quality, noteOrder) {
  const degreeMapByQuality = {
    maj7:  { 1: '1',  3: '3',  5: '5',  7: '7'  },
    '7':   { 1: '1',  3: '3',  5: '5',  7: 'b7' },
    m7:    { 1: '1',  3: 'b3', 5: '5',  7: 'b7' },
    m7b5:  { 1: '1',  3: 'b3', 5: 'b5', 7: 'b7' },
  };
  const map = degreeMapByQuality[quality] || { 1: '1', 3: '3', 5: '5', 7: '7' };
  return noteOrder.map(deg => map[deg] || String(deg));
}

function formatDrop2VoicingLine(result, index) {
  const symbol = chordSymbol(result.chordRoot, result.chordQuality);
  const inv = `${result.chordInversion} Inv Drop 2`;
  const degrees = degreeLabelsForVoicing(result.chordQuality, result.noteOrder).join(' ');
  const frets = result.voicing.fretsLowToHigh.join(' ');
  const lowestString = result.voicing.stringSetLowToHigh[0]; // low->high so first is bass string
  const rootMarker = `R${lowestString}`;

  return `${index + 1}. ${symbol} - ${inv} - ${degrees} - ${rootMarker} - [ ${frets} ]`;
}

function toDisplayRow(result, index) {
  const rootString = result.voicing.stringSetLowToHigh[0];
  return {
    id: index + 1,
    chord: chordSymbol(result.chordRoot, result.chordQuality),
    inversion: `${result.chordInversion} Inv Drop 2`,
    degreePattern: degreeLabelsForVoicing(result.chordQuality, result.noteOrder),
    rootString: `R${rootString}`,
    frets: result.voicing.fretsLowToHigh,
    stringSet: result.voicing.stringSetLowToHigh,
    stringGroup: result.stringGroup,
    text: formatDrop2VoicingLine(result, index),
  };
}

// ===================== Core Logic (DROP 2) =====================
function getAvailableDrop2SeventhVoicings({
  key,
  stringNumber,       // 1 = high E ... 6 = low E
  fret,
  maxFretSpan = 5,
  maxFret = 24,
  stringGroups = ['top', 'middle', 'bottom'], // any combo of top/middle/bottom
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

  const activeStringSets = resolveStringSets(stringGroups);

  for (const chord of chords) {
    // Harmonic filter: selected note must be a chord tone
    const chordPcs = new Set(chord.formula.map(intv => mod12(chord.rootPc + intv)));
    if (!chordPcs.has(selectedPc)) continue;

    const degreeToOffset = {
      1: chord.formula[0],
      3: chord.formula[1],
      5: chord.formula[2],
      7: chord.formula[3],
    };

    // Generate DROP 2 from each closed inversion
    for (let sourceClosedInv = 0; sourceClosedInv < 4; sourceClosedInv++) {
      const closedOrder = CLOSED_DEGREE_ORDERS[sourceClosedInv];
      const noteOrder = drop2DegreeOrderFromClosedOrder(closedOrder); // low -> high in drop2

      const closedAbs = closedInversionAbsFormula(chord.formula, sourceClosedInv);
      const drop2Abs = drop2AbsFromClosedAbs(closedAbs);
      const expectedIntervals = intervalsFromAbs(drop2Abs);

      // Inversion label is determined by bass note in the resulting DROP 2 voicing
      const bassDegree = noteOrder[0];
      const inversionName = inversionNameFromBassDegree(bassDegree);

      const targetPcsLowToHigh = noteOrder.map(deg => mod12(chord.rootPc + degreeToOffset[deg]));

      for (const stringSet of activeStringSets) {
        if (!stringSet.includes(stringNumber)) continue;

        const possibleFretsPerString = stringSet.map((s, idx) =>
          fretsForPitchClass(s, targetPcsLowToHigh[idx], maxFret)
        );

        const combos = cartesianProduct(possibleFretsPerString);

        for (const frets of combos) {
          // Must include the selected exact string/fret
          const selectedIndex = stringSet.indexOf(stringNumber);
          if (frets[selectedIndex] !== fret) continue;

          // Fret span filter (5)
          const minF = Math.min(...frets);
          const maxFv = Math.max(...frets);
          if (maxFv - minF > maxFretSpan) continue;

          // Actual pitches must ascend low->high
          const midis = stringSet.map((s, i) => OPEN_STRING_MIDI[s] + frets[i]);
          if (!(midis[0] < midis[1] && midis[1] < midis[2] && midis[2] < midis[3])) continue;

          // DROP 2 interval-layout check (ensures true drop2, not just same pitch classes)
          const actualIntervals = [
            midis[1] - midis[0],
            midis[2] - midis[1],
            midis[3] - midis[2],
          ];
          if (!actualIntervals.every((v, i) => v === expectedIntervals[i])) continue;

          results.push({
            chordRoot: chord.root,
            chordQuality: chord.quality,
            chordInversion: inversionName,
            sourceClosedInversion: sourceClosedInv + 1, // optional debug info
            noteOrder,
            notesLowToHigh: targetPcsLowToHigh.map(pcToName),
            stringGroup: stringSetLabelFromArray(stringSet),
            voicing: {
              stringSetLowToHigh: stringSet,
              fretsLowToHigh: frets,
              fretSpan: maxFv - minF,
            },
          });
        }
      }
    }
  }

  // Sort for stable display (group first, then chord)
  const groupRank = { top: 0, middle: 1, bottom: 2, custom: 99 };

  results.sort((a, b) => {
    const aKey = [
      String(groupRank[a.stringGroup] ?? 99).padStart(2, '0'),
      a.chordRoot,
      a.chordQuality,
      a.chordInversion,
      a.voicing.stringSetLowToHigh.join('-'),
      a.voicing.fretsLowToHigh.join('-'),
    ].join('|');

    const bKey = [
      String(groupRank[b.stringGroup] ?? 99).padStart(2, '0'),
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

// ===================== Simple Prompt UI (Browser OR Node) =====================

// Browser prompt version
async function runBrowserPrompt() {
  const key = prompt('Key (major only, e.g. C, F#, Bb):', 'C');
  const stringNumber = parseInt(prompt('String number (1 = high E ... 6 = low E):', '2'), 10);
  const fret = parseInt(prompt('Fret number:', '5'), 10);
  const stringGroupRaw = prompt(
    'Top, Middle or Bottom? (comma-separated allowed, e.g. Top, Bottom)\nLeave blank for all.',
    'Top, Bottom'
  );

  const stringGroups = parseStringGroupInput(stringGroupRaw);

  const results = getAvailableDrop2SeventhVoicings({
    key,
    stringNumber,
    fret,
    maxFretSpan: 5,
    maxFret: 24,
    stringGroups,
  });

  console.log('\nAvailable DROP 2 voicings:\n');
  console.log(`String groups: ${stringGroups.map(s => s[0].toUpperCase() + s.slice(1)).join(', ')}`);

  if (results.length === 0) {
    console.log('No matches under current rules (major-key diatonic 7ths, DROP 2, <=5 frets).');
  } else {
    results.forEach((r, i) => console.log(formatDrop2VoicingLine(r, i)));
  }

  alert(`Found ${results.length} DROP 2 voicing(s). Check console for output.`);
}

// Node CLI version
async function runNodePrompt() {
  const readline = require('node:readline/promises');
  const { stdin: input, stdout: output } = require('node:process');
  const rl = readline.createInterface({ input, output });

  try {
    const key = await rl.question('Key (major only, e.g. C, F#, Bb): ');
    const stringNumber = parseInt(await rl.question('String number (1 = high E ... 6 = low E): '), 10);
    const fret = parseInt(await rl.question('Fret number: '), 10);
    const stringGroupRaw = await rl.question(
      'Top, Middle or Bottom? (comma-separated allowed, e.g. Top, Bottom) [blank = all]: '
    );

    const stringGroups = parseStringGroupInput(stringGroupRaw);

    const results = getAvailableDrop2SeventhVoicings({
      key,
      stringNumber,
      fret,
      maxFretSpan: 5,
      maxFret: 24,
      stringGroups,
    });

    console.log('\nAvailable DROP 2 voicings:\n');
    console.log(`String groups: ${stringGroups.map(s => s[0].toUpperCase() + s.slice(1)).join(', ')}\n`);

    if (results.length === 0) {
      console.log('No matches under current rules (major-key diatonic 7ths, DROP 2, <=5 frets).');
    } else {
      results.forEach((r, i) => console.log(formatDrop2VoicingLine(r, i)));

      // Optional structured rows for app UI:
      // const rows = results.map(toDisplayRow);
      // console.log('\nRows for UI:\n', JSON.stringify(rows, null, 2));
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    rl.close();
  }
}

// Auto-run whichever environment you're in
if (typeof window !== 'undefined' && typeof prompt === 'function') {
  // Browser: uncomment to use prompts
  // runBrowserPrompt();
} else if (typeof process !== 'undefined' && process.versions?.node) {
  // Node
  runNodePrompt();
}

// Export for app usage
if (typeof module !== 'undefined') {
  module.exports = {
    getAvailableDrop2SeventhVoicings,
    formatDrop2VoicingLine,
    toDisplayRow,
    parseStringGroupInput,
  };
}

/*
Examples for the new filter question:
- "Top"
- "Bottom"
- "Top, Bottom"
- "middle bottom"
- "" (blank = all)

Output format example:
1. G7 - 2nd Inv Drop 2 - 5 1 3 b7 - R5 - [ 10 9 7 6 ]
*/