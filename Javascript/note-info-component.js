// Note Info Web Component
class NoteInfoComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    // Guitar strings in order from lowest to highest pitch (index 0 = bass)
    static STRING_ORDER = ['low-e', 'a', 'd', 'g', 'b', 'high-e'];

    // All groups of 3 consecutive strings (closed-voicing windows)
    static STRING_GROUPS = [
        ['low-e', 'a',    'd'],
        ['a',    'd',    'g'],
        ['d',    'g',    'b'],
        ['g',    'b',    'high-e']
    ];

    static CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    static SCALE_FORMULAS = {
        'Major':                [0, 2, 4, 5, 7, 9, 11],
        'Dorian':               [0, 2, 3, 5, 7, 9, 10],
        'Phrygian':             [0, 1, 3, 5, 7, 8, 10],
        'Lydian':               [0, 2, 4, 6, 7, 9, 11],
        'Mixolydian':           [0, 2, 4, 5, 7, 9, 10],
        'Natural Minor':        [0, 2, 3, 5, 7, 8, 10],
        'Locrian':              [0, 1, 3, 5, 6, 8, 10],
        'Harmonic Minor':       [0, 2, 3, 5, 7, 8, 11],
        'Locrian #6':           [0, 1, 3, 5, 6, 9, 10],
        'Ionian Augmented':     [0, 2, 4, 5, 8, 9, 11],
        'Dorian #4':            [0, 2, 3, 6, 7, 9, 10],
        'Phrygian Dominant':    [0, 1, 4, 5, 7, 8, 10],
        'Lydian #2':            [0, 3, 4, 6, 7, 9, 11],
        'Super Locrian bb7':    [0, 1, 3, 4, 6, 8, 9],
        'Melodic Minor':        [0, 2, 3, 5, 7, 9, 11],
        'Dorian b2':            [0, 1, 3, 5, 7, 9, 10],
        'Lydian Augmented':     [0, 2, 4, 6, 8, 9, 11],
        'Lydian Dominant':      [0, 2, 4, 6, 7, 9, 10],
        'Mixolydian b6':        [0, 2, 4, 5, 7, 8, 10],
        'Locrian #2':           [0, 2, 3, 5, 6, 8, 10],
        'Super Locrian':        [0, 1, 3, 4, 6, 8, 10],
        'Altered':              [0, 1, 3, 4, 6, 8, 10],
    };

    static FLAT_TO_SHARP = {
        'Db': 'C#', 'Eb': 'D#', 'Fb': 'E',
        'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
    };

    // Open-string MIDI note numbers (standard tuning)
    static STRING_OPEN_MIDI = {
        'low-e':  40,  // E2
        'a':      45,  // A2
        'd':      50,  // D3
        'g':      55,  // G3
        'b':      59,  // B3
        'high-e': 64   // E4
    };

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._selectedNotes = [];
        this._currentTriadNote = null; // { id, note, stringName } for available-triads mode
        this._rowVoicings = []; // [{ row, voicing }] for bold-state tracking
    }

    static get observedAttributes() {
        return ['title', 'rows'];
    }

    async connectedCallback() {
        if (!NoteInfoComponent.templateLoaded) {
            if (!NoteInfoComponent.templatePromise) {
                NoteInfoComponent.templatePromise = this._loadTemplate();
            }
            await NoteInfoComponent.templatePromise;
        }

        const templateContent = NoteInfoComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/old-note-info-component.html');
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html;

            NoteInfoComponent.template = temp.querySelector('#note-info-template');
            NoteInfoComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load note-info template:', error);
        }
    }

    _bindAttributes() {
        // Bind title
        const title = this.getAttribute('title') || 'Available Triads';
        this._updateBinding('title', title);

        // Bind rows data
        const rowsAttr = this.getAttribute('rows');
        if (rowsAttr) {
            try {
                const rows = JSON.parse(rowsAttr);
                this._renderRows(rows);
            } catch (error) {
                console.error('Failed to parse rows JSON:', error);
            }
        }
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _renderRows(rows) {
        const wrapper = this.shadowRoot.querySelector('.TableRowsWrapper');
        if (!wrapper) return;

        // Clear existing rows and voicing references
        wrapper.innerHTML = '';
        this._rowVoicings = [];

        // Create rows from data
        rows.forEach(rowData => {
            const row = this._createTableRow(rowData.root, rowData.quality, rowData.inversion, rowData.voicing);
            wrapper.appendChild(row);
        });
    }

    _createTableRow(root, quality, inversion, voicing = null) {
        const row = document.createElement('div');
        row.className = 'TableRow';

        const rootAndQuality = document.createElement('div');
        rootAndQuality.className = 'RootAndQuality';

        const rootEl = document.createElement('div');
        rootEl.className = 'Root';
        rootEl.textContent = root;

        const qualityEl = document.createElement('div');
        qualityEl.className = 'Quality';
        qualityEl.textContent = quality;

        rootAndQuality.appendChild(rootEl);
        rootAndQuality.appendChild(qualityEl);

        row.appendChild(rootAndQuality);

        // Only add inversion if provided
        if (inversion !== undefined && inversion !== null && inversion !== '') {
            const inversionWrapper = document.createElement('div');
            inversionWrapper.className = 'InversionWrapper';

            const inversionEl = document.createElement('div');
            inversionEl.className = 'Inversion';
            
            // Handle special formatting for ordinal numbers
            if (inversion.includes('st') || inversion.includes('nd') || inversion.includes('rd') || inversion.includes('th')) {
                const match = inversion.match(/^(\d+)(st|nd|rd|th)$/);
                if (match) {
                    const span = document.createElement('span');
                    span.textContent = match[1];
                    const sup = document.createElement('sup');
                    sup.textContent = match[2];
                    inversionEl.appendChild(span);
                    inversionEl.appendChild(sup);
                } else {
                    inversionEl.textContent = inversion;
                }
            } else {
                inversionEl.textContent = inversion;
            }

            inversionWrapper.appendChild(inversionEl);
            row.appendChild(inversionWrapper);
        }

        if (voicing) {
            this._rowVoicings.push({ row, voicing });
            row.style.cursor = 'pointer';
            row.addEventListener('mouseenter', () => {
                document.dispatchEvent(new CustomEvent('triad-preview-start', { detail: { voicing } }));
            });
            row.addEventListener('mouseleave', () => {
                document.dispatchEvent(new CustomEvent('triad-preview-end'));
            });
            row.addEventListener('click', (e) => {
                this._suppressNoteChanges = true;
                document.dispatchEvent(new CustomEvent('triad-preview-end'));
                document.dispatchEvent(new CustomEvent('triad-select', { detail: { voicing, additive: e.shiftKey } }));
                setTimeout(() => {
                    this._suppressNoteChanges = false;
                    this._updateTriadBoldStates();
                }, 0);
            });
        }

        return row;
    }

    _setupEventHandlers() {
        // ── Available-triads mode ──────────────────────────────────────────────
        if (this.hasAttribute('available-triads')) {
            this._noteSelectionHandler = (e) => {
                if (this._suppressNoteChanges) return;
                const { id, note, stringName, active } = e.detail;
                if (active) {
                    this._currentTriadNote = { id, note, stringName };
                } else if (this._currentTriadNote && this._currentTriadNote.id === id) {
                    this._currentTriadNote = null;
                }
                this._renderAvailableTriads();
            };

            this._scaleChangeHandler = (e) => {
                if (e.detail && (e.detail.field === 'root' || e.detail.field === 'name')) {
                    this._renderAvailableTriads();
                }
            };

            document.addEventListener('note-selection-changed', this._noteSelectionHandler);
            document.addEventListener('change', this._scaleChangeHandler);
            return;
        }

        // ── Selected-notes mode ───────────────────────────────────────────────
        if (!this.hasAttribute('selected-notes')) return;

        this._noteSelectionHandler = (e) => {
            const { id, note, active } = e.detail;
            if (active) {
                if (!this._selectedNotes.find(n => n.id === id)) {
                    this._selectedNotes.push({ id, note });
                }
            } else {
                this._selectedNotes = this._selectedNotes.filter(n => n.id !== id);
            }
            this._renderSelectedNotes();
        };

        this._scaleChangeHandler = (e) => {
            if (e.detail && (e.detail.field === 'root' || e.detail.field === 'name')) {
                this._renderSelectedNotes();
            }
        };

        document.addEventListener('note-selection-changed', this._noteSelectionHandler);
        document.addEventListener('change', this._scaleChangeHandler);
    }

    // ── Triad-engine helpers ─────────────────────────────────────────────────

    _normalizeForTriad(note) {
        return NoteInfoComponent.FLAT_TO_SHARP[note] || note;
    }

    _computeAvailableTriads(selectedNote, selectedString, selectedFret) {
        const scaleSelector = document.querySelector('scale-selector');
        const scaleRoot = scaleSelector ? (scaleSelector.getAttribute('root') || 'C') : 'C';
        const scaleName = scaleSelector ? (scaleSelector.getAttribute('name') || 'Major') : 'Major';

        const formula = NoteInfoComponent.SCALE_FORMULAS[scaleName];
        // Only compute diatonic triads for 7-note scales
        if (!formula || formula.length < 7) return [];

        const chromatic = NoteInfoComponent.CHROMATIC;
        const norm = (n) => this._normalizeForTriad(n);

        const rootIdx = chromatic.indexOf(norm(scaleRoot));
        if (rootIdx === -1) return [];

        // Build the 7 scale note names
        const scaleNotes = formula.map(interval => chromatic[(rootIdx + interval) % 12]);

        // Build diatonic triads (stacking 3rds: positions i, i+2, i+4 within scale)
        const triads = scaleNotes.map((root, i) => {
            const third = scaleNotes[(i + 2) % 7];
            const fifth = scaleNotes[(i + 4) % 7];

            const ri = chromatic.indexOf(root);
            const ti = chromatic.indexOf(third);
            const fi = chromatic.indexOf(fifth);
            const thirdSemitones = (ti - ri + 12) % 12;
            const fifthSemitones = (fi - ri + 12) % 12;

            let quality;
            if      (thirdSemitones === 4 && fifthSemitones === 7) quality = 'Major';
            else if (thirdSemitones === 3 && fifthSemitones === 7) quality = 'Minor';
            else if (thirdSemitones === 3 && fifthSemitones === 6) quality = 'Dim.';
            else if (thirdSemitones === 4 && fifthSemitones === 8) quality = 'Aug.';
            else quality = 'Sus';

            return { root, third, fifth, quality, notes: [root, third, fifth] };
        });

        // Helper: return the fret that produces noteClass on stringName.
        // For the user-selected string, use the exact selected fret.
        // For other strings, find the lowest fret (≥1) that gives the note.
        const fretForNoteOnString = (noteClass, stringName) => {
            if (stringName === selectedString) return parseInt(selectedFret);
            const openMidi = NoteInfoComponent.STRING_OPEN_MIDI[stringName];
            const openClass = openMidi % 12;
            const sfo = (noteClass - openClass + 12) % 12;
            return sfo === 0 ? 12 : sfo; // fret 0 = open string, use fret 12 instead
        };

        // Helper: MIDI pitch for a string+fret
        const midiForFret = (stringName, fret) => NoteInfoComponent.STRING_OPEN_MIDI[stringName] + fret;

        // Find groups the selected string belongs to
        const groups = NoteInfoComponent.STRING_GROUPS.filter(g => g.includes(selectedString));
        const normSelected = norm(selectedNote);

        const seen = new Set();
        const results = [];

        for (const group of groups) {
            const otherStrings = group.filter(s => s !== selectedString);

            for (const triad of triads) {
                // Skip triads that don't contain the selected note
                if (!triad.notes.some(n => norm(n) === normSelected)) continue;

                // The two notes that need to go on the other two strings
                const otherNotes = triad.notes.filter(n => norm(n) !== normSelected);
                if (otherNotes.length !== 2) continue;

                // Try both assignments of otherNotes to otherStrings
                const arrangements = [
                    { [selectedString]: selectedNote, [otherStrings[0]]: otherNotes[0], [otherStrings[1]]: otherNotes[1] },
                    { [selectedString]: selectedNote, [otherStrings[0]]: otherNotes[1], [otherStrings[1]]: otherNotes[0] }
                ];

                for (const arr of arrangements) {
                    const bassString = group[0]; // lowest string in the group
                    const bassNote   = norm(arr[bassString]);
                    const triadRoot  = norm(triad.root);
                    const triadThird = norm(triad.third);
                    const triadFifth = norm(triad.fifth);

                    let inversion;
                    if      (bassNote === triadRoot)  inversion = 'Root';
                    else if (bassNote === triadThird) inversion = '1st';
                    else if (bassNote === triadFifth) inversion = '2nd';
                    else continue;

                    // Compute actual fret for every string in this arrangement
                    const voicing = {};
                    for (const s of group) {
                        const nc = chromatic.indexOf(norm(arr[s]));
                        const fret = fretForNoteOnString(nc, s);
                        voicing[s] = { note: arr[s], fret };
                    }

                    // Validate fret spread: max − min must be ≤ 4
                    const frets = group.map(s => voicing[s].fret);
                    const spread = Math.max(...frets) - Math.min(...frets);
                    if (spread > 4) continue;

                    // Validate ascending pitch (closed voicing) using the real frets
                    const pitches = group.map(s => midiForFret(s, voicing[s].fret));
                    const isAscending = pitches[0] < pitches[1] && pitches[1] < pitches[2];
                    if (!isAscending) continue;

                    const key = `${triad.root}-${triad.quality}-${inversion}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({ root: triad.root, quality: triad.quality, inversion, voicing });
                    }
                }
            }
        }

        // Group inversions of the same root+quality together, preserving
        // the order in which each root first appears.
        const inversionOrder = { 'Root': 0, '1st': 1, '2nd': 2 };
        const groupKey = r => `${r.root}|${r.quality}`;
        const firstSeen = new Map();
        results.forEach((r, i) => {
            const k = groupKey(r);
            if (!firstSeen.has(k)) firstSeen.set(k, i);
        });
        results.sort((a, b) => {
            const ga = firstSeen.get(groupKey(a));
            const gb = firstSeen.get(groupKey(b));
            if (ga !== gb) return ga - gb;
            return (inversionOrder[a.inversion] ?? 99) - (inversionOrder[b.inversion] ?? 99);
        });

        return results;
    }

    _renderAvailableTriads() {
        if (!this._currentTriadNote) {
            this._renderRows([]);
            return;
        }
        const { note, stringName, id } = this._currentTriadNote;
        // id format: `${stringName}-${fretNumber}` — extract fret after last hyphen
        const fretNumber = id.slice(id.lastIndexOf('-') + 1);
        const rows = this._computeAvailableTriads(note, stringName, fretNumber);
        this._renderRows(rows);
        this._updateTriadBoldStates();
    }

    _updateTriadBoldStates() {
        if (!this._rowVoicings.length) return;

        // Build set of active string+fret combos from the live fret-note elements
        const activeSet = new Set();
        const fretboard = document.querySelector('fretboard-neck');
        if (fretboard && fretboard.shadowRoot) {
            fretboard.shadowRoot.querySelectorAll('fret-single-dot').forEach(dot => {
                if (!dot.shadowRoot) return;
                dot.shadowRoot.querySelectorAll('fret-note').forEach(note => {
                    if (note.hasAttribute('active')) {
                        activeSet.add(`${note.getAttribute('string-name')}-${note.getAttribute('fret-number')}`);
                    }
                });
            });
        }

        this._rowVoicings.forEach(({ row, voicing }) => {
            const fullyActive = Object.entries(voicing).every(
                ([str, { fret }]) => activeSet.has(`${str}-${fret}`)
            );
            row.classList.toggle('triad-selected', fullyActive);
        });
    }

    disconnectedCallback() {
        if (this._noteSelectionHandler) {
            document.removeEventListener('note-selection-changed', this._noteSelectionHandler);
        }
        if (this._scaleChangeHandler) {
            document.removeEventListener('change', this._scaleChangeHandler);
        }
        this._currentTriadNote = null;
    }

    _renderSelectedNotes() {
        const rows = this._selectedNotes.map(({ note }) => ({
            root: note,
            quality: this._computeDegree(note)
        }));
        this._renderRows(rows);
    }

    _computeDegree(note) {
        const chromaticNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const degreeNames = { 0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7' };
        const sharpFourScales = ['Lydian', 'Lydian Augmented', 'Lydian Dominant'];
        const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };
        const normalize = (n) => flatToSharp[n] || n;

        const scaleSelector = document.querySelector('scale-selector');
        const rootNote = scaleSelector ? (scaleSelector.getAttribute('root') || 'C') : 'C';
        const scaleName = scaleSelector ? (scaleSelector.getAttribute('name') || 'Major') : 'Major';

        const noteIndex = chromaticNotes.indexOf(normalize(note));
        const rootIndex = chromaticNotes.indexOf(normalize(rootNote));
        if (noteIndex === -1 || rootIndex === -1) return note;

        const semitones = (noteIndex - rootIndex + 12) % 12;
        if (semitones === 6 && sharpFourScales.includes(scaleName)) return '#4';
        return degreeNames[semitones] ?? note;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (!this.shadowRoot.querySelector('.NoteInfoWrapper')) return;

        switch (name) {
            case 'title':
                this._updateBinding('title', newValue || 'Available Triads');
                break;
            case 'rows':
                if (newValue) {
                    try {
                        const rows = JSON.parse(newValue);
                        this._renderRows(rows);
                    } catch (error) {
                        console.error('Failed to parse rows JSON:', error);
                    }
                }
                break;
        }
    }
}

// Register the custom element
customElements.define('note-info', NoteInfoComponent);
