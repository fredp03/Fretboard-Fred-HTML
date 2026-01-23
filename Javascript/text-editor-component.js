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
        const boldButton = this.shadowRoot.querySelector('#bold-btn');
        
        // Store reference to textBody for use in button handlers
        this._textBody = textBody;
        this._savedSelection = null;
        
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
            
            // Save selection whenever mouse is released in textbody
            textBody.addEventListener('mouseup', () => {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                    this._savedSelection = selection.getRangeAt(0).cloneRange();
                }
            });
            
            // Also save on keyup (for shift+arrow selections)
            textBody.addEventListener('keyup', () => {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                    this._savedSelection = selection.getRangeAt(0).cloneRange();
                }
            });
            
            // Handle Shift + Enter key for line breaks
            textBody.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    document.execCommand('insertHTML', false, '<br>');
                }
            });
            
            // Disable editing when clicking outside
            textBody.addEventListener('blur', () => {
                textBody.setAttribute('contenteditable', 'false');
            });
        }

        // Bold button functionality
        if (boldButton) {
            boldButton.style.cursor = 'pointer';
            
            boldButton.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent button from stealing focus
                e.stopPropagation();

                const selection = window.getSelection();
                let range = null;

                if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                    const candidateRange = selection.getRangeAt(0);
                    if (this._textBody && this._textBody.contains(candidateRange.commonAncestorContainer)) {
                        range = candidateRange.cloneRange();
                    }
                } else if (this._savedSelection && this._textBody.contains(this._savedSelection.commonAncestorContainer)) {
                    range = this._savedSelection.cloneRange();
                }

                if (!range || range.collapsed) {
                    return;
                }

                const selectedContents = range.extractContents();
                const span = document.createElement('span');
                span.style.fontWeight = '700';
                span.appendChild(selectedContents);
                range.insertNode(span);

                if (selection) {
                    selection.removeAllRanges();
                    const spanRange = document.createRange();
                    spanRange.selectNodeContents(span);
                    selection.addRange(spanRange);
                }

                this._savedSelection = null;
            });
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        if (!this.shadowRoot.querySelector('.TextEditorWrapper')) return;

        // Add attribute change handling here
    }
}

// Register the custom element
customElements.define('text-editor', TextEditorComponent);
