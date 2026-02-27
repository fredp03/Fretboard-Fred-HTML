// Notes And Inversions Web Component
class NotesAndInversionsComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['title', 'root', 'quality', 'note-1', 'note-2', 'note-3', 'note-4', 'inversion', 'b9-warning', 'tension'];
    }

    async connectedCallback() {
        if (!NotesAndInversionsComponent.templateLoaded) {
            if (!NotesAndInversionsComponent.templatePromise) {
                NotesAndInversionsComponent.templatePromise = this._loadTemplate();
            }
            await NotesAndInversionsComponent.templatePromise;
        }

        const templateContent = NotesAndInversionsComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/Info Card/notes-and-inversions-component.html');
            const html = await response.text();

            const temp = document.createElement('div');
            temp.innerHTML = html;

            NotesAndInversionsComponent.template = temp.querySelector('#notes-and-inversions-template');
            NotesAndInversionsComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load notes-and-inversions template:', error);
        }
    }

    _bindAttributes() {
        const root = this.getAttribute('root');
        if (root !== null) this._updateChord('root', root);

        const quality = this.getAttribute('quality');
        if (quality !== null) this._updateChord('quality', quality);

        const inversion = this.getAttribute('inversion');
        if (inversion !== null) this._updateInversion('inversion', inversion);

        ['note-1', 'note-2', 'note-3', 'note-4'].forEach(attr => {
            const val = this.getAttribute(attr);
            if (val !== null) this._updateNote(attr, val);
        });

        // b9 interval warning
        if (this.hasAttribute('b9-warning')) {
            this._applyB9Warning(true);
        }

        // Tension substitution badge
        const tension = this.getAttribute('tension');
        if (tension) {
            this._applyTensionBadge(tension);
        }
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _updateChord(chordName, value) {
        const el = this.shadowRoot.querySelector(`[data-chord="${chordName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _updateNote(noteName, value) {
        const el = this.shadowRoot.querySelector(`[data-note="${noteName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _updateInversion(inversionName, value) {
        const el = this.shadowRoot.querySelector(`[data-inversion="${inversionName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _applyB9Warning(active) {
        const wrapper = this.shadowRoot.querySelector('.NotesAndInversionsWrapper');
        if (!wrapper) return;
        if (active) {
            wrapper.classList.add('b9-warning');
        } else {
            wrapper.classList.remove('b9-warning');
        }
    }

    _applyTensionBadge(label) {
        const badge = this.shadowRoot.querySelector('.TensionBadge');
        if (badge) {
            badge.textContent = label || '';
            badge.style.display = label ? 'inline-flex' : 'none';
        }
    }

    _setupEventHandlers() {
        // Peek icon click → dispatch peek-click event on host element
        const peekIcon = this.shadowRoot.querySelector('[data-action="peek"]');
        if (peekIcon) {
            peekIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('peek-click', { bubbles: true, composed: true }));
            });
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (!this.shadowRoot.querySelector('.NotesAndInversionsWrapper')) return;

        switch (name) {
            case 'title':
                this._updateBinding('title', newValue);
                break;
            case 'root':
            case 'quality':
                this._updateChord(name, newValue);
                break;
            case 'note-1':
            case 'note-2':
            case 'note-3':
            case 'note-4':
                this._updateNote(name, newValue);
                break;
            case 'inversion':
                this._updateInversion('inversion', newValue);
                break;
            case 'b9-warning':
                this._applyB9Warning(newValue !== null);
                break;
            case 'tension':
                this._applyTensionBadge(newValue);
                break;
        }
    }
}

customElements.define('notes-and-inversions', NotesAndInversionsComponent);
