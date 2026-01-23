// FretNote Web Component
class FretNoteComponent extends HTMLElement {
    // Static properties for template caching (shared across all instances)
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;
    
    // Static property for note data (shared across all instances)
    static noteData = null;
    static noteDataLoaded = false;
    static noteDataPromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // Define which attributes trigger attributeChangedCallback
    static get observedAttributes() {
        return ['string-name', 'fret-number', 'active', 'show-info', 'display-mode'];
    }

    // All notes in chromatic order for degree calculation
    static chromaticNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Map for scale degree display names
    static degreeNames = {
        0: '1',
        1: 'b2',
        2: '2',
        3: 'b3',
        4: '3',
        5: '4',
        6: 'b5',  // Default, will be overridden to #4 for Lydian scales
        7: '5',
        8: 'b6',
        9: '6',
        10: 'b7',
        11: '7'
    };

    // Scales that use #4 instead of b5
    static sharpFourScales = ['Lydian', 'Lydian Augmented', 'Lydian Dominant'];

    // Scale formulas as semitone intervals from root
    static scaleFormulas = {
        // Major modes
        'Major': [0, 2, 4, 5, 7, 9, 11],
        'Dorian': [0, 2, 3, 5, 7, 9, 10],
        'Phrygian': [0, 1, 3, 5, 7, 8, 10],
        'Lydian': [0, 2, 4, 6, 7, 9, 11],
        'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
        'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
        'Locrian': [0, 1, 3, 5, 6, 8, 10],
        // Harmonic Minor
        'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
        // Melodic Minor modes
        'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
        'Dorian b2': [0, 1, 3, 5, 7, 9, 10],
        'Lydian Augmented': [0, 2, 4, 6, 8, 9, 11],
        'Lydian Dominant': [0, 2, 4, 6, 7, 9, 10],
        'Mixolydian b6': [0, 2, 4, 5, 7, 8, 10],
        'Locrian #2': [0, 2, 3, 5, 6, 8, 10],
        'Super Locrian': [0, 1, 3, 4, 6, 8, 10],
        'Altered': [0, 1, 3, 4, 6, 8, 10],
        // Other scales
        'Pentatonic Major': [0, 2, 4, 7, 9],
        'Pentatonic Minor': [0, 3, 5, 7, 10],
        'Blues': [0, 3, 5, 6, 7, 10],
        'Whole Tone': [0, 2, 4, 6, 8, 10],
        'Diminished': [0, 2, 3, 5, 6, 8, 9, 11],
        'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    };

    // Map string-name attribute values to JSON string names
    static stringNameMap = {
        'low-e': 'Low E',
        'a': 'A',
        'd': 'D',
        'g': 'G',
        'b': 'B',
        'high-e': 'High E'
    };

    async connectedCallback() {
        // Load template if not already loaded (singleton pattern)
        if (!FretNoteComponent.templateLoaded) {
            if (!FretNoteComponent.templatePromise) {
                FretNoteComponent.templatePromise = this._loadTemplate();
            }
            await FretNoteComponent.templatePromise;
        }

        // Load note data if not already loaded (singleton pattern)
        if (!FretNoteComponent.noteDataLoaded) {
            if (!FretNoteComponent.noteDataPromise) {
                FretNoteComponent.noteDataPromise = this._loadNoteData();
            }
            await FretNoteComponent.noteDataPromise;
        }

        // Clone template and apply to shadow DOM
        const templateContent = FretNoteComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        // Initialize component
        this._updateNoteDisplay();

        // Add click handler to toggle active state
        this._setupClickHandler();
        
        // Listen for scale-selector root changes
        this._setupScaleListener();
    }

    _setupClickHandler() {
        const noteMarker = this.shadowRoot.querySelector('.NoteMarker');
        if (noteMarker) {
            noteMarker.addEventListener('click', () => {
                this.toggleAttribute('active');
            });
        }
    }

    _setupScaleListener() {
        // Listen for changes on the scale-selector (root or name)
        this._scaleChangeHandler = (e) => {
            if (e.detail && (e.detail.field === 'root' || e.detail.field === 'name')) {
                this._updateNoteDisplay();
                this._updateInScaleState();
            }
        };
        document.addEventListener('change', this._scaleChangeHandler);
    }

    disconnectedCallback() {
        // Clean up event listener when component is removed
        if (this._scaleChangeHandler) {
            document.removeEventListener('change', this._scaleChangeHandler);
        }
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/fret-note-component.html');
            const html = await response.text();
            
            // Create a temporary container to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            FretNoteComponent.template = temp.querySelector('#fret-note-template');
            FretNoteComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load fret-note template:', error);
        }
    }

    async _loadNoteData() {
        try {
            const response = await fetch('Assets/string-and-fret-note.json');
            FretNoteComponent.noteData = await response.json();
            FretNoteComponent.noteDataLoaded = true;
        } catch (error) {
            console.error('Failed to load note data:', error);
        }
    }

    // Look up the note from the JSON data based on string name and fret number
    _getNoteForPosition(stringName, fretNumber) {
        if (!FretNoteComponent.noteData) return '';
        
        // Convert attribute string-name to JSON format
        const jsonStringName = FretNoteComponent.stringNameMap[stringName];
        if (!jsonStringName) return '';
        
        let fret = parseInt(fretNumber);
        if (isNaN(fret)) return '';
        
        // Notes repeat after fret 12, so fret 13 = fret 1, fret 14 = fret 2, etc.
        if (fret > 12) {
            fret = ((fret - 1) % 12) + 1;
        }
        
        // Find the matching entry in the JSON data
        const noteEntry = FretNoteComponent.noteData.find(
            entry => entry['string-name'] === jsonStringName && entry['Fret'] === fret
        );
        
        return noteEntry ? noteEntry['Note'] : '';
    }

    _updateNoteDisplay() {
        const stringName = this.getAttribute('string-name');
        const fretNumber = this.getAttribute('fret-number');
        const displayMode = this.getAttribute('display-mode') || 'note';
        
        const note = this._getNoteForPosition(stringName, fretNumber);
        
        const noteTextEl = this.shadowRoot.querySelector('.NoteText');
        if (noteTextEl) {
            if (displayMode === 'degree') {
                const degree = this._getScaleDegree(note);
                noteTextEl.textContent = degree;
            } else {
                noteTextEl.textContent = note;
            }
        }
        
        // Update in-scale state
        this._updateInScaleState();
    }

    _updateInScaleState() {
        const stringName = this.getAttribute('string-name');
        const fretNumber = this.getAttribute('fret-number');
        const note = this._getNoteForPosition(stringName, fretNumber);
        
        if (this._isNoteInScale(note)) {
            this.setAttribute('in-scale', '');
        } else {
            this.removeAttribute('in-scale');
        }
    }

    _isNoteInScale(note) {
        if (!note) return false;
        
        // Get the root and scale name from the scale-selector component
        const scaleSelector = document.querySelector('scale-selector');
        const rootNote = scaleSelector ? scaleSelector.getAttribute('root') : 'C';
        const scaleName = scaleSelector ? scaleSelector.getAttribute('name') : 'Major';
        
        // Get the scale formula
        const scaleFormula = FretNoteComponent.scaleFormulas[scaleName];
        if (!scaleFormula) return false;
        
        // Normalize notes
        const normalizedNote = this._normalizeNote(note);
        const normalizedRoot = this._normalizeNote(rootNote);
        
        const noteIndex = FretNoteComponent.chromaticNotes.indexOf(normalizedNote);
        const rootIndex = FretNoteComponent.chromaticNotes.indexOf(normalizedRoot);
        
        if (noteIndex === -1 || rootIndex === -1) return false;
        
        // Calculate semitone distance from root
        const semitones = (noteIndex - rootIndex + 12) % 12;
        
        // Check if this interval is in the scale formula
        return scaleFormula.includes(semitones);
    }

    _getScaleDegree(note) {
        if (!note) return '';
        
        // Get the root note and scale name from the scale-selector component
        const scaleSelector = document.querySelector('scale-selector');
        const rootNote = scaleSelector ? scaleSelector.getAttribute('root') : 'C';
        const scaleName = scaleSelector ? scaleSelector.getAttribute('name') : 'Major';
        
        // Normalize note (handle flats by converting to sharps equivalent)
        const normalizedNote = this._normalizeNote(note);
        const normalizedRoot = this._normalizeNote(rootNote);
        
        const noteIndex = FretNoteComponent.chromaticNotes.indexOf(normalizedNote);
        const rootIndex = FretNoteComponent.chromaticNotes.indexOf(normalizedRoot);
        
        if (noteIndex === -1 || rootIndex === -1) return note;
        
        // Calculate semitone distance from root
        const semitones = (noteIndex - rootIndex + 12) % 12;
        
        // Handle #4 vs b5 based on scale context
        if (semitones === 6 && FretNoteComponent.sharpFourScales.includes(scaleName)) {
            return '#4';
        }
        
        return FretNoteComponent.degreeNames[semitones] || note;
    }

    _normalizeNote(note) {
        // Convert flats to sharps for consistent lookup
        const flatToSharp = {
            'Db': 'C#',
            'Eb': 'D#',
            'Fb': 'E',
            'Gb': 'F#',
            'Ab': 'G#',
            'Bb': 'A#',
            'Cb': 'B'
        };
        return flatToSharp[note] || note;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        // Guard: only update if template is loaded
        if (!this.shadowRoot.querySelector('.NoteMarker')) return;

        switch (name) {
            case 'string-name':
            case 'fret-number':
            case 'display-mode':
                this._updateNoteDisplay();
                break;
        }
    }
}

// Register the custom element
customElements.define('fret-note', FretNoteComponent);
