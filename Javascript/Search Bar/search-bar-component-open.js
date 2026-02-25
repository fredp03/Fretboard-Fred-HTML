// Search Bar Web Component
class SearchBarComponent extends HTMLElement {
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
        if (!SearchBarComponent.templateLoaded) {
            if (!SearchBarComponent.templatePromise) {
                SearchBarComponent.templatePromise = this._loadTemplate();
            }
            await SearchBarComponent.templatePromise;
        }

        const templateContent = SearchBarComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/Search Bar/search-bar-component-open.html');
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html;

            SearchBarComponent.template = temp.querySelector('#search-bar-template');
            SearchBarComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load search-bar template:', error);
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

        if (!this.shadowRoot.querySelector('.SearchBarWrapper')) return;

        switch (name) {

        }
    }
}

// Register the custom element
customElements.define('search-bar-open', SearchBarComponent);
