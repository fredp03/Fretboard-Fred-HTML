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
        return ['title', 'tabs', 'rows'];
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
        this._renderTabs();
        this._renderRows();
    }

    _renderTabs() {
        const tabBar = this.shadowRoot.querySelector('.TabBar');
        if (!tabBar) return;

        tabBar.innerHTML = '';

        let tabs = [];
        try {
            tabs = JSON.parse(this.getAttribute('tabs') || '[]');
        } catch (e) {
            console.error('chord-directory: invalid tabs JSON', e);
            return;
        }

        tabs.forEach(label => {
            const tab = document.createElement('tab-menu-item');
            tab.setAttribute('label', label);
            tabBar.appendChild(tab);
        });

        // Re-run event handlers so the new tabs get selection logic
        this._setupEventHandlers();
    }

    _renderRows() {
        const container = this.shadowRoot.querySelector('.RowsContainer');
        if (!container) return;

        container.innerHTML = '';

        let rows = [];
        try {
            rows = JSON.parse(this.getAttribute('rows') || '[]');
        } catch (e) {
            console.error('chord-directory: invalid rows JSON', e);
            return;
        }

        rows.forEach((row, index) => {
            const el = document.createElement('notes-and-inversions');
            el.style.width = '100%';
            if (row.root)       el.setAttribute('root',       row.root);
            if (row.quality)    el.setAttribute('quality',    row.quality);
            if (row.inversion)  el.setAttribute('inversion',  row.inversion);
            if (row['note-1'])  el.setAttribute('note-1',     row['note-1']);
            if (row['note-2'])  el.setAttribute('note-2',     row['note-2']);
            if (row['note-3'])  el.setAttribute('note-3',     row['note-3']);
            if (row['note-4'])  el.setAttribute('note-4',     row['note-4']);
            container.appendChild(el);
        });
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _setupEventHandlers() {
        const tabBar = this.shadowRoot.querySelector('.TabBar');
        if (!tabBar) return;

        // Remove any previous listener by replacing the node's click handler
        tabBar._tabClickHandler && tabBar.removeEventListener('click', tabBar._tabClickHandler);

        const tabs = tabBar.querySelectorAll('tab-menu-item');

        // Default: select the first tab
        if (tabs.length > 0) {
            tabs.forEach(t => t.removeAttribute('selected'));
            tabs[0].setAttribute('selected', '');
        }

        // Exclusive selection — deselect all, then select the clicked tab
        tabBar._tabClickHandler = (e) => {
            const clickedTab = e.target.closest('tab-menu-item');
            if (!clickedTab) return;
            tabBar.querySelectorAll('tab-menu-item').forEach(tab => tab.removeAttribute('selected'));
            clickedTab.setAttribute('selected', '');
        };
        tabBar.addEventListener('click', tabBar._tabClickHandler);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (!this.shadowRoot.querySelector('.ChordDirectoryWrapper')) return;

        switch (name) {
            case 'title':
                this._updateBinding('title', newValue);
                break;
            case 'tabs':
                this._renderTabs();
                break;
            case 'rows':
                this._renderRows();
                break;
        }
    }
}

customElements.define('chord-directory', ChordDirectoryComponent);
