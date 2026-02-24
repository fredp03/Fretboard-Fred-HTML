// Tab Menu Item Web Component
class TabMenuItemComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['label'];
    }

    async connectedCallback() {
        if (!TabMenuItemComponent.templateLoaded) {
            if (!TabMenuItemComponent.templatePromise) {
                TabMenuItemComponent.templatePromise = this._loadTemplate();
            }
            await TabMenuItemComponent.templatePromise;
        }

        const templateContent = TabMenuItemComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/Info Card/tab-menu-item-component.html');
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html;

            TabMenuItemComponent.template = temp.querySelector('#tab-menu-item-template');
            TabMenuItemComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load tab-menu-item template:', error);
        }
    }

    _bindAttributes() {
        const label = this.getAttribute('label') || 'Tab Menu Item';
        this._updateBinding('label', label);
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

        if (!this.shadowRoot.querySelector('.TabMenuItemWrapper')) return;

        switch (name) {
            case 'label':
                this._updateBinding('label', newValue);
                break;
        }
    }
}

customElements.define('tab-menu-item', TabMenuItemComponent);
