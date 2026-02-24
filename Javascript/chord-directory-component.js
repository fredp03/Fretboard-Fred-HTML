// Chord Directory Web Component
class ChordDirectoryComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['title'];
    }

    async connectedCallback() {
        if (!ChordDirectoryComponent.templateLoaded) {
            if (!ChordDirectoryComponent.templatePromise) {
                ChordDirectoryComponent.templatePromise = this._loadTemplate();
            }
            await ChordDirectoryComponent.templatePromise;
        }

        const templateContent = ChordDirectoryComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
        this._setupEventHandlers();
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

    _bindAttributes() {
        const title = this.getAttribute('title') || 'Chord Directory';
        this._updateBinding('title', title);
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _setupEventHandlers() {
        // Add event listeners and interactive behavior
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (!this.shadowRoot.querySelector('.ChordDirectoryWrapper')) return;

        switch (name) {
            case 'title':
                this._updateBinding('title', newValue);
                break;
        }
    }
}

customElements.define('chord-directory', ChordDirectoryComponent);
