// Scale Selector Web Component
class ScaleSelectorComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;
    static keyViewerCatalog = null;

    static CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    static ENHARMONIC_TO_SHARP = {
        Db: 'C#',
        Eb: 'D#',
        Fb: 'E',
        Gb: 'F#',
        Ab: 'G#',
        Bb: 'A#',
        Cb: 'B',
        'E#': 'F',
        'B#': 'C'
    };

    static FAMILY_DEFS = [
        {
            id: 'Major',
            parentScale: 'Major',
            baseFormula: [0, 2, 4, 5, 7, 9, 11],
            modes: [
                { name: 'Major' },
                { name: 'Dorian' },
                { name: 'Phrygian' },
                { name: 'Lydian' },
                { name: 'Mixolydian' },
                { name: 'Natural Minor' },
                { name: 'Locrian' }
            ]
        },
        {
            id: 'Natural Minor',
            parentScale: 'Natural Minor',
            baseFormula: [0, 2, 3, 5, 7, 8, 10],
            modes: [
                { name: 'Natural Minor' },
                { name: 'Locrian' },
                { name: 'Major' },
                { name: 'Dorian' },
                { name: 'Phrygian' },
                { name: 'Lydian' },
                { name: 'Mixolydian' }
            ]
        },
        {
            id: 'Harmonic Minor',
            parentScale: 'Harmonic Minor',
            baseFormula: [0, 2, 3, 5, 7, 8, 11],
            modes: [
                { name: 'Harmonic Minor' },
                { name: 'Locrian #6' },
                { name: 'Ionian Augmented' },
                { name: 'Dorian #4' },
                { name: 'Phrygian Dominant' },
                { name: 'Lydian #2' },
                { name: 'Super Locrian bb7' }
            ]
        },
        {
            id: 'Melodic Minor',
            parentScale: 'Melodic Minor',
            baseFormula: [0, 2, 3, 5, 7, 9, 11],
            modes: [
                { name: 'Melodic Minor' },
                { name: 'Dorian b2' },
                { name: 'Lydian Augmented' },
                { name: 'Lydian Dominant' },
                { name: 'Mixolydian b6' },
                { name: 'Locrian #2' },
                { name: 'Altered', aliases: ['Super Locrian'] }
            ]
        }
    ];

    static TENSION_LABELS = {
        1: 'b9',
        2: '9',
        3: '#9',
        4: '3',
        5: '11',
        6: '#11',
        8: 'b13',
        9: '13'
    };

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._initialized = false;
        this._globalListenersAttached = false;
        this._keyViewerOpen = false;
        this._keyViewerRoot = 'C';
        this._lastFocusedElement = null;
        this._keyViewerFilters = ScaleSelectorComponent.FAMILY_DEFS.reduce((acc, family) => {
            acc[family.id] = true;
            return acc;
        }, {});
        this._scaleSearchQuery = '';
        this._scaleSearchMatches = [];
        this._scaleSearchActiveIndex = -1;
    }

    static get observedAttributes() {
        return ['root', 'name'];
    }

    static _normalizeNoteName(note) {
        if (!note) return 'C';
        return ScaleSelectorComponent.ENHARMONIC_TO_SHARP[note] || note;
    }

    static _rotateFormula(baseFormula, modeOffset) {
        const pivot = baseFormula[modeOffset];
        const rotated = [];

        for (let i = 0; i < baseFormula.length; i += 1) {
            const source = baseFormula[(i + modeOffset) % baseFormula.length];
            rotated.push((source - pivot + 12) % 12);
        }

        return rotated.sort((a, b) => a - b);
    }

    static _formatTensions(formula) {
        if (!Array.isArray(formula) || formula.length < 7) return '';

        // Diatonic tensions over the root 7th chord are scale degrees 2, 4, and 6.
        const tensionIntervals = [formula[1], formula[3], formula[5]];

        return tensionIntervals
            .map((interval) => ScaleSelectorComponent.TENSION_LABELS[interval] || String(interval))
            .join(' ');
    }

    static _buildKeyViewerCatalog() {
        if (ScaleSelectorComponent.keyViewerCatalog) {
            return ScaleSelectorComponent.keyViewerCatalog;
        }

        const catalog = [];

        ScaleSelectorComponent.FAMILY_DEFS.forEach((family) => {
            family.modes.forEach((modeDef, modeIdx) => {
                const formula = ScaleSelectorComponent._rotateFormula(family.baseFormula, modeIdx);
                const tensions = ScaleSelectorComponent._formatTensions(formula);
                const names = [modeDef.name, ...(modeDef.aliases || [])];

                names.forEach((name, aliasIdx) => {
                    catalog.push({
                        familyId: family.id,
                        parentScale: family.parentScale,
                        modeIndex: modeIdx + 1,
                        parentOffset: family.baseFormula[modeIdx],
                        name,
                        formula,
                        tensions,
                        isAlias: aliasIdx > 0,
                        aliasOf: aliasIdx > 0 ? modeDef.name : null
                    });
                });
            });
        });

        ScaleSelectorComponent.keyViewerCatalog = catalog;
        return catalog;
    }

    static _isEditableEventTarget(event) {
        const path = event.composedPath ? event.composedPath() : [event.target];
        return path.some((el) => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.isContentEditable) return true;
            const tagName = el.tagName;
            return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
        });
    }

    async connectedCallback() {
        if (!ScaleSelectorComponent.templateLoaded) {
            if (!ScaleSelectorComponent.templatePromise) {
                ScaleSelectorComponent.templatePromise = this._loadTemplate();
            }
            await ScaleSelectorComponent.templatePromise;
        }

        if (!this.shadowRoot.querySelector('.ScaleSelectorWrapper')) {
            const templateContent = ScaleSelectorComponent.template.content.cloneNode(true);
            this.shadowRoot.appendChild(templateContent);
        }

        if (!this._initialized) {
            this._cacheElements();
            this._restorePersistedState();
            this._populateKeyRootOptions();
            this._bindAttributes();
            this._setupEventHandlers();
            this._syncKeyViewerUi();
            this._initialized = true;
        }

        this._attachGlobalListeners();
    }

    disconnectedCallback() {
        this._detachGlobalListeners();
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

    _cacheElements() {
        this._scaleRootButton = this.shadowRoot.querySelector('.ScaleRoot');
        this._scaleNameButton = this.shadowRoot.querySelector('.ScaleName');
        this._overlayEl = this.shadowRoot.querySelector('[data-key-viewer-overlay]');
        this._panelEl = this.shadowRoot.querySelector('[data-key-viewer-panel]');
        this._closeButtonEl = this.shadowRoot.querySelector('[data-action="close-key-viewer"]');
        this._keyRootSelectEl = this.shadowRoot.querySelector('[data-key-root-select]');
        this._resultsEl = this.shadowRoot.querySelector('[data-key-viewer-results]');
        this._emptyStateEl = this.shadowRoot.querySelector('[data-key-viewer-empty]');
        this._filterButtons = [...this.shadowRoot.querySelectorAll('[data-family-filter]')];
        this._scaleSearchInputEl = this.shadowRoot.querySelector('[data-scale-search-input]');
        this._scaleSearchSuggestionsEl = this.shadowRoot.querySelector('[data-scale-search-suggestions]');
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
        if (this._scaleRootButton) {
            this._scaleRootButton.addEventListener('click', () => this._startEditing('root'));
        }
        if (this._scaleNameButton) {
            this._scaleNameButton.addEventListener('click', () => this._startEditing('name'));
        }

        if (this._closeButtonEl) {
            this._closeButtonEl.addEventListener('click', () => this._closeKeyViewer());
        }

        if (this._overlayEl) {
            this._overlayEl.addEventListener('click', (e) => {
                if (e.target === this._overlayEl) {
                    this._closeKeyViewer();
                }
            });
        }

        if (this._panelEl) {
            this._panelEl.addEventListener('click', (e) => e.stopPropagation());
        }

        if (this._keyRootSelectEl) {
            this._keyRootSelectEl.addEventListener('change', (e) => {
                this._keyViewerRoot = this._normalizeToViewerRoot(e.target.value);
                this._renderKeyViewerResults();
            });
        }

        this._filterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const familyId = button.getAttribute('data-family-filter');
                if (!familyId) return;
                this._keyViewerFilters[familyId] = !this._keyViewerFilters[familyId];
                this._syncFilterButtons();
                this._renderKeyViewerResults();
                this._renderScaleSearchSuggestions();
            });
        });

        if (this._scaleSearchInputEl) {
            this._scaleSearchInputEl.addEventListener('input', (e) => {
                this._scaleSearchQuery = e.target.value || '';
                this._scaleSearchActiveIndex = -1;
                this._renderScaleSearchSuggestions();
            });

            this._scaleSearchInputEl.addEventListener('focus', () => {
                this._renderScaleSearchSuggestions();
            });

            this._scaleSearchInputEl.addEventListener('keydown', (e) => {
                this._handleScaleSearchKeydown(e);
            });

            this._scaleSearchInputEl.addEventListener('blur', () => {
                requestAnimationFrame(() => {
                    const activeEl = this.shadowRoot.activeElement;
                    if (!activeEl || !this._scaleSearchSuggestionsEl?.contains(activeEl)) {
                        this._hideScaleSearchSuggestions();
                    }
                });
            });
        }

        if (this._scaleSearchSuggestionsEl) {
            this._scaleSearchSuggestionsEl.addEventListener('mousedown', (e) => {
                const option = e.target.closest('.ScaleSearchSuggestion');
                if (option) {
                    e.preventDefault();
                }
            });

            this._scaleSearchSuggestionsEl.addEventListener('click', (e) => {
                const option = e.target.closest('.ScaleSearchSuggestion');
                if (!option) return;

                const root = option.getAttribute('data-scale-root');
                const name = option.getAttribute('data-scale-name');
                if (!root || !name) return;

                this._applyScaleSearchSelection(root, name);
            });
        }

        if (this._resultsEl) {
            this._resultsEl.addEventListener('click', (e) => {
                const row = e.target.closest('.KeyViewerResult');
                if (!row) return;

                const root = row.getAttribute('data-scale-root');
                const name = row.getAttribute('data-scale-name');
                if (!root || !name) return;

                this._applyScaleSelection(root, name);
                this._closeKeyViewer();
            });
        }
    }

    _attachGlobalListeners() {
        if (this._globalListenersAttached) return;

        this._globalKeydownHandler = (e) => {
            const isEscape = e.key === 'Escape';
            const isKeyViewerShortcut = e.code === 'KeyK' || e.key === 'k' || e.key === 'K';

            if (this._keyViewerOpen && isEscape) {
                e.preventDefault();
                this._closeKeyViewer();
                return;
            }

            if (!isKeyViewerShortcut) return;
            if (e.repeat) return;
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (ScaleSelectorComponent._isEditableEventTarget(e)) return;

            e.preventDefault();
            this._toggleKeyViewer();
        };

        window.addEventListener('keydown', this._globalKeydownHandler, { capture: true });
        this._globalListenersAttached = true;
    }

    _detachGlobalListeners() {
        if (!this._globalListenersAttached || !this._globalKeydownHandler) return;
        window.removeEventListener('keydown', this._globalKeydownHandler, true);
        this._globalListenersAttached = false;
    }

    _toggleKeyViewer() {
        if (this._keyViewerOpen) {
            this._closeKeyViewer();
            return;
        }
        this._openKeyViewer();
    }

    _openKeyViewer() {
        if (!this._overlayEl || this._keyViewerOpen) return;

        this._lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this._keyViewerOpen = true;
        this._keyViewerRoot = null;
        this._resetScaleSearch();

        this._syncKeyViewerUi();
        this._overlayEl.hidden = false;
        this._overlayEl.setAttribute('aria-hidden', 'false');
        this.setAttribute('key-viewer-open', '');

        requestAnimationFrame(() => {
            if (this._keyRootSelectEl) {
                this._keyRootSelectEl.focus();
            }
        });
    }

    _closeKeyViewer() {
        if (!this._overlayEl || !this._keyViewerOpen) return;

        this._keyViewerOpen = false;
        this._overlayEl.hidden = true;
        this._overlayEl.setAttribute('aria-hidden', 'true');
        this.removeAttribute('key-viewer-open');
        this._resetScaleSearch();

        if (this._lastFocusedElement && this._lastFocusedElement.isConnected) {
            this._lastFocusedElement.focus({ preventScroll: true });
        }
        this._lastFocusedElement = null;
    }

    _populateKeyRootOptions() {
        if (!this._keyRootSelectEl || this._keyRootSelectEl.options.length > 0) return;

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Root…';
        placeholder.disabled = true;
        this._keyRootSelectEl.appendChild(placeholder);

        ScaleSelectorComponent.CHROMATIC.forEach((note) => {
            const option = document.createElement('option');
            option.value = note;
            option.textContent = note;
            this._keyRootSelectEl.appendChild(option);
        });
    }

    _normalizeToViewerRoot(note) {
        const normalized = ScaleSelectorComponent._normalizeNoteName(note);
        return ScaleSelectorComponent.CHROMATIC.includes(normalized) ? normalized : 'C';
    }

    _syncKeyViewerUi() {
        if (this._keyViewerRoot) {
            this._keyViewerRoot = this._normalizeToViewerRoot(this._keyViewerRoot);
        }

        if (this._keyRootSelectEl) {
            this._keyRootSelectEl.value = this._keyViewerRoot || '';
        }

        this._syncFilterButtons();
        this._renderKeyViewerResults();
        this._renderScaleSearchSuggestions();
    }

    _syncFilterButtons() {
        this._filterButtons.forEach((button) => {
            const familyId = button.getAttribute('data-family-filter');
            const active = !!this._keyViewerFilters[familyId];
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    _normalizeSearchText(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    _hideScaleSearchSuggestions() {
        if (!this._scaleSearchSuggestionsEl) return;
        this._scaleSearchSuggestionsEl.hidden = true;
        if (this._scaleSearchInputEl) {
            this._scaleSearchInputEl.setAttribute('aria-expanded', 'false');
        }
    }

    _showScaleSearchSuggestions() {
        if (!this._scaleSearchSuggestionsEl) return;
        this._scaleSearchSuggestionsEl.hidden = false;
        if (this._scaleSearchInputEl) {
            this._scaleSearchInputEl.setAttribute('aria-expanded', 'true');
        }
    }

    _resetScaleSearch() {
        this._scaleSearchQuery = '';
        this._scaleSearchMatches = [];
        this._scaleSearchActiveIndex = -1;

        if (this._scaleSearchInputEl) {
            this._scaleSearchInputEl.value = '';
            this._scaleSearchInputEl.setAttribute('aria-expanded', 'false');
        }

        if (this._scaleSearchSuggestionsEl) {
            this._scaleSearchSuggestionsEl.innerHTML = '';
            this._scaleSearchSuggestionsEl.hidden = true;
        }
    }

    _getActiveKeyViewerFamilyIds() {
        return new Set(
            ScaleSelectorComponent.FAMILY_DEFS
                .map((family) => family.id)
                .filter((familyId) => this._keyViewerFilters[familyId])
        );
    }

    _buildScaleSearchMatches(query) {
        const normalizedQuery = this._normalizeSearchText(query);
        if (!normalizedQuery) return [];

        const activeFamilies = this._getActiveKeyViewerFamilyIds();
        const catalog = ScaleSelectorComponent._buildKeyViewerCatalog();
        const matches = [];

        ScaleSelectorComponent.CHROMATIC.forEach((root) => {
            catalog.forEach((entry) => {
                if (!activeFamilies.has(entry.familyId)) return;

                const label = `${root} ${entry.name}`;
                const normalizedLabel = this._normalizeSearchText(label);
                const normalizedName = this._normalizeSearchText(entry.name);

                let matchRank = -1;
                if (normalizedLabel === normalizedQuery) {
                    matchRank = 0;
                } else if (normalizedLabel.startsWith(normalizedQuery)) {
                    matchRank = 1;
                } else if (normalizedName.startsWith(normalizedQuery)) {
                    matchRank = 2;
                } else if (normalizedLabel.includes(normalizedQuery)) {
                    matchRank = 3;
                }

                if (matchRank < 0) return;

                matches.push({
                    matchRank,
                    root,
                    name: entry.name,
                    label,
                    parentScale: entry.parentScale,
                    parentRoot: this._computeParentRoot(root, entry.parentOffset),
                    modeIndex: entry.modeIndex,
                    isAlias: entry.isAlias,
                    aliasOf: entry.aliasOf
                });
            });
        });

        matches.sort((a, b) => {
            if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
            if (a.label.length !== b.label.length) return a.label.length - b.label.length;
            return a.label.localeCompare(b.label);
        });

        return matches.slice(0, 16);
    }

    _renderScaleSearchSuggestions() {
        if (!this._scaleSearchSuggestionsEl || !this._scaleSearchInputEl) return;

        const query = this._scaleSearchInputEl.value || this._scaleSearchQuery || '';
        this._scaleSearchQuery = query;

        if (!this._keyViewerOpen || !this._normalizeSearchText(query)) {
            this._scaleSearchMatches = [];
            this._scaleSearchActiveIndex = -1;
            this._hideScaleSearchSuggestions();
            return;
        }

        this._scaleSearchMatches = this._buildScaleSearchMatches(query);
        if (!this._scaleSearchMatches.length) {
            this._scaleSearchActiveIndex = -1;
        } else if (this._scaleSearchActiveIndex >= this._scaleSearchMatches.length) {
            this._scaleSearchActiveIndex = this._scaleSearchMatches.length - 1;
        }

        this._scaleSearchSuggestionsEl.innerHTML = '';

        if (!this._scaleSearchMatches.length) {
            const empty = document.createElement('div');
            empty.className = 'ScaleSearchEmpty';
            empty.textContent = 'No matching scales';
            this._scaleSearchSuggestionsEl.appendChild(empty);
            this._showScaleSearchSuggestions();
            return;
        }

        const fragment = document.createDocumentFragment();

        this._scaleSearchMatches.forEach((match, idx) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'ScaleSearchSuggestion';
            if (idx === this._scaleSearchActiveIndex) {
                option.classList.add('is-active');
            }

            option.setAttribute('data-scale-root', match.root);
            option.setAttribute('data-scale-name', match.name);
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', idx === this._scaleSearchActiveIndex ? 'true' : 'false');

            const labelEl = document.createElement('div');
            labelEl.className = 'ScaleSearchSuggestionLabel';
            labelEl.textContent = match.label;

            const modeLabel = match.modeIndex > 1 ? `Mode ${match.modeIndex}` : 'Root';
            let metaText = `${match.parentRoot} ${match.parentScale} · ${modeLabel}`;
            if (match.isAlias && match.aliasOf) {
                metaText += ` · Alias of ${match.aliasOf}`;
            }

            const metaEl = document.createElement('div');
            metaEl.className = 'ScaleSearchSuggestionMeta';
            metaEl.textContent = metaText;

            option.appendChild(labelEl);
            option.appendChild(metaEl);
            fragment.appendChild(option);
        });

        this._scaleSearchSuggestionsEl.appendChild(fragment);
        this._showScaleSearchSuggestions();
    }

    _handleScaleSearchKeydown(e) {
        const hasMatches = this._scaleSearchMatches.length > 0;

        if (e.key === 'ArrowDown') {
            if (!hasMatches) {
                this._renderScaleSearchSuggestions();
                return;
            }

            e.preventDefault();
            this._scaleSearchActiveIndex = (this._scaleSearchActiveIndex + 1 + this._scaleSearchMatches.length) % this._scaleSearchMatches.length;
            this._renderScaleSearchSuggestions();
            this._scrollActiveScaleSearchSuggestionIntoView();
            return;
        }

        if (e.key === 'ArrowUp') {
            if (!hasMatches) {
                this._renderScaleSearchSuggestions();
                return;
            }

            e.preventDefault();
            this._scaleSearchActiveIndex = this._scaleSearchActiveIndex <= 0
                ? this._scaleSearchMatches.length - 1
                : this._scaleSearchActiveIndex - 1;
            this._renderScaleSearchSuggestions();
            this._scrollActiveScaleSearchSuggestionIntoView();
            return;
        }

        if (e.key === 'Enter') {
            if (!hasMatches) return;
            e.preventDefault();

            const targetIndex = this._scaleSearchActiveIndex >= 0 ? this._scaleSearchActiveIndex : 0;
            const match = this._scaleSearchMatches[targetIndex];
            if (match) {
                this._applyScaleSearchSelection(match.root, match.name);
            }
            return;
        }

        if (e.key === 'Escape') {
            if (this._scaleSearchInputEl?.value) {
                e.preventDefault();
                this._resetScaleSearch();
            } else {
                this._hideScaleSearchSuggestions();
            }
        }
    }

    _scrollActiveScaleSearchSuggestionIntoView() {
        if (!this._scaleSearchSuggestionsEl || this._scaleSearchActiveIndex < 0) return;
        const options = this._scaleSearchSuggestionsEl.querySelectorAll('.ScaleSearchSuggestion');
        const activeOption = options[this._scaleSearchActiveIndex];
        if (activeOption) {
            activeOption.scrollIntoView({ block: 'nearest' });
        }
    }

    _applyScaleSearchSelection(root, name) {
        this._keyViewerRoot = this._normalizeToViewerRoot(root);
        this._applyScaleSelection(root, name);
        this._closeKeyViewer();
    }

    _computeParentRoot(resultRoot, parentOffset) {
        const normalizedRoot = this._normalizeToViewerRoot(resultRoot);
        const rootIndex = ScaleSelectorComponent.CHROMATIC.indexOf(normalizedRoot);
        if (rootIndex < 0) return normalizedRoot;
        const parentIndex = (rootIndex - parentOffset + 12) % 12;
        return ScaleSelectorComponent.CHROMATIC[parentIndex];
    }

    _renderKeyViewerResults() {
        if (!this._resultsEl) return;

        if (!this._keyViewerRoot) {
            this._resultsEl.innerHTML = '';
            if (this._emptyStateEl) this._emptyStateEl.hidden = false;
            return;
        }

        const activeFamilies = new Set(
            ScaleSelectorComponent.FAMILY_DEFS
                .map((family) => family.id)
                .filter((familyId) => this._keyViewerFilters[familyId])
        );

        const currentRoot = this._normalizeToViewerRoot(this.getAttribute('root') || 'C');
        const currentName = this.getAttribute('name') || 'Major';
        const selectedRoot = this._normalizeToViewerRoot(this._keyViewerRoot);
        const catalog = ScaleSelectorComponent._buildKeyViewerCatalog();

        const filtered = catalog.filter((entry) => activeFamilies.has(entry.familyId));

        this._resultsEl.innerHTML = '';

        if (this._emptyStateEl) {
            this._emptyStateEl.hidden = filtered.length > 0;
        }

        if (filtered.length === 0) return;

        const fragment = document.createDocumentFragment();

        filtered.forEach((entry) => {
            const parentRoot = this._computeParentRoot(selectedRoot, entry.parentOffset);
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'KeyViewerResult';
            row.setAttribute('data-scale-root', selectedRoot);
            row.setAttribute('data-scale-name', entry.name);

            if (selectedRoot === currentRoot && entry.name === currentName) {
                row.classList.add('is-current');
            }

            const top = document.createElement('div');
            top.className = 'ResultTopRow';

            const scaleInfo = document.createElement('div');
            scaleInfo.className = 'ResultScaleInfo';

            const rootEl = document.createElement('div');
            rootEl.className = 'ResultScaleRoot';
            rootEl.textContent = selectedRoot;

            const nameEl = document.createElement('div');
            nameEl.className = 'ResultScaleName';
            nameEl.textContent = entry.name;

            scaleInfo.appendChild(rootEl);
            scaleInfo.appendChild(nameEl);

            const tensionsEl = document.createElement('div');
            tensionsEl.className = 'ResultTensions';
            tensionsEl.textContent = entry.tensions ? `Tensions ${entry.tensions}` : 'Tensions -';

            top.appendChild(scaleInfo);
            top.appendChild(tensionsEl);

            const meta = document.createElement('div');
            meta.className = 'ResultMetaRow';

            const parentScaleText = `${parentRoot} ${entry.parentScale}`;
            const modeText = entry.modeIndex > 1 ? `Mode ${entry.modeIndex}` : 'Root';

            meta.textContent = `${parentScaleText} · ${modeText}`;

            if (entry.isAlias && entry.aliasOf) {
                const aliasTag = document.createElement('span');
                aliasTag.className = 'ResultAliasTag';
                aliasTag.textContent = `Alias of ${entry.aliasOf}`;
                meta.appendChild(aliasTag);
            }

            row.appendChild(top);
            row.appendChild(meta);

            fragment.appendChild(row);
        });

        this._resultsEl.appendChild(fragment);
    }

    _applyScaleSelection(root, name) {
        this._setScaleField('root', root);
        this._setScaleField('name', name);
        this._syncKeyViewerUi();
    }

    _setScaleField(field, value) {
        const currentValue = this.getAttribute(field) || '';
        this._savePersistedState(field, value);

        if (currentValue === value) {
            return false;
        }

        this.setAttribute(field, value);
        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true,
            detail: { field, value }
        }));

        return true;
    }

    _startEditing(field) {
        if (this._keyViewerOpen) return;

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

        if (this._initialized) {
            this._syncKeyViewerUi();
        }
    }
}

// Register the custom element
customElements.define('scale-selector', ScaleSelectorComponent);
