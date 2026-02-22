// Note Info Web Component
class NoteInfoComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._selectedNotes = [];
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
            const response = await fetch('Components/note-info-component.html');
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

        // Clear existing rows
        wrapper.innerHTML = '';

        // Create rows from data
        rows.forEach(rowData => {
            const row = this._createTableRow(rowData.root, rowData.quality, rowData.inversion);
            wrapper.appendChild(row);
        });
    }

    _createTableRow(root, quality, inversion) {
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

        return row;
    }

    _setupEventHandlers() {
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

    disconnectedCallback() {
        if (this._noteSelectionHandler) {
            document.removeEventListener('note-selection-changed', this._noteSelectionHandler);
        }
        if (this._scaleChangeHandler) {
            document.removeEventListener('change', this._scaleChangeHandler);
        }
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
