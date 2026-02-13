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
        // Add attribute binding logic here
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _setupEventHandlers() {
        const textBody = this.shadowRoot.querySelector('.textbody');
        const boldBtn = this.shadowRoot.querySelector('.bold-btn');
        const underlineBtn = this.shadowRoot.querySelector('.underline-btn');
        
        // Setup resize handle
        this._setupResizeHandle();
        
        // Store saved selection for formatting
        this._savedSelection = null;
        
        // Save selection when text is selected
        if (textBody) {
            textBody.addEventListener('mouseup', () => {
                this._saveSelection();
            });
            
            textBody.addEventListener('keyup', () => {
                this._saveSelection();
            });
        }
        
        // Bold button - use mousedown to prevent losing selection
        if (boldBtn) {
            boldBtn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevents blur/focus change
                this._applyFormatting('bold');
            });
        }
        
        // Underline button - use mousedown to prevent losing selection
        if (underlineBtn) {
            underlineBtn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevents blur/focus change
                this._applyFormatting('underline');
            });
        }
        
        if (textBody) {
            // Enable editing on double click
            textBody.addEventListener('dblclick', (e) => {
                e.preventDefault();
                textBody.setAttribute('contenteditable', 'true');
                
                // Use setTimeout to ensure contenteditable is active before positioning cursor
                setTimeout(() => {
                    textBody.focus();
                    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                    if (range) {
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }, 0);
            });
            
            // Handle Shift + Enter key for line breaks
            textBody.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    document.execCommand('insertHTML', false, '<br>');
                }
            });
            
            // Disable editing when clicking outside (but not on toolbar buttons)
            textBody.addEventListener('blur', (e) => {
                // Delay to check if focus moved to a toolbar button
                setTimeout(() => {
                    const activeElement = this.shadowRoot.activeElement;
                    if (!activeElement || !activeElement.closest('.text-editor-control')) {
                        textBody.setAttribute('contenteditable', 'false');
                    }
                }, 100);
            });
        }
    }
    
    _saveSelection() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            this._savedSelection = selection.getRangeAt(0).cloneRange();
        }
    }

    _applyFormatting(command) {
        const textBody = this.shadowRoot.querySelector('.textbody');
        const selection = window.getSelection();
        
        // Make sure the textbody is editable
        textBody.setAttribute('contenteditable', 'true');
        textBody.focus();
        
        // Use saved selection or current selection
        let range;
        if (this._savedSelection) {
            range = this._savedSelection;
            selection.removeAllRanges();
            selection.addRange(range);
        } else if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        } else {
            return;
        }
        
        // Check if there's actually selected text
        if (range.collapsed) {
            return;
        }
        
        // Get the selected text
        const selectedText = range.toString();
        if (!selectedText) {
            return;
        }
        
        // Create the wrapper element based on command
        let wrapper;
        if (command === 'bold') {
            wrapper = document.createElement('strong');
        } else if (command === 'underline') {
            wrapper = document.createElement('u');
        } else {
            return;
        }
        
        // Extract the selected content and wrap it
        const fragment = range.extractContents();
        wrapper.appendChild(fragment);
        
        // Insert the wrapped content
        range.insertNode(wrapper);
        
        // Clear the saved selection
        this._savedSelection = null;
        
        // Update selection to be after the inserted content
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        selection.addRange(newRange);
    }

    _setupResizeHandle() {
        const resizeHandle = this.shadowRoot.querySelector('.resize-handle');
        const hostElement = this;
        
        if (!resizeHandle) return;
        
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;
        let targetHeight = 0;
        let currentHeight = 0;
        let lastTime = 0;
        const FRAME_TIME = 1000 / 60; // 16.67ms for 60fps
        const LERP_FACTOR = 0.55; // Smoothing factor
        
        const animate = (timestamp) => {
            if (!isResizing) return;
            
            // Ensure minimum frame time for consistent 60fps
            if (timestamp - lastTime >= FRAME_TIME) {
                // Lerp towards target for ultra-smooth motion
                currentHeight += (targetHeight - currentHeight) * LERP_FACTOR;
                
                // Snap if very close to avoid endless tiny updates
                if (Math.abs(targetHeight - currentHeight) < 0.5) {
                    currentHeight = targetHeight;
                }
                
                hostElement.style.height = currentHeight + 'px';
                lastTime = timestamp;
            }
            
            requestAnimationFrame(animate);
        };
        
        const onPointerDown = (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = hostElement.offsetHeight;
            targetHeight = startHeight;
            currentHeight = startHeight;
            lastTime = performance.now();
            
            hostElement.classList.add('resizing');
            resizeHandle.classList.add('dragging');
            resizeHandle.setPointerCapture(e.pointerId);
            
            document.body.style.cursor = 'ns-resize';
            
            requestAnimationFrame(animate);
            e.preventDefault();
        };
        
        const onPointerMove = (e) => {
            if (!isResizing) return;
            
            const deltaY = startY - e.clientY;
            targetHeight = Math.max(150, startHeight + deltaY);
        };
        
        const onPointerUp = (e) => {
            if (!isResizing) return;
            
            isResizing = false;
            
            // Final snap to target
            hostElement.style.height = targetHeight + 'px';
            
            hostElement.classList.remove('resizing');
            resizeHandle.classList.remove('dragging');
            resizeHandle.releasePointerCapture(e.pointerId);
            
            document.body.style.cursor = '';
        };
        
        resizeHandle.addEventListener('pointerdown', onPointerDown);
        resizeHandle.addEventListener('pointermove', onPointerMove);
        resizeHandle.addEventListener('pointerup', onPointerUp);
        resizeHandle.addEventListener('pointercancel', onPointerUp);
        
        // Prevent touch scrolling on the handle
        resizeHandle.style.touchAction = 'none';
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        if (!this.shadowRoot.querySelector('.TextEditorWrapper')) return;

        // Add attribute change handling here
    }
}

// Register the custom element
customElements.define('text-editor', TextEditorComponent);
