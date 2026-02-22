// Note Info Web Component
class NoteInfoComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
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
