// Chord Directory V2 Web Component

class ChordDirectoryV2Component extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return [];
    }

    async connectedCallback() {
        if (!ChordDirectoryV2Component.templateLoaded) {
            if (!ChordDirectoryV2Component.templatePromise) {
                ChordDirectoryV2Component.templatePromise = this._loadTemplate();
            }
            await ChordDirectoryV2Component.templatePromise;
        }

        const templateContent = ChordDirectoryV2Component.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/Chord Directory V2/chord-directory-v2-component.html');
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html;

            ChordDirectoryV2Component.template = temp.querySelector('#chord-directory-v2-template');
            ChordDirectoryV2Component.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load chord-directory-v2 template:', error);
        }
    }

    _bindAttributes() {
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _setupEventHandlers() {
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (!this.shadowRoot.querySelector('.ChordDirectoryV2Wrapper')) return;

        switch (name) {
            // attribute cases go here
        }
    }
}

// Register the custom element
customElements.define('chord-directory-v2', ChordDirectoryV2Component);
