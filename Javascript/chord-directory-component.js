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
        // ── Extended 15-type chord recognition (Mel Bay Ch.4) ──
        if (third === 4 && fifth === 6  && seventh === 11) return 'maj7b5';
        if (third === 4 && fifth === 6  && seventh === 10) return '7b5';
        if (third === 5 && fifth === 7  && seventh === 10) return '7sus4';
        if (third === 3 && fifth === 8  && seventh === 10) return 'm7s5';
        if (third === 4 && fifth === 7  && seventh === 9)  return '6';
        if (third === 4 && fifth === 6  && seventh === 9)  return '6b5';
        if (third === 3 && fifth === 7  && seventh === 9)  return 'm6';
        // Fallback for unusual interval stacks
        return `[${third}-${fifth}-${seventh}]`;
    }

    // ── Tension availability matrix (Mel Bay Ch.5) ─────────────────────────
    // Which natural tensions are allowed on each chord quality.
    // Phase 1: 9, 11, 13 only. Altered tensions (b9, #9, #11, b13) = Phase 2.
    static TENSION_MATRIX = {
        maj7:    { 9: true,              13: true },
        maj7b5:  { 9: true,              13: true },
        augMaj7: { 9: true,              13: true },
        mMaj7:   { 9: true, 11: true,    13: true },
        m7:      { 9: true, 11: true,    13: true },
        m7b5:    { 9: true, 11: true              },
        m7s5:    { 9: true, 11: true,    13: true },
        '7':     { 9: true, 11: true,    13: true },
        '7b5':   { 9: true,              13: true },
        aug7:    { 9: true, 11: true              },
        '7sus4': { 9: true,              13: true },
        dim7:    { 9: true, 11: true,    13: true },
        '6':     { 9: true                        },
        '6b5':   { 9: true                        },
        m6:      { 9: true, 11: true              },
    };

    // Semitone offset from chord root for each tension
    static TENSION_OFFSETS = { 9: 2, 11: 5, 13: 9 };

    // Substitution recipes — each replaces one chord tone with a tension
    static TENSION_SUBS = [
        { tension: 9,  replaces: 1, label: '9→R'  },
        { tension: 9,  replaces: 5, label: '9→5'  },
        { tension: 11, replaces: 1, label: '11→R' },
        { tension: 11, replaces: 5, label: '11→5' },
        { tension: 13, replaces: 1, label: '13→R' },
        { tension: 13, replaces: 5, label: '13→5' },
    ];

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
        this._renderActiveRows();
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
            const { id, note, stringName, active, pinned } = e.detail;
            if (active) {
                const fret = parseInt(id.slice(id.lastIndexOf('-') + 1), 10);
                this._selectedNotes.set(id, { id, note, stringName, fret, pinned: pinned || null });
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
            pinned: n.pinned || null,
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

        // Compute tension voicings for each tab
        let rootPosTensions = this._computeTensionVoicings(scaleRoot, scaleName, anchor.stringNumber, anchor.fret, 'rootPos');
        let drop2Tensions   = this._computeTensionVoicings(scaleRoot, scaleName, anchor.stringNumber, anchor.fret, 'drop2');
        let drop3Tensions   = this._computeTensionVoicings(scaleRoot, scaleName, anchor.stringNumber, anchor.fret, 'drop3');

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
            rootPosTensions = rootPosTensions.filter(voicingContainsAll);
            drop2Tensions   = drop2Tensions.filter(voicingContainsAll);
            drop3Tensions   = drop3Tensions.filter(voicingContainsAll);
        }

        // ── Cmd-click pin filter: bass / soprano constraint ──
        const S2N = ChordDirectoryComponent.STRING_NAME_TO_NUM;
        const pinnedNotes = selected.filter(s => s.pinned);
        if (pinnedNotes.length > 0) {
            const pinFilter = (result) => {
                // Determine the highest and lowest string numbers in this voicing
                const voicingStrNums = Object.keys(result.voicingMap).map(n => S2N[n]).filter(Boolean);
                const lowestStringNum  = Math.max(...voicingStrNums); // highest number = lowest pitch
                const highestStringNum = Math.min(...voicingStrNums); // lowest number  = highest pitch
                return pinnedNotes.every(pin => {
                    const pinStrNum = S2N[pin.stringName];
                    if (pin.pinned === 'bass')    return pinStrNum === lowestStringNum;
                    if (pin.pinned === 'soprano') return pinStrNum === highestStringNum;
                    return true;
                });
            };
            rootPos         = rootPos.filter(pinFilter);
            drop2           = drop2.filter(pinFilter);
            drop3           = drop3.filter(pinFilter);
            rootPosTensions = rootPosTensions.filter(pinFilter);
            drop2Tensions   = drop2Tensions.filter(pinFilter);
            drop3Tensions   = drop3Tensions.filter(pinFilter);
        }

        // Merge base voicings with tension voicings (tensions appended after base)
        this._rootPosResults = [...rootPos, ...rootPosTensions];
        this._drop2Results = [...drop2, ...drop2Tensions];
        this._drop3Results = [...drop3, ...drop3Tensions];
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

            // b9 interval warning
            if (result.hasB9Interval) {
                el.setAttribute('b9-warning', '');
            }

            // Tension substitution label
            if (result.tensionSub) {
                el.setAttribute('tension', result.tensionSub);
            }

            // Hover → preview
            el.addEventListener('mouseenter', () => {
                document.dispatchEvent(new CustomEvent('triad-preview-start', { detail: { voicing: result.voicingMap } }));
            });
            el.addEventListener('mouseleave', () => {
                document.dispatchEvent(new CustomEvent('triad-preview-end'));
            });

            // Click peek icon → lock voicing on fretboard (shift-click → save chord)
            el.addEventListener('peek-click', (e) => {
                if (e.detail && e.detail.shiftKey) {
                    // Shift-click: save as a saved chord
                    const scaleSelector = document.querySelector('scale-selector');
                    const scaleRoot = scaleSelector ? (scaleSelector.getAttribute('root') || 'C') : 'C';
                    const scaleName = scaleSelector ? (scaleSelector.getAttribute('name') || 'Major') : 'Major';
                    document.dispatchEvent(new CustomEvent('chord-save-request', {
                        detail: {
                            voicingMap: result.voicingMap,
                            chordName: `${result.displayRoot} ${result.displayQuality}`,
                            voicingType: this._activeTab,
                            inversion: result.displayInversion,
                            scaleRoot,
                            scaleName,
                        }
                    }));
                } else {
                    // Normal click: lock voicing on fretboard
                    document.dispatchEvent(new CustomEvent('triad-preview-end'));
                    document.dispatchEvent(new CustomEvent('triad-select', { detail: { voicing: result.voicingMap, additive: false } }));
                }
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

        const chords = scalePcs.map((chordRootPc, i) => {
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

        // ── 6th chord equivalences ─────────────────────────────────────
        // Am7 (A-C-E-G) = C6 (C-E-G-A)  →  every m7 produces a Maj 6
        // Bm7b5 (B-D-F-A) = Dm6 (D-F-A-B)  →  every m7b5 produces a Min 6
        const sixthChords = [];
        for (const chord of chords) {
            if (chord.quality === 'm7') {
                const sixthRootPc = mod12(chord.rootPc + chord.formula[1]); // b3
                sixthChords.push({
                    degree: chord.degree,
                    rootPc: sixthRootPc,
                    root: ChordDirectoryComponent._pcToName(sixthRootPc),
                    quality: '6',
                    formula: [0, 4, 7, 9],
                });
            } else if (chord.quality === 'm7b5') {
                const sixthRootPc = mod12(chord.rootPc + chord.formula[1]); // b3
                sixthChords.push({
                    degree: chord.degree,
                    rootPc: sixthRootPc,
                    root: ChordDirectoryComponent._pcToName(sixthRootPc),
                    quality: 'm6',
                    formula: [0, 3, 7, 9],
                });
            }
        }

        return [...chords, ...sixthChords];
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

    // Build voicing map compatible with triad-preview system { 'string-name': { note, fret, chordDegree? } }
    static _buildVoicingMap(stringSet, frets, noteNames, degrees) {
        const map = {};
        for (let i = 0; i < stringSet.length; i++) {
            const name = ChordDirectoryComponent.STRING_NUM_TO_NAME[stringSet[i]];
            map[name] = { note: noteNames[i], fret: frets[i] };
            if (degrees) map[name].chordDegree = degrees[i];
        }
        return map;
    }

    // Display helpers
    static _chordSymbol(root, quality) {
        switch (quality) {
            case 'maj7':    return `${root}maj7`;
            case 'm7':      return `${root}m7`;
            case '7':       return `${root}7`;
            case 'm7b5':    return `${root}m7b5`;
            case 'dim7':    return `${root}dim7`;
            case 'mMaj7':   return `${root}mMaj7`;
            case 'augMaj7': return `${root}augMaj7`;
            case 'aug7':    return `${root}aug7`;
            case 'maj7b5':  return `${root}maj7b5`;
            case '7b5':     return `${root}7b5`;
            case '7sus4':   return `${root}7sus4`;
            case 'm7s5':    return `${root}m7#5`;
            case '6':       return `${root}6`;
            case '6b5':     return `${root}6b5`;
            case 'm6':      return `${root}m6`;
            default:        return `${root}${quality}`;
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
            case 'maj7b5':  return 'Maj 7b5';
            case '7b5':     return 'Dom 7b5';
            case '7sus4':   return 'Dom 7sus4';
            case 'm7s5':    return 'Min 7#5';
            case '6':       return 'Maj 6';
            case '6b5':     return 'Maj 6b5';
            case 'm6':      return 'Min 6';
            default:        return quality;
        }
    }
    /**
     * Like _qualityDisplayName but replaces the "7" with the tension number,
     * producing conventional extended-chord names (e.g. Min 9, Dom 13).
     */
    static _tensionQualityDisplayName(quality, tension) {
        const base = {
            'maj7':    { prefix: 'Maj',      suffix: '' },
            'm7':      { prefix: 'Min',      suffix: '' },
            '7':       { prefix: 'Dom',      suffix: '' },
            'm7b5':    { prefix: 'Min',      suffix: '(b5)' },
            'dim7':    { prefix: 'Dim',      suffix: '' },
            'mMaj7':   { prefix: 'Min/Maj',  suffix: '' },
            'augMaj7': { prefix: 'Aug/Maj',  suffix: '' },
            'aug7':    { prefix: 'Aug',      suffix: '' },
            'maj7b5':  { prefix: 'Maj',      suffix: '(b5)' },
            '7b5':     { prefix: 'Dom',      suffix: '(b5)' },
            '7sus4':   { prefix: 'Dom',      suffix: 'sus4' },
            'm7s5':    { prefix: 'Min',      suffix: '(#5)' },
            '6':       { prefix: 'Maj 6/',   suffix: '' },
            '6b5':     { prefix: 'Maj 6(b5)/', suffix: '' },
            'm6':      { prefix: 'Min 6/',   suffix: '' },
        };
        const entry = base[quality];
        if (!entry) return `${quality} (${tension})`;
        // For 6-type chords use slash notation: "Maj 6/9"
        if (quality === '6' || quality === '6b5' || quality === 'm6') {
            return `${entry.prefix}${tension}`;
        }
        return entry.suffix
            ? `${entry.prefix} ${tension}${entry.suffix}`
            : `${entry.prefix} ${tension}`;
    }
    static _degreeLabels(quality, noteOrder) {
        // Shared tension labels appended to every quality map
        const tensionLabels = { 9: '9', 11: '11', 13: '13' };
        const maps = {
            maj7:    { 1: '1', 3: '3',  5: '5',  7: '7',   ...tensionLabels },
            '7':     { 1: '1', 3: '3',  5: '5',  7: 'b7',  ...tensionLabels },
            m7:      { 1: '1', 3: 'b3', 5: '5',  7: 'b7',  ...tensionLabels },
            m7b5:    { 1: '1', 3: 'b3', 5: 'b5', 7: 'b7',  ...tensionLabels },
            dim7:    { 1: '1', 3: 'b3', 5: 'b5', 7: 'bb7', ...tensionLabels },
            mMaj7:   { 1: '1', 3: 'b3', 5: '5',  7: '7',   ...tensionLabels },
            augMaj7: { 1: '1', 3: '3',  5: '#5', 7: '7',   ...tensionLabels },
            aug7:    { 1: '1', 3: '3',  5: '#5', 7: 'b7',  ...tensionLabels },
            maj7b5:  { 1: '1', 3: '3',  5: 'b5', 7: '7',   ...tensionLabels },
            '7b5':   { 1: '1', 3: '3',  5: 'b5', 7: 'b7',  ...tensionLabels },
            '7sus4': { 1: '1', 3: '4',  5: '5',  7: 'b7',  ...tensionLabels },
            m7s5:    { 1: '1', 3: 'b3', 5: '#5', 7: 'b7',  ...tensionLabels },
            '6':     { 1: '1', 3: '3',  5: '5',  7: '6',   ...tensionLabels },
            '6b5':   { 1: '1', 3: '3',  5: 'b5', 7: '6',   ...tensionLabels },
            m6:      { 1: '1', 3: 'b3', 5: '5',  7: '6',   ...tensionLabels },
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
            case 9: return '9th';
            case 11: return '11th';
            case 13: return '13th';
            default: return String(deg);
        }
    }

    // ── b9 interval check ──────────────────────────────────────────────────
    /**
     * Returns true if any pair of adjacent voices (low→high) forms a
     * minor-9th interval (1 or 13 semitones). This is the primary
     * "avoid" signal from Mel Bay Ch.1/3.
     */
    static _hasB9Interval(midis) {
        for (let i = 0; i < midis.length - 1; i++) {
            const gap = midis[i + 1] - midis[i];
            if (gap === 1 || gap === 13) return true;
        }
        return false;
    }

    // ── Shared voicing-finder core loop ────────────────────────────────────
    /**
     * Find all playable 4-note voicings on the given string-sets that match
     * the requested pitch classes and interval layout.
     *
     * @param {Object} opts
     * @param {number[]} opts.targetPcs      – 4 pitch classes, low→high voice order
     * @param {number[][]} opts.stringSets   – array of 4-element string-number arrays
     * @param {number[]} opts.expectedIntervals – 3 semitone gaps between adjacent voices
     * @param {number} opts.stringNumber     – anchor string (1-6)
     * @param {number} opts.fret             – anchor fret
     * @param {number} opts.maxFretSpan      – max allowed fret span (e.g. 4 or 5)
     * @returns {{ stringSet: number[], frets: number[], midis: number[] }[]}
     */
    static _findVoicingsOnStringSets({ targetPcs, stringSets, expectedIntervals, stringNumber, fret, maxFretSpan }) {
        const hits = [];

        for (const stringSet of stringSets) {
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
                if (maxF - minF > maxFretSpan) continue;

                const midis = stringSet.map((s, i) => ChordDirectoryComponent.OPEN_STRING_MIDI[s] + frets[i]);
                if (!(midis[0] < midis[1] && midis[1] < midis[2] && midis[2] < midis[3])) continue;

                const actualIntervals = [midis[1] - midis[0], midis[2] - midis[1], midis[3] - midis[2]];
                if (!actualIntervals.every((v, i) => v === expectedIntervals[i])) continue;

                hits.push({ stringSet, frets, midis });
            }
        }

        return hits;
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

            const expectedIntervals = [
                chord.formula[1] - chord.formula[0],
                chord.formula[2] - chord.formula[1],
                chord.formula[3] - chord.formula[2],
            ];

            const hits = ChordDirectoryComponent._findVoicingsOnStringSets({
                targetPcs, stringSets: allSets, expectedIntervals,
                stringNumber, fret, maxFretSpan: 4,
            });

            for (const { stringSet, frets, midis } of hits) {
                const noteNames = targetPcs.map(ChordDirectoryComponent._pcToName);
                const degrees = ChordDirectoryComponent._degreeLabels(chord.quality, ROOT_ORDER);

                results.push({
                    displayRoot: chord.root,
                    displayQuality: ChordDirectoryComponent._qualityDisplayName(chord.quality),
                    displayInversion: 'Root',
                    degrees,
                    voicingMap: ChordDirectoryComponent._buildVoicingMap(stringSet, frets, noteNames, degrees),
                    stringGroup: ChordDirectoryComponent._stringSetLabel(stringSet),
                    frets,
                    hasB9Interval: ChordDirectoryComponent._hasB9Interval(midis),
                });
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
                const noteOrder = [closedOrder[2], closedOrder[0], closedOrder[1], closedOrder[3]];

                const closedAbs = [
                    ...chord.formula.slice(inv),
                    ...chord.formula.slice(0, inv).map(x => x + 12),
                ];
                const drop2Abs = [closedAbs[2] - 12, closedAbs[0], closedAbs[1], closedAbs[3]];
                const expectedIntervals = [drop2Abs[1] - drop2Abs[0], drop2Abs[2] - drop2Abs[1], drop2Abs[3] - drop2Abs[2]];

                const bassDegree = noteOrder[0];
                const invName = ChordDirectoryComponent._inversionNameFromBassDegree(bassDegree);
                const targetPcs = noteOrder.map(deg => mod12(chord.rootPc + degreeToOffset[deg]));

                const hits = ChordDirectoryComponent._findVoicingsOnStringSets({
                    targetPcs, stringSets: allSets, expectedIntervals,
                    stringNumber, fret, maxFretSpan: 5,
                });

                for (const { stringSet, frets, midis } of hits) {
                    const noteNames = targetPcs.map(ChordDirectoryComponent._pcToName);
                    const degrees = ChordDirectoryComponent._degreeLabels(chord.quality, noteOrder);

                    results.push({
                        displayRoot: chord.root,
                        displayQuality: ChordDirectoryComponent._qualityDisplayName(chord.quality),
                        displayInversion: `${invName}`,
                        degrees,
                        voicingMap: ChordDirectoryComponent._buildVoicingMap(stringSet, frets, noteNames, degrees),
                        stringGroup: ChordDirectoryComponent._stringSetLabel(stringSet),
                        frets,
                        hasB9Interval: ChordDirectoryComponent._hasB9Interval(midis),
                    });
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
                const noteOrder = [closedOrder[1], closedOrder[0], closedOrder[2], closedOrder[3]];

                const closedAbs = [
                    ...chord.formula.slice(inv),
                    ...chord.formula.slice(0, inv).map(x => x + 12),
                ];
                const drop3Abs = [closedAbs[1] - 12, closedAbs[0], closedAbs[2], closedAbs[3]];
                const expectedIntervals = [drop3Abs[1] - drop3Abs[0], drop3Abs[2] - drop3Abs[1], drop3Abs[3] - drop3Abs[2]];

                const bassDegree = noteOrder[0];
                const invName = ChordDirectoryComponent._inversionNameFromBassDegree(bassDegree);
                const targetPcs = noteOrder.map(deg => mod12(chord.rootPc + degreeToOffset[deg]));

                const hits = ChordDirectoryComponent._findVoicingsOnStringSets({
                    targetPcs, stringSets: drop3Sets, expectedIntervals,
                    stringNumber, fret, maxFretSpan: 5,
                });

                for (const { stringSet, frets, midis } of hits) {
                    const noteNames = targetPcs.map(ChordDirectoryComponent._pcToName);
                    const degrees = ChordDirectoryComponent._degreeLabels(chord.quality, noteOrder);

                    results.push({
                        displayRoot: chord.root,
                        displayQuality: ChordDirectoryComponent._qualityDisplayName(chord.quality),
                        displayInversion: `${invName}`,
                        degrees,
                        voicingMap: ChordDirectoryComponent._buildVoicingMap(stringSet, frets, noteNames, degrees),
                        stringGroup: ChordDirectoryComponent._stringSetLabel(stringSet),
                        frets,
                        hasB9Interval: ChordDirectoryComponent._hasB9Interval(midis),
                    });
                }
            }
        }

        this._sortResults(results);
        return results;
    }

    // ══════════════════════════ Tension Voicing Engine ══════════════════════════

    /**
     * Check whether a tension's pitch class is diatonic to the current scale.
     * Returns the pitch class if diatonic, or null if chromatic (skip).
     */
    static _getDiatonicTensionPc(chordRootPc, tensionDegree, scaleRoot, scaleName) {
        const mod12 = ChordDirectoryComponent._mod12;
        const scaleSteps = ChordDirectoryComponent.SCALE_FORMULAS[scaleName];
        if (!scaleSteps) return null;

        const scaleRootPc = ChordDirectoryComponent.NOTE_TO_PC[scaleRoot];
        if (scaleRootPc === undefined) return null;

        const scalePcSet = new Set(scaleSteps.map(s => mod12(scaleRootPc + s)));
        const tensionOffset = ChordDirectoryComponent.TENSION_OFFSETS[tensionDegree];
        if (tensionOffset === undefined) return null;

        const tensionPc = mod12(chordRootPc + tensionOffset);
        return scalePcSet.has(tensionPc) ? tensionPc : null;
    }

    /**
     * Generate single-tension voicings for a given voicing type.
     * For each base chord, each allowed tension substitution, and each
     * inversion layout, find all playable fret combinations.
     *
     * @param {'rootPos'|'drop2'|'drop3'} voicingType
     */
    _computeTensionVoicings(keyRaw, scaleName, stringNumber, fret, voicingType) {
        const mod12 = ChordDirectoryComponent._mod12;
        const keyName = ChordDirectoryComponent._normaliseKeyInput(keyRaw);
        if (!keyName) return [];

        const selectedPc = mod12(ChordDirectoryComponent.OPEN_STRING_MIDI[stringNumber] + fret);
        const chords = ChordDirectoryComponent._getDiatonic7thChords(keyName, scaleName);
        const results = [];

        // Choose string sets and inversion parameters per voicing type
        const isRootPos = voicingType === 'rootPos';
        const isDrop2   = voicingType === 'drop2';
        const isDrop3   = voicingType === 'drop3';

        const stringSets = isDrop3
            ? ChordDirectoryComponent.DROP3_STRING_SETS
            : Object.values(ChordDirectoryComponent.STRING_SET_PRESETS);

        const maxFretSpan = isRootPos ? 4 : 5;

        // For root position we only use inversion 0 (root in bass)
        const invCount = isRootPos ? 1 : 4;

        for (const chord of chords) {
            // Look up allowed tensions for this chord quality
            const allowed = ChordDirectoryComponent.TENSION_MATRIX[chord.quality];
            if (!allowed) continue;

            const baseDegreeToOffset = {
                1: chord.formula[0], 3: chord.formula[1],
                5: chord.formula[2], 7: chord.formula[3],
            };

            for (const sub of ChordDirectoryComponent.TENSION_SUBS) {
                // Is this tension allowed on this chord quality?
                if (!allowed[sub.tension]) continue;

                // Is the tension diatonic to the current scale?
                const tensionPc = ChordDirectoryComponent._getDiatonicTensionPc(
                    chord.rootPc, sub.tension, keyName, scaleName
                );
                if (tensionPc === null) continue;

                // Build modified degree → offset map with the substitution applied
                const tensionOffset = ChordDirectoryComponent.TENSION_OFFSETS[sub.tension];
                const degreeToOffset = { ...baseDegreeToOffset };
                // Remove the replaced degree and add the tension degree
                delete degreeToOffset[sub.replaces];
                degreeToOffset[sub.tension] = tensionOffset;

                // Build the modified formula array (sorted by degree for inversion math)
                // We need to keep the formula indexing consistent:
                // index 0 = degree that was 1 (or its replacement)
                // index 1 = degree 3, index 2 = degree 5 (or its replacement), index 3 = degree 7
                const modFormula = [
                    sub.replaces === 1 ? tensionOffset : chord.formula[0],
                    chord.formula[1],
                    sub.replaces === 5 ? tensionOffset : chord.formula[2],
                    chord.formula[3],
                ];

                // Determine which degree sits at each formula index
                const modDegrees = [
                    sub.replaces === 1 ? sub.tension : 1,
                    3,
                    sub.replaces === 5 ? sub.tension : 5,
                    7,
                ];

                // The selected note must belong to the new 4-note set
                const modPcs = new Set(modFormula.map(intv => mod12(chord.rootPc + intv)));
                if (!modPcs.has(selectedPc)) continue;

                for (let inv = 0; inv < invCount; inv++) {
                    // Map closed-position degree order using formula indices
                    const closedIdxOrder = ChordDirectoryComponent.CLOSED_DEGREE_ORDERS[inv];
                    // closedIdxOrder refers to degrees [1,3,5,7] by their traditional position
                    // We need to map: 1→modDegrees[0], 3→modDegrees[1], 5→modDegrees[2], 7→modDegrees[3]
                    const degreeFromIdx = { 1: 0, 3: 1, 5: 2, 7: 3 };
                    const closedDegreeOrder = closedIdxOrder.map(d => modDegrees[degreeFromIdx[d]]);

                    let noteOrder, expectedIntervals;

                    if (isRootPos) {
                        noteOrder = closedDegreeOrder;
                        expectedIntervals = [
                            modFormula[1] - modFormula[0],
                            modFormula[2] - modFormula[1],
                            modFormula[3] - modFormula[2],
                        ];
                    } else {
                        // Build absolute formula for closed inversion
                        const closedAbs = [
                            ...modFormula.slice(inv),
                            ...modFormula.slice(0, inv).map(x => x + 12),
                        ];

                        if (isDrop2) {
                            noteOrder = [closedDegreeOrder[2], closedDegreeOrder[0], closedDegreeOrder[1], closedDegreeOrder[3]];
                            const dropAbs = [closedAbs[2] - 12, closedAbs[0], closedAbs[1], closedAbs[3]];
                            expectedIntervals = [dropAbs[1] - dropAbs[0], dropAbs[2] - dropAbs[1], dropAbs[3] - dropAbs[2]];
                        } else {
                            // Drop 3
                            noteOrder = [closedDegreeOrder[1], closedDegreeOrder[0], closedDegreeOrder[2], closedDegreeOrder[3]];
                            const dropAbs = [closedAbs[1] - 12, closedAbs[0], closedAbs[2], closedAbs[3]];
                            expectedIntervals = [dropAbs[1] - dropAbs[0], dropAbs[2] - dropAbs[1], dropAbs[3] - dropAbs[2]];
                        }
                    }

                    const targetPcs = noteOrder.map(deg => mod12(chord.rootPc + degreeToOffset[deg]));

                    const hits = ChordDirectoryComponent._findVoicingsOnStringSets({
                        targetPcs, stringSets, expectedIntervals,
                        stringNumber, fret, maxFretSpan,
                    });

                    for (const { stringSet, frets, midis } of hits) {
                        const noteNames = targetPcs.map(ChordDirectoryComponent._pcToName);
                        const degrees = ChordDirectoryComponent._degreeLabels(chord.quality, noteOrder);

                        const bassDegree = noteOrder[0];
                        const invName = ChordDirectoryComponent._inversionNameFromBassDegree(bassDegree);
                        const voicingTypeName = isRootPos ? '' : isDrop2 ? 'Drop 2' : 'Drop 3';

                        results.push({
                            displayRoot: chord.root,
                            displayQuality: ChordDirectoryComponent._tensionQualityDisplayName(chord.quality, sub.tension),
                            displayInversion: invName,
                            degrees,
                            voicingMap: ChordDirectoryComponent._buildVoicingMap(stringSet, frets, noteNames, degrees),
                            stringGroup: ChordDirectoryComponent._stringSetLabel(stringSet),
                            frets,
                            hasB9Interval: ChordDirectoryComponent._hasB9Interval(midis),
                            tensionSub: sub.label,
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
