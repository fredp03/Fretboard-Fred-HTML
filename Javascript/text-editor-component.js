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
        this._selectionChangeHandler = null;
        
        // Save selection when text is selected
        if (textBody) {
            textBody.addEventListener('mouseup', () => {
                this._saveSelection();
            });
            
            textBody.addEventListener('keyup', () => {
                this._saveSelection();
            });

            textBody.addEventListener('touchend', () => {
                this._saveSelection();
            });

            this._selectionChangeHandler = () => this._saveSelection();
            document.addEventListener('selectionchange', this._selectionChangeHandler);
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
    
    _getSelection() {
        if (this.shadowRoot && typeof this.shadowRoot.getSelection === 'function') {
            const shadowSelection = this.shadowRoot.getSelection();
            if (shadowSelection) {
                return shadowSelection;
            }
        }
        return window.getSelection();
    }

    _saveSelection() {
        const selection = this._getSelection();
        const textBody = this.shadowRoot.querySelector('.textbody');

        if (!selection || selection.rangeCount === 0 || !textBody) {
            return;
        }

        const activeRange = selection.getRangeAt(0);
        if (activeRange.collapsed || !this._isRangeInsideTextBody(activeRange, textBody)) {
            return;
        }

        this._savedSelection = activeRange.cloneRange();
    }

    _applyFormatting(command) {
        const textBody = this.shadowRoot.querySelector('.textbody');
        if (!textBody) return;

        const tagName = command === 'bold' ? 'b' : command === 'underline' ? 'u' : null;
        if (!tagName) {
            return;
        }

        const currentSelection = this._getSelection();
        let range = null;
        if (currentSelection && currentSelection.rangeCount > 0) {
            const currentRange = currentSelection.getRangeAt(0);
            if (!currentRange.collapsed && this._isRangeInsideTextBody(currentRange, textBody)) {
                range = currentRange.cloneRange();
            }
        }

        // Fallback to last valid in-editor selection for toolbar clicks.
        if (!range && this._savedSelection && !this._savedSelection.collapsed && this._isRangeInsideTextBody(this._savedSelection, textBody)) {
            range = this._savedSelection.cloneRange();
        }

        if (!range || !range.toString()) {
            return;
        }

        // Ensure editable/focused, then re-apply the exact selection range.
        textBody.setAttribute('contenteditable', 'true');
        textBody.focus();

        const selection = this._getSelection();
        if (!selection) {
            return;
        }
        selection.removeAllRanges();
        selection.addRange(range);

        // Wrap only the selected fragment with the requested inline tag.
        const wrapper = document.createElement(tagName);
        try {
            range.surroundContents(wrapper);
        } catch (error) {
            const fragment = range.extractContents();
            wrapper.appendChild(fragment);
            range.insertNode(wrapper);
        }

        const formattedRange = document.createRange();
        formattedRange.selectNodeContents(wrapper);
        selection.removeAllRanges();
        selection.addRange(formattedRange);
        this._savedSelection = formattedRange.cloneRange();
    }

    _isRangeInsideTextBody(range, textBody) {
        if (!range || !textBody) return false;
        return textBody.contains(range.startContainer) && textBody.contains(range.endContainer);
    }

    disconnectedCallback() {
        if (this._selectionChangeHandler) {
            document.removeEventListener('selectionchange', this._selectionChangeHandler);
            this._selectionChangeHandler = null;
        }
    }

    _setupResizeHandle() {
        const resizeHandle = this.shadowRoot.querySelector('.resize-handle');
        const hostElement = this;
        
        if (!resizeHandle) return;
        
        let isResizing = false;
        let activePointerId = null;
        let startY = 0;
        let startHeight = 0;

        const applyHeightFromCursor = (clientY) => {
            const deltaY = startY - clientY;
            const newHeight = Math.max(150, startHeight + deltaY);
            hostElement.style.height = newHeight + 'px';
        };
        
        const onPointerDown = (e) => {
            if (isResizing) return;

            isResizing = true;
            activePointerId = e.pointerId;
            startY = e.clientY;
            startHeight = hostElement.offsetHeight;
            
            hostElement.classList.add('resizing');
            resizeHandle.classList.add('dragging');
            resizeHandle.setPointerCapture(activePointerId);
            
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        };
        
        const onPointerMove = (e) => {
            if (!isResizing || e.pointerId !== activePointerId) return;
            applyHeightFromCursor(e.clientY);
        };
        
        const onPointerUp = (e) => {
            if (!isResizing || e.pointerId !== activePointerId) return;
            
            applyHeightFromCursor(e.clientY);
            const pointerId = activePointerId;
            if (resizeHandle.hasPointerCapture(pointerId)) {
                resizeHandle.releasePointerCapture(pointerId);
            }

            isResizing = false;
            activePointerId = null;
            
            hostElement.classList.remove('resizing');
            resizeHandle.classList.remove('dragging');
            
            document.body.style.cursor = '';
        };
        
        resizeHandle.addEventListener('pointerdown', onPointerDown);
        resizeHandle.addEventListener('pointermove', onPointerMove);
        resizeHandle.addEventListener('pointerup', onPointerUp);
        resizeHandle.addEventListener('pointercancel', onPointerUp);
        resizeHandle.addEventListener('pointerrawupdate', onPointerMove);
        
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
