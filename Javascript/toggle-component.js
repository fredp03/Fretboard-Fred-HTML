// Toggle Web Component
class ToggleComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;
    static keyboardListenersAttached = false;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['label', 'height', 'checked', 'persist-key', 'target', 'controls-visibility', 'mode', 'modes'];
    }

    async connectedCallback() {
        if (!ToggleComponent.templateLoaded) {
            if (!ToggleComponent.templatePromise) {
                ToggleComponent.templatePromise = this._loadTemplate();
            }
            await ToggleComponent.templatePromise;
        }

        const templateContent = ToggleComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        // Restore persisted state before binding
        this._restorePersistedState();

        this._bindAttributes();
        this._setupEventHandlers();

        // Apply to targets after a delay to allow other components to render
        setTimeout(() => this._applyToTargets(), 100);
    }

    _restorePersistedState() {
        const persistKey = this.getAttribute('persist-key');
        if (persistKey) {
            // Check if this is a mode-based toggle
            const modes = this.getAttribute('modes');
            if (modes) {
                const savedMode = localStorage.getItem(persistKey);
                if (savedMode) {
                    this.setAttribute('mode', savedMode);
                }
            } else {
                const savedState = localStorage.getItem(persistKey) === 'true';
                if (savedState) {
                    this.setAttribute('checked', '');
                } else {
                    this.removeAttribute('checked');
                }
            }
        }
    }

    _savePersistedState() {
        const persistKey = this.getAttribute('persist-key');
        if (persistKey) {
            const modes = this.getAttribute('modes');
            if (modes) {
                localStorage.setItem(persistKey, this.getAttribute('mode'));
            } else {
                localStorage.setItem(persistKey, this.hasAttribute('checked'));
            }
        }
    }

    // Get all fret-note elements from nested shadow DOMs
    _getAllFretNotes() {
        const fretNotes = [];
        const fretboard = document.querySelector('fretboard-neck');
        if (fretboard && fretboard.shadowRoot) {
            const fretDots = fretboard.shadowRoot.querySelectorAll('fret-single-dot');
            fretDots.forEach(dot => {
                if (dot.shadowRoot) {
                    const notes = dot.shadowRoot.querySelectorAll('fret-note');
                    notes.forEach(note => fretNotes.push(note));
                }
            });
        }
        return fretNotes;
    }

    _applyToTargets() {
        const target = this.getAttribute('target');
        const controlsVisibility = this.getAttribute('controls-visibility');
        const checked = this.hasAttribute('checked');
        const mode = this.getAttribute('mode');

        if (target === 'fret-notes') {
            const fretNotes = this._getAllFretNotes();
            fretNotes.forEach(note => {
                if (checked) {
                    note.setAttribute('show-info', '');
                } else {
                    note.removeAttribute('show-info');
                }
            });
        }

        // Handle display-mode for fret-notes
        if (target === 'fret-notes-display') {
            const fretNotes = this._getAllFretNotes();
            const displayMode = mode === 'Degree' ? 'degree' : 'note';
            fretNotes.forEach(note => {
                note.setAttribute('display-mode', displayMode);
            });
        }

        if (controlsVisibility) {
            const targetEl = document.getElementById(controlsVisibility);
            if (targetEl) {
                targetEl.style.display = checked ? '' : 'none';
            }
        }
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/toggle-component.html');
            const html = await response.text();
            
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            ToggleComponent.template = temp.querySelector('#toggle-template');
            ToggleComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load toggle template:', error);
        }
    }

    _bindAttributes() {
        const label = this.getAttribute('label') || 'Label';
        const height = this.getAttribute('height') || '25';
        const checked = this.hasAttribute('checked');
        const modes = this.getAttribute('modes');
        const mode = this.getAttribute('mode');

        // If this is a mode-based toggle, set label to current mode
        if (modes) {
            const modeList = modes.split(',').map(m => m.trim());
            const currentMode = mode || modeList[0];
            if (!mode) {
                this.setAttribute('mode', currentMode);
            }
            this._updateBinding('label', currentMode);
            // Toggle position based on mode index (0 = left/unchecked, 1 = right/checked)
            const modeIndex = modeList.indexOf(currentMode);
            this._updateCheckedState(modeIndex > 0);
        } else {
            this._updateBinding('label', label);
            this._updateCheckedState(checked);
        }
        
        this._updateHeight(height);
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _updateHeight(height) {
        const slider = this.shadowRoot.querySelector('.Slider');
        if (slider) {
            slider.style.setProperty('--toggle-height', `${height}px`);
        }
    }

    _updateCheckedState(checked) {
        const knob = this.shadowRoot.querySelector('.SliderKnob');
        const slider = this.shadowRoot.querySelector('.Slider');
        if (knob) {
            knob.classList.toggle('checked', checked);
        }
        if (slider) {
            slider.classList.toggle('checked', checked);
        }
    }

    _toggle() {
        const modes = this.getAttribute('modes');
        
        if (modes) {
            // Cycle through modes
            const modeList = modes.split(',').map(m => m.trim());
            const currentMode = this.getAttribute('mode') || modeList[0];
            const currentIndex = modeList.indexOf(currentMode);
            const nextIndex = (currentIndex + 1) % modeList.length;
            const nextMode = modeList[nextIndex];
            
            this.setAttribute('mode', nextMode);
            this._updateBinding('label', nextMode);
            // Update visual state (0 = left/unchecked, 1+ = right/checked)
            this._updateCheckedState(nextIndex > 0);
            
            this._savePersistedState();
            this._applyToTargets();
            
            this.dispatchEvent(new CustomEvent('change', {
                bubbles: true,
                detail: { mode: nextMode }
            }));
        } else {
            if (this.hasAttribute('checked')) {
                this.removeAttribute('checked');
            } else {
                this.setAttribute('checked', '');
            }
            
            this._savePersistedState();
            this._applyToTargets();
            
            this.dispatchEvent(new CustomEvent('change', {
                bubbles: true,
                detail: { checked: this.hasAttribute('checked') }
            }));
        }
    }

    _setupEventHandlers() {
        const slider = this.shadowRoot.querySelector('.Slider');
        if (slider) {
            slider.addEventListener('click', () => this._toggle());
        }
        ToggleComponent._ensureKeyboardListeners();
    }

    static _ensureKeyboardListeners() {
        if (ToggleComponent.keyboardListenersAttached) return;
        ToggleComponent.keyboardListenersAttached = true;

        const isEditableTarget = (e) => {
            const path = e.composedPath ? e.composedPath() : [e.target];
            return path.some(el => {
                if (!(el instanceof HTMLElement)) return false;
                if (el.isContentEditable) return true;
                return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
            });
        };

        window.addEventListener('keydown', (e) => {
            if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
            if (isEditableTarget(e)) return;

            if (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') {
                const toggle = document.getElementById('note-names-toggle');
                if (toggle && typeof toggle._toggle === 'function') toggle._toggle();
            }

            // S key: toggle between scale degrees and chord degrees
            if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
                FretNoteComponent._toggleChordDegreeMode();
            }

            if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
                FretNoteComponent.instances.forEach((note) => {
                    if (note.hasAttribute('active')) {
                        note.removeAttribute('active');
                        note.removeAttribute('pinned');
                        const str = note.getAttribute('string-name');
                        const fret = note.getAttribute('fret-number');
                        const noteName = note._getNoteForPosition(str, fret);
                        const degree = note._getScaleDegree(noteName);
                        document.dispatchEvent(new CustomEvent('note-selection-changed', {
                            detail: { id: `${str}-${fret}`, note: noteName, degree, stringName: str, active: false }
                        }));
                    }
                });
            }
        }, { capture: true });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        if (!this.shadowRoot.querySelector('.ToggleWrapper')) return;

        switch (name) {
            case 'label':
                this._updateBinding('label', newValue);
                break;
            case 'height':
                this._updateHeight(newValue);
                break;
            case 'checked':
                this._updateCheckedState(newValue !== null);
                break;
        }
    }
}

// Register the custom element
customElements.define('toggle-component', ToggleComponent);
