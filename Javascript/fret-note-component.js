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
            // Harmonic Minor modes
            'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
            'Locrian #6': [0, 1, 3, 5, 6, 9, 10],
            'Ionian Augmented': [0, 2, 4, 5, 8, 9, 11],
            'Dorian #4': [0, 2, 3, 6, 7, 9, 10],
            'Phrygian Dominant': [0, 1, 4, 5, 7, 8, 10],
            'Lydian #2': [0, 3, 4, 6, 7, 9, 11],
            'Super Locrian bb7': [0, 1, 3, 4, 6, 8, 9],
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

    static instances = new Set();
    static scalePeekActive = false;
    static scalePeekLocked = false;
    static _lastPeekKeydownTime = 0;
    static scalePeekListenersAttached = false;
    static triadListenersAttached = false;

    static _setScalePeekActive(active) {
        FretNoteComponent.scalePeekActive = active;
        FretNoteComponent.instances.forEach((note) => {
            if (active) {
                note._updateInScaleState();
                note.setAttribute('scale-peek', '');
            } else {
                note.removeAttribute('scale-peek');
            }
            if (note._applyScalePeekState) {
                note._applyScalePeekState();
            }
        });
    }

    static _isEditableEventTarget(event) {
        const path = event.composedPath ? event.composedPath() : [event.target];
        return path.some((el) => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.isContentEditable) return true;
            const tagName = el.tagName;
            return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
        });
    }

    static _ensureScalePeekListeners() {
        if (FretNoteComponent.scalePeekListenersAttached) return;
        FretNoteComponent.scalePeekListenersAttached = true;

        const isPeekKey = (e) => e.code === 'KeyP' || e.key === 'p' || e.key === 'P';

        window.addEventListener('keydown', (e) => {
            if (!isPeekKey(e)) return;
            if (e.repeat) return;
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (FretNoteComponent._isEditableEventTarget(e)) return;

            const now = Date.now();
            const timeSinceLast = now - FretNoteComponent._lastPeekKeydownTime;
            FretNoteComponent._lastPeekKeydownTime = now;

            if (timeSinceLast < 300) {
                // Double-tap: toggle lock
                if (FretNoteComponent.scalePeekLocked) {
                    FretNoteComponent.scalePeekLocked = false;
                    FretNoteComponent._setScalePeekActive(false);
                } else {
                    FretNoteComponent.scalePeekLocked = true;
                    FretNoteComponent._setScalePeekActive(true);
                }
            } else {
                if (!FretNoteComponent.scalePeekLocked && !FretNoteComponent.scalePeekActive) {
                    FretNoteComponent._setScalePeekActive(true);
                }
            }
        }, { capture: true });

        window.addEventListener('keyup', (e) => {
            if (!isPeekKey(e)) return;
            if (FretNoteComponent.scalePeekLocked) return;
            if (!FretNoteComponent.scalePeekActive) return;
            FretNoteComponent._setScalePeekActive(false);
        }, { capture: true });

        window.addEventListener('blur', () => {
            if (FretNoteComponent.scalePeekLocked) return;
            if (FretNoteComponent.scalePeekActive) {
                FretNoteComponent._setScalePeekActive(false);
            }
        });
    }

    static _ensureTriadListeners() {
        if (FretNoteComponent.triadListenersAttached) return;
        FretNoteComponent.triadListenersAttached = true;

        document.addEventListener('triad-preview-start', (e) => {
            const { voicing } = e.detail;
            FretNoteComponent.instances.forEach((note) => {
                const str = note.getAttribute('string-name');
                const fret = parseInt(note.getAttribute('fret-number'));
                const entry = voicing[str];
                if (entry && parseInt(entry.fret) === fret) {
                    note.setAttribute('triad-preview', '');
                } else {
                    note.removeAttribute('triad-preview');
                }
            });
        });

        document.addEventListener('triad-preview-end', () => {
            FretNoteComponent.instances.forEach((note) => {
                note.removeAttribute('triad-preview');
            });
        });

        document.addEventListener('triad-select', (e) => {
            const { voicing, additive } = e.detail;

            // For shift-click: check if every voicing note is already active.
            // If so, treat this as a removal instead of an addition.
            let removeVoicing = false;
            if (additive) {
                const voicingEntries = Object.entries(voicing);
                removeVoicing = voicingEntries.every(([str, entry]) =>
                    [...FretNoteComponent.instances].some(n =>
                        n.getAttribute('string-name') === str &&
                        parseInt(n.getAttribute('fret-number')) === parseInt(entry.fret) &&
                        n.hasAttribute('active')
                    )
                );
            }

            FretNoteComponent.instances.forEach((note) => {
                const str = note.getAttribute('string-name');
                const fret = parseInt(note.getAttribute('fret-number'));
                const entry = voicing[str];
                const inVoicing = !!(entry && parseInt(entry.fret) === fret);
                const isActive = note.hasAttribute('active');

                const dispatch = (active) => {
                    const noteName = note._getNoteForPosition(str, String(fret));
                    const degree = note._getScaleDegree(noteName);
                    document.dispatchEvent(new CustomEvent('note-selection-changed', {
                        detail: { id: `${str}-${fret}`, note: noteName, degree, stringName: str, active }
                    }));
                };

                if (removeVoicing) {
                    // Shift-click on fully-active triad: deactivate its notes only.
                    if (inVoicing && isActive) {
                        note.removeAttribute('active');
                        dispatch(false);
                    }
                } else if (additive) {
                    // Shift-click on non-fully-active triad: add its notes.
                    if (inVoicing && !isActive) {
                        note.setAttribute('active', '');
                        dispatch(true);
                    }
                } else {
                    // Normal click: replace entire selection.
                    if (inVoicing && !isActive) {
                        note.setAttribute('active', '');
                        dispatch(true);
                    } else if (!inVoicing && isActive) {
                        note.removeAttribute('active');
                        dispatch(false);
                    }
                }
            });
        });
    }

    static _collectInstancesFromDom() {
        const fretboard = document.querySelector('fretboard-neck');
        if (!fretboard || !fretboard.shadowRoot) return;

        const fretDots = fretboard.shadowRoot.querySelectorAll('fret-single-dot');
        fretDots.forEach((dot) => {
            if (!dot.shadowRoot) return;
            const notes = dot.shadowRoot.querySelectorAll('fret-note');
            notes.forEach((note) => FretNoteComponent.instances.add(note));
        });
    }

    async connectedCallback() {
        FretNoteComponent.instances.add(this);
        if (FretNoteComponent.scalePeekActive) {
            this.setAttribute('scale-peek', '');
        }

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

        FretNoteComponent._ensureScalePeekListeners();
        FretNoteComponent._ensureTriadListeners();
    }

    _setupClickHandler() {
        const noteMarker = this.shadowRoot.querySelector('.NoteMarker');
        if (noteMarker) {
            noteMarker.addEventListener('click', () => {
                this.toggleAttribute('active');

                // If activating while peek is on, the note is already visible at 0.4
                // opacity and the CSS transition would produce a noticeable 0→1 lag.
                // Suppress the transition for one frame so the state snaps instantly.
                if (this.hasAttribute('active') && noteMarker.style.opacity !== '') {
                    noteMarker.style.transition = 'none';
                    noteMarker.style.opacity = '';
                    requestAnimationFrame(() => {
                        noteMarker.style.transition = '';
                    });
                } else {
                    this._applyScalePeekState();
                }

                const stringName = this.getAttribute('string-name');
                const fretNumber = this.getAttribute('fret-number');
                const note = this._getNoteForPosition(stringName, fretNumber);
                const degree = this._getScaleDegree(note);
                const isActive = this.hasAttribute('active');

                document.dispatchEvent(new CustomEvent('note-selection-changed', {
                    detail: { id: `${stringName}-${fretNumber}`, note, degree, stringName, active: isActive }
                }));
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

        FretNoteComponent.instances.delete(this);
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

        if (FretNoteComponent.scalePeekActive) {
            this._applyScalePeekState();
        }
    }

    _applyScalePeekState() {
        const noteMarker = this.shadowRoot.querySelector('.NoteMarker');
        if (!noteMarker) return;

        if (FretNoteComponent.scalePeekActive && this.hasAttribute('in-scale') && !this.hasAttribute('active')) {
            noteMarker.style.opacity = '0.4';
        } else {
            noteMarker.style.opacity = '';
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
            case 'active':
                this._applyScalePeekState();
                break;
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
