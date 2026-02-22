// Text Editor Web Component
class TextEditorComponent extends HTMLElement {
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
        if (!TextEditorComponent.templateLoaded) {
            if (!TextEditorComponent.templatePromise) {
                TextEditorComponent.templatePromise = this._loadTemplate();
            }
            await TextEditorComponent.templatePromise;
        }

        const templateContent = TextEditorComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/text-editor-component.html');
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html;

            TextEditorComponent.template = temp.querySelector('#text-editor-template');
            TextEditorComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load text-editor template:', error);
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

        if (!this.shadowRoot.querySelector('.TextEditorWrapper')) return;

        switch (name) {
        }
    }
}

// Register the custom element
customElements.define('text-editor', TextEditorComponent);
