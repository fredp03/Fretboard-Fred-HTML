// Fret Single Dot Web Component
class FretSingleDotComponent extends HTMLElement {
    // Static properties for template caching (shared across all instances)
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // Define which attributes trigger attributeChangedCallback
    static get observedAttributes() {
        return ['fret-number'];
    }

    // Getter for fret number
    get fretNumber() {
        return this.getAttribute('fret-number');
    }

    // Setter for fret number
    set fretNumber(value) {
        if (value !== null) {
            this.setAttribute('fret-number', value);
        } else {
            this.removeAttribute('fret-number');
        }
    }

    async connectedCallback() {
        // Load template if not already loaded (singleton pattern)
        if (!FretSingleDotComponent.templateLoaded) {
            if (!FretSingleDotComponent.templatePromise) {
                FretSingleDotComponent.templatePromise = this._loadTemplate();
            }
            await FretSingleDotComponent.templatePromise;
        }

        // Clone template and apply to shadow DOM
        const templateContent = FretSingleDotComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        // Initialize component
        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/fret-single-dot-component.html');
            const html = await response.text();
            
            // Create a temporary container to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            FretSingleDotComponent.template = temp.querySelector('#fret-single-dot-template');
            FretSingleDotComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load fret-single-dot template:', error);
        }
    }

    _bindAttributes() {
        // Pass fret-number to all fret-note children
        this._updateFretNotes();
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _updateFretNotes() {
        // Pass the fret-number to all fret-note components
        const fretNumber = this.getAttribute('fret-number');
        if (fretNumber) {
            const fretNotes = this.shadowRoot.querySelectorAll('fret-note');
            fretNotes.forEach(note => {
                note.setAttribute('fret-number', fretNumber);
            });
        }
    }

    _setupEventHandlers() {
        // Add event listeners and interactive behavior
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        // Guard: only update if template is loaded
        if (!this.shadowRoot.querySelector('.FretSingleDotWrapper')) return;

        switch (name) {
            case 'fret-number':
                this._updateFretNotes();
                break;
        }
    }
}

// Register the custom element
customElements.define('fret-single-dot', FretSingleDotComponent);
