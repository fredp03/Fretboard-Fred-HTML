// Saved Chord Selection Web Component
class SavedChordSelectionComponent extends HTMLElement {
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
        return ['chord-name', 'voicing', 'inversion'];
    }

    async connectedCallback() {
        // Load template if not already loaded (singleton pattern)
        if (!SavedChordSelectionComponent.templateLoaded) {
            if (!SavedChordSelectionComponent.templatePromise) {
                SavedChordSelectionComponent.templatePromise = this._loadTemplate();
            }
            await SavedChordSelectionComponent.templatePromise;
        }

        // Clone template and apply to shadow DOM
        const templateContent = SavedChordSelectionComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        // Initialize component
        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/saved-chord-selection-component.html');
            const html = await response.text();

            // Create a temporary container to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;

            SavedChordSelectionComponent.template = temp.querySelector('#saved-chord-selection-template');
            SavedChordSelectionComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load saved-chord-selection template:', error);
        }
    }

    _bindAttributes() {
        this._updateBinding('chord-name', this.getAttribute('chord-name') || 'Chord Name');
        this._updateBinding('voicing', this.getAttribute('voicing') || 'Voicing');
        this._updateBinding('inversion', this.getAttribute('inversion') || 'Inversion');
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _setupEventHandlers() {
        const card = this.shadowRoot.querySelector('.SavedChordCard');
        if (!card) return;

        card.addEventListener('click', () => {
            // Dispatch event for external management (main script handles selection + scale apply)
            this.dispatchEvent(new CustomEvent('saved-chord-selected', {
                bubbles: true,
                composed: true,
                detail: { chordData: this._savedChordData || null }
            }));
        });

        // Shift + double-click → request removal of this saved chord
        card.addEventListener('dblclick', (e) => {
            if (!e.shiftKey) return;
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent('saved-chord-remove-request', {
                bubbles: true,
                composed: true
            }));
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        // Guard: only update if template is loaded
        if (!this.shadowRoot.querySelector('.SavedChordCard')) return;

        switch (name) {
            case 'chord-name':
            case 'voicing':
            case 'inversion':
                this._updateBinding(name, newValue);
                break;
        }
    }
}

// Register the custom element
customElements.define('saved-chord-selection', SavedChordSelectionComponent);
