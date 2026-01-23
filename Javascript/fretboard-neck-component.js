// Fretboard Neck Web Component
class FretboardNeckComponent extends HTMLElement {
    // Static properties for template caching (shared across all instances)
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // Define which attributes trigger attributeChangedCallback
    static get observedAttributes() {
        return ['frets'];
    }

    // Getter for frets count
    get frets() {
        return parseInt(this.getAttribute('frets')) || 12;
    }

    // Setter for frets count
    set frets(value) {
        if (value !== null) {
            this.setAttribute('frets', value);
        } else {
            this.removeAttribute('frets');
        }
    }

    // Determine dot type based on fret number
    _getDotType(fretNumber) {
        // Double dot on fret 12 and 24
        if (fretNumber === 12 || fretNumber === 24) {
            return 'double';
        }
        // Single dot on frets 3, 5, 7, 9, 15, 17, 19, 21
        if ([3, 5, 7, 9, 15, 17, 19, 21].includes(fretNumber)) {
            return 'single';
        }
        return 'none';
    }

    // Generate fret elements dynamically
    _generateFrets() {
        const container = this.shadowRoot.querySelector('.Allfretswrapper');
        if (!container) return;

        // Clear existing frets
        container.innerHTML = '';

        const fretCount = this.frets;

        // Generate frets from highest to lowest (left to right on neck)
        for (let i = fretCount; i >= 1; i--) {
            const fretElement = document.createElement('fret-single-dot');
            fretElement.classList.add('FretSingleDot');
            fretElement.setAttribute('dot', this._getDotType(i));
            fretElement.setAttribute('fret-number', i);
            container.appendChild(fretElement);
        }
    }

    async connectedCallback() {
        // Load template if not already loaded (singleton pattern)
        if (!FretboardNeckComponent.templateLoaded) {
            if (!FretboardNeckComponent.templatePromise) {
                FretboardNeckComponent.templatePromise = this._loadTemplate();
            }
            await FretboardNeckComponent.templatePromise;
        }

        // Clone template and apply to shadow DOM
        const templateContent = FretboardNeckComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        // Initialize component
        this._bindAttributes();
        this._generateFrets();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/fretboard-neck-component.html');
            const html = await response.text();
            
            // Create a temporary container to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            FretboardNeckComponent.template = temp.querySelector('#fretboard-neck-template');
            FretboardNeckComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load fretboard-neck template:', error);
        }
    }

    _bindAttributes() {
        // Read attributes and bind to data-bind elements
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _setupEventHandlers() {
        // Add resize functionality
        const handle = this.shadowRoot.querySelector('[data-resize-handle]');
        if (!handle) return;

        const storageKey = 'fretboard-neck-size';

        // Restore saved size on load (stored as pixel width and aspect ratio)
        const savedSize = localStorage.getItem(storageKey);
        if (savedSize) {
            const { widthPx, aspectRatio } = JSON.parse(savedSize);
            this.style.width = widthPx + 'px';
            this.style.maxWidth = '100%';
            this.style.aspectRatio = aspectRatio;
            this.style.height = 'auto';
        }

        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = this.offsetWidth;
            startHeight = this.offsetHeight;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);

            // Store width in pixels, use aspect ratio for height
            const aspectRatio = newWidth / newHeight;

            this.style.width = newWidth + 'px';
            this.style.maxWidth = '100%';
            this.style.aspectRatio = aspectRatio;
            this.style.height = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                // Save width as pixels and aspect ratio
                const widthPx = this.offsetWidth;
                const aspectRatio = this.offsetWidth / this.offsetHeight;
                localStorage.setItem(storageKey, JSON.stringify({
                    widthPx,
                    aspectRatio
                }));
            }
            isResizing = false;
        });

        // Double-click to reset to default size
        handle.addEventListener('dblclick', () => {
            localStorage.removeItem(storageKey);
            this.style.width = '';
            this.style.height = '';
            this.style.aspectRatio = '';
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        // Guard: only update if template is loaded
        if (!this.shadowRoot.querySelector('.FretboardNeckWrapper')) return;

        switch (name) {
            case 'frets':
                this._generateFrets();
                break;
        }
    }
}

// Register the custom element
customElements.define('fretboard-neck', FretboardNeckComponent);
