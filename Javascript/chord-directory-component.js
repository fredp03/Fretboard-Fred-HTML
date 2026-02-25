// Chord Directory Web Component
// Integrates diatonic 7th-chord voicing engines (Root Position & Drop 2)
// and renders results dynamically based on the currently selected fret-note.

class ChordDirectoryComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    // ── Pitch / fretboard constants (shared with voicing engines) ──────────
    static CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    static NOTE_TO_PC = {
        C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
        E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7,
        'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
    };

    static FLAT_TO_SHARP = {
        Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B',
    };

    // String numbering: 1 = high E, 6 = low E
    static OPEN_STRING_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };

    // Map app string-name attrs ↔ numbering
    static STRING_NAME_TO_NUM = {
        'high-e': 1, b: 2, g: 3, d: 4, a: 5, 'low-e': 6,
    };
    static STRING_NUM_TO_NAME = { 1: 'high-e', 2: 'b', 3: 'g', 4: 'd', 5: 'a', 6: 'low-e' };

    // Adjacent 4-string sets (low → high by string number)
    static STRING_SET_PRESETS = {
        bottom: [6, 5, 4, 3],
        middle: [5, 4, 3, 2],
        top:    [4, 3, 2, 1],
    };

    // Drop 3 string sets — bass note skips one string from upper 3 voices
    static DROP3_STRING_SETS = [
        [6, 4, 3, 2],  // low E + D G B (skip A)
        [5, 3, 2, 1],  // A + G B E (skip D)
    ];

    // All supported scale formulas (must match fret-note-component)
    static SCALE_FORMULAS = {
        // Major modes
        'Major':                [0, 2, 4, 5, 7, 9, 11],
        'Dorian':               [0, 2, 3, 5, 7, 9, 10],
        'Phrygian':             [0, 1, 3, 5, 7, 8, 10],
        'Lydian':               [0, 2, 4, 6, 7, 9, 11],
        'Mixolydian':           [0, 2, 4, 5, 7, 9, 10],
        'Natural Minor':        [0, 2, 3, 5, 7, 8, 10],
        'Locrian':              [0, 1, 3, 5, 6, 8, 10],
        // Harmonic Minor modes
        'Harmonic Minor':       [0, 2, 3, 5, 7, 8, 11],
        'Locrian #6':           [0, 1, 3, 5, 6, 9, 10],
        'Ionian Augmented':     [0, 2, 4, 5, 8, 9, 11],
        'Dorian #4':            [0, 2, 3, 6, 7, 9, 10],
        'Phrygian Dominant':    [0, 1, 4, 5, 7, 8, 10],
        'Lydian #2':            [0, 3, 4, 6, 7, 9, 11],
        'Super Locrian bb7':    [0, 1, 3, 4, 6, 8, 9],
        // Melodic Minor modes
        'Melodic Minor':        [0, 2, 3, 5, 7, 9, 11],
        'Dorian b2':            [0, 1, 3, 5, 7, 9, 10],
        'Lydian Augmented':     [0, 2, 4, 6, 8, 9, 11],
        'Lydian Dominant':      [0, 2, 4, 6, 7, 9, 10],
        'Mixolydian b6':        [0, 2, 4, 5, 7, 8, 10],
        'Locrian #2':           [0, 2, 3, 5, 6, 8, 10],
        'Super Locrian':        [0, 1, 3, 4, 6, 8, 10],
        'Altered':              [0, 1, 3, 4, 6, 8, 10],
    };

    // Map interval signature → quality key
    static _qualityFromIntervals(third, fifth, seventh) {
        // third = semitones root→3rd, fifth = root→5th, seventh = root→7th
        if (third === 4 && fifth === 7  && seventh === 11) return 'maj7';
        if (third === 3 && fifth === 7  && seventh === 10) return 'm7';
        if (third === 4 && fifth === 7  && seventh === 10) return '7';
        if (third === 3 && fifth === 6  && seventh === 10) return 'm7b5';
        if (third === 3 && fifth === 6  && seventh === 9)  return 'dim7';
        if (third === 3 && fifth === 7  && seventh === 11) return 'mMaj7';
        if (third === 4 && fifth === 8  && seventh === 11) return 'augMaj7';
        if (third === 4 && fifth === 8  && seventh === 10) return 'aug7';
        // Fallback for unusual interval stacks
        return `[${third}-${fifth}-${seventh}]`;
    }

    // Closed-position degree orders per inversion (low → high)
    static CLOSED_DEGREE_ORDERS = [
        [1, 3, 5, 7],
        [3, 5, 7, 1],
        [5, 7, 1, 3],
        [7, 1, 3, 5],
    ];

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._selectedNotes = new Map(); // id → { id, note, stringName, fret }
        this._activeTab = 'Root Pos';
        this._rootPosResults = [];
        this._drop2Results = [];
        this._drop3Results = [];
    }

    static get observedAttributes() {
        return ['title'];
    }

    // ══════════════════════════ Lifecycle ══════════════════════════

    async connectedCallback() {
        if (!ChordDirectoryComponent.templateLoaded) {
            if (!ChordDirectoryComponent.templatePromise) {
                ChordDirectoryComponent.templatePromise = this._loadTemplate();
            }
            await ChordDirectoryComponent.templatePromise;
        }

        const templateContent = ChordDirectoryComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._renderTabs(['Root Pos', 'Drop 2', 'Drop 3']);
        this._setupEventHandlers();
    }

    disconnectedCallback() {
        if (this._noteHandler) document.removeEventListener('note-selection-changed', this._noteHandler);
        if (this._scaleHandler) document.removeEventListener('change', this._scaleHandler);
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/chord-directory-component.html');
            const html = await response.text();
            const temp = document.createElement('div');
            temp.innerHTML = html;
            ChordDirectoryComponent.template = temp.querySelector('#chord-directory-template');
            ChordDirectoryComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load chord-directory template:', error);
        }
    }

    // ══════════════════════════ Tabs ══════════════════════════

    _renderTabs(labels) {
        const tabBar = this.shadowRoot.querySelector('.TabBar');
        if (!tabBar) return;
        tabBar.innerHTML = '';

        labels.forEach((label, i) => {
            const tab = document.createElement('tab-menu-item');
            tab.setAttribute('label', label);
            if (i === 0) tab.setAttribute('selected', '');
            tabBar.appendChild(tab);
        });
    }

    // ══════════════════════════ Event wiring ══════════════════════════

    _setupEventHandlers() {
        // Tab selection
        const tabBar = this.shadowRoot.querySelector('.TabBar');
        tabBar.addEventListener('click', (e) => {
            const clicked = e.target.closest('tab-menu-item');
            if (!clicked) return;
            tabBar.querySelectorAll('tab-menu-item').forEach(t => t.removeAttribute('selected'));
            clicked.setAttribute('selected', '');
            this._activeTab = clicked.getAttribute('label');
            this._renderActiveRows();
        });

        // Note selection on fretboard — track all selected notes
        this._noteHandler = (e) => {
            const { id, note, stringName, active } = e.detail;
            if (active) {
                const fret = parseInt(id.slice(id.lastIndexOf('-') + 1), 10);
                this._selectedNotes.set(id, { id, note, stringName, fret });
            } else {
                this._selectedNotes.delete(id);
            }
            this._recompute();
        };
        document.addEventListener('note-selection-changed', this._noteHandler);

        // Scale root/name changes
        this._scaleHandler = (e) => {
            if (e.detail && (e.detail.field === 'root' || e.detail.field === 'name')) {
                this._recompute();
            }
        };
        document.addEventListener('change', this._scaleHandler);
    }

    // ══════════════════════════ Recompute ══════════════════════════

    _recompute() {
        if (this._selectedNotes.size === 0) {
            this._rootPosResults = [];
            this._drop2Results = [];
            this._drop3Results = [];
            this._renderActiveRows();
            return;
        }

        // Read root and scale name from the scale selector
        const scaleSelector = document.querySelector('scale-selector');
        const scaleRoot = scaleSelector ? (scaleSelector.getAttribute('root') || 'C') : 'C';
        const scaleName = scaleSelector ? (scaleSelector.getAttribute('name') || 'Major') : 'Major';

        // Convert selected notes to { stringNumber, fret } pairs
        const selected = [...this._selectedNotes.values()].map(n => ({
            stringNumber: ChordDirectoryComponent.STRING_NAME_TO_NUM[n.stringName],
            stringName: n.stringName,
            fret: n.fret,
        })).filter(n => n.stringNumber);

        if (selected.length === 0) {
            this._rootPosResults = [];
            this._drop2Results = [];
            this._drop3Results = [];
            this._renderActiveRows();
            return;
        }

        // Compute voicings anchored on the first selected note
        const anchor = selected[0];
        let rootPos = this._computeRootPositionVoicings(scaleRoot, scaleName, anchor.stringNumber, anchor.fret);
        let drop2   = this._computeDrop2Voicings(scaleRoot, scaleName, anchor.stringNumber, anchor.fret);
        let drop3   = this._computeDrop3Voicings(scaleRoot, scaleName, anchor.stringNumber, anchor.fret);

        // If multiple notes selected, filter to voicings containing ALL selected string+fret pairs
        if (selected.length > 1) {
            const mustMatch = selected.slice(1); // already matched anchor via the engine
            const voicingContainsAll = (result) =>
                mustMatch.every(sel => {
                    const entry = result.voicingMap[sel.stringName];
                    return entry && entry.fret === sel.fret;
                });
            rootPos = rootPos.filter(voicingContainsAll);
            drop2   = drop2.filter(voicingContainsAll);
            drop3   = drop3.filter(voicingContainsAll);
        }

        this._rootPosResults = rootPos;
        this._drop2Results = drop2;
        this._drop3Results = drop3;
        this._renderActiveRows();
    }

    _renderActiveRows() {
        const container = this.shadowRoot.querySelector('.RowsContainer');
        if (!container) return;
        container.innerHTML = '';

        const results = this._activeTab === 'Drop 3'
            ? this._drop3Results
            : this._activeTab === 'Drop 2'
                ? this._drop2Results
                : this._rootPosResults;

        if (results.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:20px 25px;color:#666;font-family:Lekton;font-size:14px;';
            empty.textContent = this._selectedNotes.size > 0
                ? 'No voicings found for the selected notes in the current key.'
                : 'Select a note on the fretboard.';
            container.appendChild(empty);
            return;
        }

        results.forEach((result) => {
            const el = document.createElement('notes-and-inversions');
            el.style.width = '100%';
            el.setAttribute('root', result.displayRoot);
            el.setAttribute('quality', result.displayQuality);
            el.setAttribute('inversion', result.displayInversion);
            el.setAttribute('note-1', result.degrees[0]);
            el.setAttribute('note-2', result.degrees[1]);
            el.setAttribute('note-3', result.degrees[2]);
            el.setAttribute('note-4', result.degrees[3]);

            // Hover → preview
            el.addEventListener('mouseenter', () => {
                document.dispatchEvent(new CustomEvent('triad-preview-start', { detail: { voicing: result.voicingMap } }));
            });
            el.addEventListener('mouseleave', () => {
                document.dispatchEvent(new CustomEvent('triad-preview-end'));
            });

            // Click peek icon → lock voicing on fretboard
            el.addEventListener('peek-click', () => {
                // End any active preview first
                document.dispatchEvent(new CustomEvent('triad-preview-end'));
                document.dispatchEvent(new CustomEvent('triad-select', { detail: { voicing: result.voicingMap, additive: false } }));
            });

            container.appendChild(el);
        });
    }

    // ══════════════════════════ Voicing Engine Helpers ══════════════════════════

    static _mod12(n) { return ((n % 12) + 12) % 12; }

    static _pcToName(pc) { return ChordDirectoryComponent.CHROMATIC[ChordDirectoryComponent._mod12(pc)]; }

    static _normalise(note) { return ChordDirectoryComponent.FLAT_TO_SHARP[note] || note; }

    static _normaliseKeyInput(raw) {
        if (!raw || typeof raw !== 'string') return null;
        const trimmed = raw.trim();
        const pretty = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        return Object.prototype.hasOwnProperty.call(ChordDirectoryComponent.NOTE_TO_PC, pretty) ? pretty : null;
    }

    /**
     * Build diatonic 7th chords for ANY 7-note scale.
     * Stacks thirds: for each scale degree i, the chord tones are
     * scale[i], scale[(i+2)%7], scale[(i+4)%7], scale[(i+6)%7].
     */
    static _getDiatonic7thChords(rootName, scaleName) {
        const mod12 = ChordDirectoryComponent._mod12;
        const scaleSteps = ChordDirectoryComponent.SCALE_FORMULAS[scaleName];
        if (!scaleSteps || scaleSteps.length !== 7) return [];   // only 7-note scales

        const rootPc = ChordDirectoryComponent.NOTE_TO_PC[rootName];
        if (rootPc === undefined) return [];

        // Absolute pitch classes of the scale
        const scalePcs = scaleSteps.map(s => mod12(rootPc + s));

        return scalePcs.map((chordRootPc, i) => {
            // Intervals from chord root to 3rd, 5th, 7th (stacking 3rds)
            const thirdPc  = scalePcs[(i + 2) % 7];
            const fifthPc  = scalePcs[(i + 4) % 7];
            const seventhPc = scalePcs[(i + 6) % 7];

            const thirdInt   = mod12(thirdPc  - chordRootPc);
            const fifthInt   = mod12(fifthPc  - chordRootPc);
            const seventhInt = mod12(seventhPc - chordRootPc);

            const quality = ChordDirectoryComponent._qualityFromIntervals(thirdInt, fifthInt, seventhInt);
            const formula = [0, thirdInt, fifthInt, seventhInt];

            return {
                degree: i + 1,
                rootPc: chordRootPc,
                root: ChordDirectoryComponent._pcToName(chordRootPc),
                quality,
                formula,
            };
        });
    }

    static _fretsForPitchClass(stringNumber, targetPc, maxFret = 24) {
        const openMidi = ChordDirectoryComponent.OPEN_STRING_MIDI[stringNumber];
        const out = [];
        for (let f = 0; f <= maxFret; f++) {
            if (ChordDirectoryComponent._mod12(openMidi + f) === targetPc) out.push(f);
        }
        return out;
    }

    static _cartesianProduct(arrays) {
        return arrays.reduce(
            (acc, arr) => acc.flatMap(prefix => arr.map(v => [...prefix, v])),
            [[]]
        );
    }

    static _arraysEqual(a, b) {
        return a.length === b.length && a.every((v, i) => v === b[i]);
    }

    static _stringSetLabel(setArr) {
        const p = ChordDirectoryComponent.STRING_SET_PRESETS;
        if (ChordDirectoryComponent._arraysEqual(setArr, p.top)) return 'top';
        if (ChordDirectoryComponent._arraysEqual(setArr, p.middle)) return 'middle';
        if (ChordDirectoryComponent._arraysEqual(setArr, p.bottom)) return 'bottom';
        return 'custom';
    }

    // Build voicing map compatible with triad-preview system { 'string-name': { note, fret } }
    static _buildVoicingMap(stringSet, frets, noteNames) {
        const map = {};
        for (let i = 0; i < stringSet.length; i++) {
            const name = ChordDirectoryComponent.STRING_NUM_TO_NAME[stringSet[i]];
            map[name] = { note: noteNames[i], fret: frets[i] };
        }
        return map;
    }

    // Display helpers
    static _chordSymbol(root, quality) {
        switch (quality) {
            case 'maj7': return `${root}maj7`;
            case 'm7':   return `${root}m7`;
            case '7':    return `${root}7`;
            case 'm7b5': return `${root}m7b5`;
            default:     return `${root}${quality}`;
        }
    }

    static _qualityDisplayName(quality) {
        switch (quality) {
            case 'maj7':    return 'Maj 7';
            case 'm7':      return 'Min 7';
            case '7':       return 'Dom 7';
            case 'm7b5':    return 'Min 7b5';
            case 'dim7':    return 'Dim 7';
            case 'mMaj7':   return 'Min Maj7';
            case 'augMaj7': return 'Aug Maj7';
            case 'aug7':    return 'Aug 7';
            default:        return quality;
        }
    }

    static _degreeLabels(quality, noteOrder) {
        const maps = {
            maj7:    { 1: '1', 3: '3',  5: '5',  7: '7'  },
            '7':     { 1: '1', 3: '3',  5: '5',  7: 'b7' },
            m7:      { 1: '1', 3: 'b3', 5: '5',  7: 'b7' },
            m7b5:    { 1: '1', 3: 'b3', 5: 'b5', 7: 'b7' },
            dim7:    { 1: '1', 3: 'b3', 5: 'b5', 7: 'bb7' },
            mMaj7:   { 1: '1', 3: 'b3', 5: '5',  7: '7'  },
            augMaj7: { 1: '1', 3: '3',  5: '#5', 7: '7'  },
            aug7:    { 1: '1', 3: '3',  5: '#5', 7: 'b7' },
        };
        const m = maps[quality] || maps.maj7;
        return noteOrder.map(deg => m[deg] || String(deg));
    }

    static _inversionNameFromBassDegree(deg) {
        switch (deg) {
            case 1: return 'Root';
            case 3: return '1st';
            case 5: return '2nd';
            case 7: return '3rd';
            default: return String(deg);
        }
    }

    // ══════════════════════════ Root Position Engine ══════════════════════════

    _computeRootPositionVoicings(keyRaw, scaleName, stringNumber, fret) {
        const mod12 = ChordDirectoryComponent._mod12;
        const keyName = ChordDirectoryComponent._normaliseKeyInput(keyRaw);
        if (!keyName) return [];

        const selectedPc = mod12(ChordDirectoryComponent.OPEN_STRING_MIDI[stringNumber] + fret);
        const chords = ChordDirectoryComponent._getDiatonic7thChords(keyName, scaleName);
        const allSets = Object.values(ChordDirectoryComponent.STRING_SET_PRESETS);
        const results = [];

        const ROOT_ORDER = [1, 3, 5, 7];

        for (const chord of chords) {
            const chordPcs = new Set(chord.formula.map(intv => mod12(chord.rootPc + intv)));
            if (!chordPcs.has(selectedPc)) continue;

            const degreeToOffset = { 1: chord.formula[0], 3: chord.formula[1], 5: chord.formula[2], 7: chord.formula[3] };
            const targetPcs = ROOT_ORDER.map(deg => mod12(chord.rootPc + degreeToOffset[deg]));

            // Expected closed intervals
            const expectedIntervals = [
                chord.formula[1] - chord.formula[0],
                chord.formula[2] - chord.formula[1],
                chord.formula[3] - chord.formula[2],
            ];

            for (const stringSet of allSets) {
                if (!stringSet.includes(stringNumber)) continue;

                const possibleFrets = stringSet.map((s, idx) =>
                    ChordDirectoryComponent._fretsForPitchClass(s, targetPcs[idx], 24)
                );
                const combos = ChordDirectoryComponent._cartesianProduct(possibleFrets);

                for (const frets of combos) {
                    const selIdx = stringSet.indexOf(stringNumber);
                    if (frets[selIdx] !== fret) continue;

                    const minF = Math.min(...frets);
                    const maxF = Math.max(...frets);
                    if (maxF - minF > 4) continue;

                    const midis = stringSet.map((s, i) => ChordDirectoryComponent.OPEN_STRING_MIDI[s] + frets[i]);
                    if (!(midis[0] < midis[1] && midis[1] < midis[2] && midis[2] < midis[3])) continue;

                    const actualIntervals = [midis[1] - midis[0], midis[2] - midis[1], midis[3] - midis[2]];
                    if (!actualIntervals.every((v, i) => v === expectedIntervals[i])) continue;

                    const noteNames = targetPcs.map(ChordDirectoryComponent._pcToName);
                    const degrees = ChordDirectoryComponent._degreeLabels(chord.quality, ROOT_ORDER);

                    results.push({
                        displayRoot: chord.root,
                        displayQuality: ChordDirectoryComponent._qualityDisplayName(chord.quality),
                        displayInversion: 'Root',
                        degrees,
                        voicingMap: ChordDirectoryComponent._buildVoicingMap(stringSet, frets, noteNames),
                        stringGroup: ChordDirectoryComponent._stringSetLabel(stringSet),
                        frets,
                    });
                }
            }
        }

        this._sortResults(results);
        return results;
    }

    // ══════════════════════════ Drop 2 Engine ══════════════════════════

    _computeDrop2Voicings(keyRaw, scaleName, stringNumber, fret) {
        const mod12 = ChordDirectoryComponent._mod12;
        const keyName = ChordDirectoryComponent._normaliseKeyInput(keyRaw);
        if (!keyName) return [];

        const selectedPc = mod12(ChordDirectoryComponent.OPEN_STRING_MIDI[stringNumber] + fret);
        const chords = ChordDirectoryComponent._getDiatonic7thChords(keyName, scaleName);
        const allSets = Object.values(ChordDirectoryComponent.STRING_SET_PRESETS);
        const results = [];

        for (const chord of chords) {
            const chordPcs = new Set(chord.formula.map(intv => mod12(chord.rootPc + intv)));
            if (!chordPcs.has(selectedPc)) continue;

            const degreeToOffset = { 1: chord.formula[0], 3: chord.formula[1], 5: chord.formula[2], 7: chord.formula[3] };

            for (let inv = 0; inv < 4; inv++) {
                const closedOrder = ChordDirectoryComponent.CLOSED_DEGREE_ORDERS[inv];
                // Drop 2: take 2nd-highest note (index 2) and drop it an octave → [2, 0, 1, 3]
                const noteOrder = [closedOrder[2], closedOrder[0], closedOrder[1], closedOrder[3]];

                // Build absolute formula for closed inversion
                const closedAbs = [
                    ...chord.formula.slice(inv),
                    ...chord.formula.slice(0, inv).map(x => x + 12),
                ];
                // Drop 2 absolute: [closedAbs[2]-12, closedAbs[0], closedAbs[1], closedAbs[3]]
                const drop2Abs = [closedAbs[2] - 12, closedAbs[0], closedAbs[1], closedAbs[3]];
                const expectedIntervals = [drop2Abs[1] - drop2Abs[0], drop2Abs[2] - drop2Abs[1], drop2Abs[3] - drop2Abs[2]];

                const bassDegree = noteOrder[0];
                const invName = ChordDirectoryComponent._inversionNameFromBassDegree(bassDegree);
                const targetPcs = noteOrder.map(deg => mod12(chord.rootPc + degreeToOffset[deg]));

                for (const stringSet of allSets) {
                    if (!stringSet.includes(stringNumber)) continue;

                    const possibleFrets = stringSet.map((s, idx) =>
                        ChordDirectoryComponent._fretsForPitchClass(s, targetPcs[idx], 24)
                    );
                    const combos = ChordDirectoryComponent._cartesianProduct(possibleFrets);

                    for (const frets of combos) {
                        const selIdx = stringSet.indexOf(stringNumber);
                        if (frets[selIdx] !== fret) continue;

                        const minF = Math.min(...frets);
                        const maxF = Math.max(...frets);
                        if (maxF - minF > 5) continue;

                        const midis = stringSet.map((s, i) => ChordDirectoryComponent.OPEN_STRING_MIDI[s] + frets[i]);
                        if (!(midis[0] < midis[1] && midis[1] < midis[2] && midis[2] < midis[3])) continue;

                        const actualIntervals = [midis[1] - midis[0], midis[2] - midis[1], midis[3] - midis[2]];
                        if (!actualIntervals.every((v, i) => v === expectedIntervals[i])) continue;

                        const noteNames = targetPcs.map(ChordDirectoryComponent._pcToName);
                        const degrees = ChordDirectoryComponent._degreeLabels(chord.quality, noteOrder);

                        results.push({
                            displayRoot: chord.root,
                            displayQuality: ChordDirectoryComponent._qualityDisplayName(chord.quality),
                            displayInversion: `${invName}`,
                            degrees,
                            voicingMap: ChordDirectoryComponent._buildVoicingMap(stringSet, frets, noteNames),
                            stringGroup: ChordDirectoryComponent._stringSetLabel(stringSet),
                            frets,
                        });
                    }
                }
            }
        }

        this._sortResults(results);
        return results;
    }

    // ══════════════════════════ Drop 3 Engine ══════════════════════════

    _computeDrop3Voicings(keyRaw, scaleName, stringNumber, fret) {
        const mod12 = ChordDirectoryComponent._mod12;
        const keyName = ChordDirectoryComponent._normaliseKeyInput(keyRaw);
        if (!keyName) return [];

        const selectedPc = mod12(ChordDirectoryComponent.OPEN_STRING_MIDI[stringNumber] + fret);
        const chords = ChordDirectoryComponent._getDiatonic7thChords(keyName, scaleName);
        const drop3Sets = ChordDirectoryComponent.DROP3_STRING_SETS;
        const results = [];

        for (const chord of chords) {
            const chordPcs = new Set(chord.formula.map(intv => mod12(chord.rootPc + intv)));
            if (!chordPcs.has(selectedPc)) continue;

            const degreeToOffset = { 1: chord.formula[0], 3: chord.formula[1], 5: chord.formula[2], 7: chord.formula[3] };

            for (let inv = 0; inv < 4; inv++) {
                const closedOrder = ChordDirectoryComponent.CLOSED_DEGREE_ORDERS[inv];
                // Drop 3: take 3rd-highest note (index 1) and drop it an octave → [1, 0, 2, 3]
                const noteOrder = [closedOrder[1], closedOrder[0], closedOrder[2], closedOrder[3]];

                // Build absolute formula for closed inversion
                const closedAbs = [
                    ...chord.formula.slice(inv),
                    ...chord.formula.slice(0, inv).map(x => x + 12),
                ];
                // Drop 3 absolute: [closedAbs[1]-12, closedAbs[0], closedAbs[2], closedAbs[3]]
                const drop3Abs = [closedAbs[1] - 12, closedAbs[0], closedAbs[2], closedAbs[3]];
                const expectedIntervals = [drop3Abs[1] - drop3Abs[0], drop3Abs[2] - drop3Abs[1], drop3Abs[3] - drop3Abs[2]];

                const bassDegree = noteOrder[0];
                const invName = ChordDirectoryComponent._inversionNameFromBassDegree(bassDegree);
                const targetPcs = noteOrder.map(deg => mod12(chord.rootPc + degreeToOffset[deg]));

                for (const stringSet of drop3Sets) {
                    if (!stringSet.includes(stringNumber)) continue;

                    const possibleFrets = stringSet.map((s, idx) =>
                        ChordDirectoryComponent._fretsForPitchClass(s, targetPcs[idx], 24)
                    );
                    const combos = ChordDirectoryComponent._cartesianProduct(possibleFrets);

                    for (const frets of combos) {
                        const selIdx = stringSet.indexOf(stringNumber);
                        if (frets[selIdx] !== fret) continue;

                        const minF = Math.min(...frets);
                        const maxF = Math.max(...frets);
                        if (maxF - minF > 5) continue;

                        const midis = stringSet.map((s, i) => ChordDirectoryComponent.OPEN_STRING_MIDI[s] + frets[i]);
                        if (!(midis[0] < midis[1] && midis[1] < midis[2] && midis[2] < midis[3])) continue;

                        const actualIntervals = [midis[1] - midis[0], midis[2] - midis[1], midis[3] - midis[2]];
                        if (!actualIntervals.every((v, i) => v === expectedIntervals[i])) continue;

                        const noteNames = targetPcs.map(ChordDirectoryComponent._pcToName);
                        const degrees = ChordDirectoryComponent._degreeLabels(chord.quality, noteOrder);

                        results.push({
                            displayRoot: chord.root,
                            displayQuality: ChordDirectoryComponent._qualityDisplayName(chord.quality),
                            displayInversion: `${invName}`,
                            degrees,
                            voicingMap: ChordDirectoryComponent._buildVoicingMap(stringSet, frets, noteNames),
                            stringGroup: ChordDirectoryComponent._stringSetLabel(stringSet),
                            frets,
                        });
                    }
                }
            }
        }

        this._sortResults(results);
        return results;
    }

    // ══════════════════════════ Sort ══════════════════════════

    _sortResults(results) {
        const groupRank = { top: 0, middle: 1, bottom: 2, custom: 99 };
        results.sort((a, b) => {
            const aKey = [
                String(groupRank[a.stringGroup] ?? 99).padStart(2, '0'),
                a.displayRoot,
                a.displayQuality,
                a.displayInversion,
                a.frets.join('-'),
            ].join('|');
            const bKey = [
                String(groupRank[b.stringGroup] ?? 99).padStart(2, '0'),
                b.displayRoot,
                b.displayQuality,
                b.displayInversion,
                b.frets.join('-'),
            ].join('|');
            return aKey.localeCompare(bKey);
        });
    }

    // ══════════════════════════ Attribute changes ══════════════════════════

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) el.textContent = value;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (!this.shadowRoot.querySelector('.ChordDirectoryWrapper')) return;
        if (name === 'title') this._updateBinding('title', newValue);
    }
}

customElements.define('chord-directory', ChordDirectoryComponent);
