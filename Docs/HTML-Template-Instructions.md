# Component Creation Instructions

This document provides instructions for creating new HTML components in this project. Follow these patterns exactly to maintain consistency with the existing codebase.

---

## Project Structure Overview

```
├── main.html                          # Main entry point HTML file
├── component-viewer.html              # Component testing/viewing file
├── Components/                         # HTML template files
│   └── {component-name}-component.html
├── JavascriptLoader/                   # Web Component class definitions
│   └── {component-name}-component.js
└── assets/                             # Static assets (images, fonts, etc.)
```

---

## File Naming Convention

- **HTML Template:** `{component-name}-component.html` (lowercase, hyphen-separated)
- **JavaScript Loader:** `{component-name}-component.js` (lowercase, hyphen-separated)
- **Custom Element Tag:** `<{component-name}>` (lowercase, hyphen-separated)

**Examples:**
- `lightcard-component.html` → `lightcard-component.js` → `<light-card>`
- `upcoming-class-component.html` → `upcoming-class-component.js` → `<upcoming-class>`

---

## HTML Template File Structure (`Components/*.html`)

Each component HTML file contains a single `<template>` element with the following structure:

### Required Structure

```html
<template id="{component-name}-template">
    <style>
        /* ALL CSS GOES HERE - at the top of the template */
        /* Use :host for styling the custom element itself */
        /* Use scoped class names for internal elements */
    </style>

    <!-- Minimal HTML structure with semantic class names -->
    <div class="ComponentNameWrapper">
        <!-- Use data-bind attributes for dynamic content -->
        <div class="ChildElement" data-bind="property-name">Default Value</div>
        
        <!-- Use slots for nested components -->
        <slot name="slot-name"></slot>
    </div>
</template>
```

### CSS Guidelines

1. **Location:** ALL CSS must be inside the `<style>` tag at the TOP of the template
2. **`:host` selector:** Use `:host` to style the custom element container itself
3. **`:host([attribute])` selector:** Use for attribute-based styling variations
4. **Scoped classes:** Use PascalCase class names that are unique to the component
5. **No inline styles:** Keep HTML clean - all styling in the `<style>` block
6. **Transitions:** Define transitions in CSS for smooth state changes

**CSS Example:**
```html
<style>
    :host {
        display: block;
    }

    :host([variant="compact"]) .Wrapper {
        padding: 8px;
    }

    .Wrapper {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: #D9D9D9;
        border-radius: 16px;
        transition: all 0.2s ease;
    }

    .Wrapper.selected {
        background: #716F6F;
    }

    .Title {
        font-family: 'Karla', sans-serif;
        font-weight: 500;
        font-size: 14px;
        color: #2B2B2B;
    }
</style>
```

### HTML Guidelines

1. **Minimal markup:** Keep HTML structure simple and semantic
2. **Wrapper pattern:** Use a main wrapper div with class `{ComponentName}Wrapper`
3. **Data binding:** Use `data-bind="{property-name}"` for dynamic content
4. **Slots:** Use `<slot name="{slot-name}"></slot>` for component composition
5. **No inline styles:** All styling via classes in the `<style>` block
6. **Default values:** Include placeholder text for data-bound elements

**HTML Example:**
```html
<div class="CardWrapper">
    <div class="Title" data-bind="title">Default Title</div>
    <div class="Content">
        <slot name="content"></slot>
    </div>
    <div class="Footer" data-bind="footer-text">Footer</div>
</div>
```

---

## JavaScript Loader File Structure (`JavascriptLoader/*.js`)

Each component requires a JavaScript class that extends `HTMLElement` and handles template loading.

### Required Structure

```javascript
// {Component Name} Web Component
class {ComponentName}Component extends HTMLElement {
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
        return ['attribute-one', 'attribute-two'];
    }

    async connectedCallback() {
        // Load template if not already loaded (singleton pattern)
        if (!{ComponentName}Component.templateLoaded) {
            if (!{ComponentName}Component.templatePromise) {
                {ComponentName}Component.templatePromise = this._loadTemplate();
            }
            await {ComponentName}Component.templatePromise;
        }

        // Clone template and apply to shadow DOM
        const templateContent = {ComponentName}Component.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        // Initialize component
        this._bindAttributes();
        this._setupEventHandlers();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/{component-name}-component.html');
            const html = await response.text();
            
            // Create a temporary container to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            {ComponentName}Component.template = temp.querySelector('#{component-name}-template');
            {ComponentName}Component.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load {component-name} template:', error);
        }
    }

    _bindAttributes() {
        // Read attributes and bind to data-bind elements
        const value = this.getAttribute('attribute-name') || 'Default Value';
        this._updateBinding('property-name', value);
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _setupEventHandlers() {
        // Add event listeners and interactive behavior
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        // Guard: only update if template is loaded
        if (!this.shadowRoot.querySelector('.{ComponentName}Wrapper')) return;

        switch (name) {
            case 'attribute-one':
                this._updateBinding('property-name', newValue);
                break;
        }
    }
}

// Register the custom element
customElements.define('{component-tag-name}', {ComponentName}Component);
```

### JavaScript Guidelines

1. **Template caching:** Use static properties to load template once, share across instances
2. **Shadow DOM:** Always use `attachShadow({ mode: 'open' })`
3. **Async loading:** Use async/await for template fetching
4. **Data binding:** Match `data-bind` attributes in HTML with `_updateBinding()` calls
5. **Observed attributes:** Define attributes that should trigger updates
6. **Guard clauses:** Check if template is loaded before updating in `attributeChangedCallback`
7. **Custom events:** Dispatch events using `CustomEvent` with `bubbles: true`

---

## Using Components in Main HTML

### Loading Components

Include JavaScript loaders in the `<head>` or before the `<body>`:

```html
<script src="JavascriptLoader/{component-name}-component.js"></script>
```

### Using Components

```html
<!-- Simple component with attributes -->
<{component-name} 
    attribute-one="Value 1" 
    attribute-two="Value 2">
</{component-name}>

<!-- Component with slotted content -->
<{wrapper-component}>
    <{child-component} slot="slot-name"></{child-component}>
</{wrapper-component}>
```

---

## Complete Example: Creating a New "Status Card" Component

### Step 1: Create HTML Template

**File:** `Components/status-card-component.html`

```html
<template id="status-card-template">
    <style>
        :host {
            display: inline-block;
        }

        :host([size="small"]) .StatusCardWrapper {
            padding: 8px;
            min-width: 120px;
        }

        .StatusCardWrapper {
            min-width: 180px;
            padding: 16px;
            background: #D9D9D9;
            border: 1px solid rgba(0, 0, 0, 0.28);
            border-radius: 16px;
            box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.08);
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: all 0.2s ease;
        }

        .StatusCardWrapper:hover {
            transform: translateY(-2px);
            box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.12);
        }

        .Header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .Title {
            font-family: 'Karla', sans-serif;
            font-weight: 500;
            font-size: 16px;
            color: #393939;
        }

        .StatusIndicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #4CAF50;
        }

        .StatusIndicator.offline {
            background: #F44336;
        }

        .Description {
            font-family: 'Karla', sans-serif;
            font-weight: 400;
            font-size: 14px;
            color: #666666;
        }
    </style>

    <div class="StatusCardWrapper">
        <div class="Header">
            <div class="Title" data-bind="title">Status</div>
            <div class="StatusIndicator" data-bind="indicator"></div>
        </div>
        <div class="Description" data-bind="description">No description</div>
    </div>
</template>
```

### Step 2: Create JavaScript Loader

**File:** `JavascriptLoader/status-card-component.js`

```javascript
// Status Card Web Component
class StatusCardComponent extends HTMLElement {
    static template = null;
    static templateLoaded = false;
    static templatePromise = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['title', 'description', 'status'];
    }

    async connectedCallback() {
        if (!StatusCardComponent.templateLoaded) {
            if (!StatusCardComponent.templatePromise) {
                StatusCardComponent.templatePromise = this._loadTemplate();
            }
            await StatusCardComponent.templatePromise;
        }

        const templateContent = StatusCardComponent.template.content.cloneNode(true);
        this.shadowRoot.appendChild(templateContent);

        this._bindAttributes();
    }

    async _loadTemplate() {
        try {
            const response = await fetch('Components/status-card-component.html');
            const html = await response.text();
            
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            StatusCardComponent.template = temp.querySelector('#status-card-template');
            StatusCardComponent.templateLoaded = true;
        } catch (error) {
            console.error('Failed to load status-card template:', error);
        }
    }

    _bindAttributes() {
        const title = this.getAttribute('title') || 'Status';
        const description = this.getAttribute('description') || 'No description';
        const status = this.getAttribute('status') || 'online';

        this._updateBinding('title', title);
        this._updateBinding('description', description);
        this._updateStatus(status);
    }

    _updateBinding(bindName, value) {
        const el = this.shadowRoot.querySelector(`[data-bind="${bindName}"]`);
        if (el) {
            el.textContent = value;
        }
    }

    _updateStatus(status) {
        const indicator = this.shadowRoot.querySelector('[data-bind="indicator"]');
        if (indicator) {
            indicator.classList.toggle('offline', status === 'offline');
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        if (!this.shadowRoot.querySelector('.StatusCardWrapper')) return;

        switch (name) {
            case 'title':
                this._updateBinding('title', newValue);
                break;
            case 'description':
                this._updateBinding('description', newValue);
                break;
            case 'status':
                this._updateStatus(newValue);
                break;
        }
    }
}

// Register the custom element
customElements.define('status-card', StatusCardComponent);
```

### Step 3: Use the Component

**In `main.html`:**

```html
<script src="JavascriptLoader/status-card-component.js"></script>

<!-- Usage -->
<status-card 
    title="Server Status" 
    description="All systems operational" 
    status="online">
</status-card>

<status-card 
    title="Database" 
    description="Connection lost" 
    status="offline"
    size="small">
</status-card>
```

---

## Key Patterns Summary

| Pattern | Description |
|---------|-------------|
| **CSS at top** | All styles inside `<style>` at the start of template |
| **`:host` styling** | Use `:host` and `:host([attr])` for element-level styling |
| **Minimal HTML** | Clean, semantic HTML with no inline styles |
| **`data-bind`** | Use for dynamic text content binding |
| **Slots** | Use `<slot name="">` for component composition |
| **Template caching** | Static properties prevent re-fetching templates |
| **Shadow DOM** | Encapsulated styling and DOM structure |
| **Custom events** | Dispatch with `new CustomEvent()` and `bubbles: true` |
| **Attribute observation** | Use `observedAttributes` and `attributeChangedCallback` |

---

## Checklist for New Components

- [ ] Create HTML template in `Components/{name}-component.html`
- [ ] Template ID matches filename: `id="{name}-template"`
- [ ] CSS is inside `<style>` at the top of template
- [ ] Using `:host` for element-level styles
- [ ] No inline styles in HTML
- [ ] `data-bind` attributes for dynamic content
- [ ] Wrapper class follows `{ComponentName}Wrapper` pattern
- [ ] Create JS loader in `JavascriptLoader/{name}-component.js`
- [ ] Class extends `HTMLElement`
- [ ] Static template caching properties
- [ ] `attachShadow({ mode: 'open' })` in constructor
- [ ] Async `_loadTemplate()` method
- [ ] `_bindAttributes()` method
- [ ] `observedAttributes` static getter if needed
- [ ] `attributeChangedCallback` with guard clause
- [ ] `customElements.define()` at end of file
- [ ] Add `<script>` import in main HTML file
