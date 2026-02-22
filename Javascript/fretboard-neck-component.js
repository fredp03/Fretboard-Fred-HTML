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
        let activePointerId = null;
        let pointerOffsetX = 0;
        let pointerOffsetY = 0;
        let cachedCenterX = 0;
        let cachedCenterY = 0;
        let rafPending = false;
        let latestClientX = 0;
        let latestClientY = 0;
        const supportsRawUpdate = ('onpointerrawupdate' in window);

        const applyResize = () => {
            rafPending = false;

            const hostRight = latestClientX - pointerOffsetX + 12;
            const hostBottom = latestClientY - pointerOffsetY + 12;
            const newWidth = Math.max(1, (hostRight - cachedCenterX) * 2);
            const newHeight = Math.max(1, (hostBottom - cachedCenterY) * 2);

            const aspectRatio = newWidth / newHeight;
            this.style.cssText = `width:${newWidth}px;max-width:100%;aspect-ratio:${aspectRatio};height:auto;will-change:width;`;
        };

        const scheduleResize = (clientX, clientY) => {
            if (!isResizing) return;
            latestClientX = clientX;
            latestClientY = clientY;
            if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(applyResize);
            }
        };

        const finishResize = () => {
            if (!isResizing) return;

            // Cancel any pending rAF
            rafPending = false;

            // Commit final size without will-change
            const widthPx = this.offsetWidth;
            const aspectRatio = this.offsetWidth / this.offsetHeight;
            this.style.cssText = `width:${widthPx}px;max-width:100%;aspect-ratio:${aspectRatio};height:auto;`;

            localStorage.setItem(storageKey, JSON.stringify({ widthPx, aspectRatio }));

            isResizing = false;
            activePointerId = null;
        };

        handle.addEventListener('pointerdown', (e) => {
            if (isResizing) return;

            isResizing = true;
            activePointerId = e.pointerId;
            const handleRect = handle.getBoundingClientRect();
            pointerOffsetX = e.clientX - handleRect.left;
            pointerOffsetY = e.clientY - handleRect.top;

            // Cache parent centre once — it won't change during the drag
            const parentRect = (this.parentElement || this).getBoundingClientRect();
            cachedCenterX = parentRect.left + parentRect.width / 2;
            cachedCenterY = parentRect.top + parentRect.height / 2;

            handle.setPointerCapture(activePointerId);
            e.preventDefault();
        });

        // Use pointerrawupdate in Chrome (higher frequency, already rAF-throttled).
        // Fall back to pointermove in Safari (which doesn't support pointerrawupdate).
        if (supportsRawUpdate) {
            handle.addEventListener('pointerrawupdate', (e) => {
                if (!isResizing || e.pointerId !== activePointerId) return;
                scheduleResize(e.clientX, e.clientY);
            });
        } else {
            handle.addEventListener('pointermove', (e) => {
                if (!isResizing || e.pointerId !== activePointerId) return;
                scheduleResize(e.clientX, e.clientY);
            });
        }

        const onPointerEnd = (e) => {
            if (!isResizing || e.pointerId !== activePointerId) return;

            latestClientX = e.clientX;
            latestClientY = e.clientY;

            const pointerId = activePointerId;
            if (handle.hasPointerCapture(pointerId)) {
                handle.releasePointerCapture(pointerId);
            }

            finishResize();
        };

        handle.addEventListener('pointerup', onPointerEnd);
        handle.addEventListener('pointercancel', onPointerEnd);
        handle.style.touchAction = 'none';

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
