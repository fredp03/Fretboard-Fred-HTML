// Scale Selector Web Component
class ScaleSelectorComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['root', 'name'];
    }

    async connectedCallback() {
        if (!ScaleSelectorComponent.templateLoaded) {
            if (!ScaleSelectorComponent.templatePromise) {
                ScaleSelectorComponent.templatePromise = this._loadTemplate();
            }
            await ScaleSelectorComponent.templatePromise;
        }

        const templateContent = ScaleSelectorComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._restorePersistedState();
        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/scale-selector-component.html');
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html;

            ScaleSelectorComponent.template = temp.querySelector('#scale-selector-template');
            ScaleSelectorComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load scale-selector template:', error);
        }
    }

    _restorePersistedState() {
        const savedRoot = localStorage.getItem('scale-selector-root');
        const savedName = localStorage.getItem('scale-selector-name');
        
        if (savedRoot) {
            this.setAttribute('root', savedRoot);
        }
        if (savedName) {
            this.setAttribute('name', savedName);
        }
    }

    _savePersistedState(field, value) {
        localStorage.setItem(`scale-selector-${field}`, value);
    }

    _bindAttributes() {
        const root = this.getAttribute('root') || 'A';
        const name = this.getAttribute('name') || 'Harmonic Minor';

        this._updateBinding('root', root);
        this._updateBinding('name', name);
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _setupEventHandlers() {
        const scaleRoot = this.shadowRoot.querySelector('.ScaleRoot');
        const scaleName = this.shadowRoot.querySelector('.ScaleName');

        scaleRoot.addEventListener('click', () => this._startEditing('root'));
        scaleName.addEventListener('click', () => this._startEditing('name'));
    }

    _startEditing(field) {
        const bindEl = this.shadowRoot.querySelector(`[data-bind="${field}"]`);
        if (!bindEl || bindEl.classList.contains('editing')) return;

        const currentValue = bindEl.textContent;
        const parent = bindEl.parentElement;

        // Set editing state with opacity
        bindEl.classList.add('editing');
        this._editingField = field;
        this._originalValue = currentValue;
        this._hasTyped = false;

        // Create hidden input to capture keystrokes
        const input = document.createElement('input');
        input.type = 'text';
        input.value = '';
        input.className = `EditInput ${field}-input`;
        input.style.position = 'absolute';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        input.style.width = '1px';
        input.style.height = '1px';
        input.setAttribute('data-hidden-input', field);
        parent.appendChild(input);
        input.focus();

        // Handle typing
        input.addEventListener('input', () => {
            if (!this._hasTyped) {
                this._hasTyped = true;
                bindEl.textContent = '';
                bindEl.classList.remove('editing');
            }
            bindEl.textContent = input.value;
        });

        // Handle blur - restore if not typed, save if typed
        const finishEditing = () => {
            this._finishEditing(field, this._hasTyped ? (input.value.trim() || this._originalValue) : this._originalValue);
        };

        input.addEventListener('blur', finishEditing);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                this._hasTyped = false;
                input.blur();
            }
        });
    }

    _finishEditing(field, value) {
        const bindEl = this.shadowRoot.querySelector(`[data-bind="${field}"]`);
        const input = this.shadowRoot.querySelector(`[data-hidden-input="${field}"]`);
        
        if (bindEl) {
            bindEl.classList.remove('editing');
            bindEl.textContent = value;
        }
        
        if (input) {
            input.remove();
        }

        // Update attribute and dispatch event only if value changed
        if (value !== this._originalValue) {
            this.setAttribute(field, value);
            this._savePersistedState(field, value);
            this.dispatchEvent(new CustomEvent('change', {
                bubbles: true,
                detail: { field, value }
            }));
        }
        
        this._editingField = null;
        this._originalValue = null;
        this._hasTyped = false;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (!this.shadowRoot.querySelector('.ScaleSelectorWrapper')) return;

        switch (name) {
            case 'root':
                this._updateBinding('root', newValue);
                break;
            case 'name':
                this._updateBinding('name', newValue);
                break;
        }
    }
}

// Register the custom element
customElements.define('scale-selector', ScaleSelectorComponent);
