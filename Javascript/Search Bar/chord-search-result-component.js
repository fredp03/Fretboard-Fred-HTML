// Chord Search Result Web Component
class ChordSearchResultComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['scale-root', 'scale-name', 'parent-root', 'parent-scale', 'parent-mode', 'current-function', 'target-chord'];
    }

    async connectedCallback() {
        if (!ChordSearchResultComponent.templateLoaded) {
            if (!ChordSearchResultComponent.templatePromise) {
                ChordSearchResultComponent.templatePromise = this._loadTemplate();
            }
            await ChordSearchResultComponent.templatePromise;
        }

        const templateContent = ChordSearchResultComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/Search Bar/chord-search-result-component.html');
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html;

            ChordSearchResultComponent.template = temp.querySelector('#chord-search-result-template');
            ChordSearchResultComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load chord-search-result template:', error);
        }
    }

    _bindAttributes() {
        this._updateBinding('scale-root',        this.getAttribute('scale-root')        || 'F#');
        this._updateBinding('scale-name',        this.getAttribute('scale-name')        || 'Phrygian Dominant');
        this._updateBinding('parent-root',       this.getAttribute('parent-root')       || 'C#');
        this._updateBinding('parent-scale',      this.getAttribute('parent-scale')      || 'Harmonic Minor');
        this._updateBinding('parent-mode',       this.getAttribute('parent-mode')       || 'Mode 5');
        this._updateBinding('current-function',  this.getAttribute('current-function')  || 'V/bII');
        this._updateBinding('target-chord',      this.getAttribute('target-chord')      || 'C');
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

        if (!this.shadowRoot.querySelector('.ScaleSearcher')) return;

        switch (name) {
            case 'scale-root':
            case 'scale-name':
            case 'parent-root':
            case 'parent-scale':
            case 'parent-mode':
            case 'current-function':
            case 'target-chord':
                this._updateBinding(name, newValue);
                break;
        }
    }
}

// Register the custom element
customElements.define('chord-search-result', ChordSearchResultComponent);
