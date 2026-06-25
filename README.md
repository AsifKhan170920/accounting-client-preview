# Accounting Client

A standalone, browser‑only accounting application (Manager.io‑style) — no server, no build step.
Originally shipped as two monolithic single‑file HTML documents; the inline CSS and JavaScript
have now been split into proper, separately‑maintainable source files.

## Project structure

```
.
├── index.html                     # App shell: markup + <link>/<script> references only
├── form-html-editor.html          # Standalone form designer shell
├── css/
│   ├── app.css                    # Main application styles
│   ├── form-editor-embedded.css   # Styles for the form editor embedded inside the app
│   └── form-editor.css            # Styles for the standalone form designer
├── js/
│   ├── data.js                    # Persistence (localStorage) + sidebar / register config (DB, SIDEBAR, REG)
│   ├── accounting.js              # Demo seed data + accounting engine (balances, ledgers, COA, movements)
│   ├── app.js                     # App controller: auth, pages, registers, forms, reports, settings
│   ├── designer.js                # Voucher / invoice template designer + app bootstrap (App.init)
│   ├── form-editor-bridge.js      # Glue between the app and the embedded form editor (postMessage bridge)
│   ├── form-editor-embedded.js    # The form editor as embedded in index.html
│   ├── form-editor.js             # The form editor as used by the standalone form-html-editor.html
│   └── invoice-designer-bridge.js # Canva-style invoice designer integration (React + Fabric.js module)
├── invoice-designer/              # React + TypeScript + Fabric.js invoice designer (source)
│   └── src/ …                     # Build with: cd invoice-designer && npm install && npm run build
├── dist/invoice-designer/         # Built IIFE bundle loaded by index.html
│   ├── invoice-designer.js
│   └── invoice-designer.css
├── accounting-client.bundle       # Original git bundle (single‑file snapshot)
└── .vscode/launch.json            # Chrome launch config against http://localhost:8080
```

## How the pieces fit together

`index.html` loads its scripts **in order** — they share a single global scope (no module
system), so load order is significant:

1. `data.js` — defines globals `DB`, `SIDEBAR`, `REG`, currency/invoice config
2. `accounting.js` — pure functions over a business object (`bankActual`, `glEntries`, `summaryFromCoa`, …)
3. `app.js` — the `App` controller object that renders every page
4. `designer.js` — the `Designer` object, then wires up document handlers and calls `App.init()`
5. `form-editor-bridge.js` — connects `App` to the embedded editor via `postMessage`
6. `form-editor-embedded.js` — the editor itself (an IIFE), mounted from the inline `#fedTpl` template

`form-html-editor.html` is the **standalone source** of the form designer (`js/form-editor.js`);
edits there are mirrored into the embedded copy used by the app.

## Running

Because the app now references external `css/` and `js/` files, serve it over HTTP rather than
opening via `file://` (some browsers restrict local file requests):

```sh
python3 -m http.server 8080
# then open http://localhost:8080/
```

Or use the bundled VS Code launch config (**Run → Launch Chrome against localhost**).

All data is stored locally in the browser (localStorage). To print a statement or invoice, use
the **Print** / **Save as PDF** buttons.

## Invoice Designer (Canva-style)

Sales & purchase invoices, quotes, orders, credit/debit notes, and delivery notes use the
**Invoice Designer** — a React + TypeScript + Fabric.js visual editor.

**Open it:** Settings → Custom Theme → Form Formatting → pick a document (e.g. Sales Invoice).

Features:
- Drag, resize, rotate, duplicate, delete, lock, and reorder elements
- Inline text editing (double-click text blocks)
- Fonts, colors, alignment, spacing, shapes, lines, images, logo upload
- Data placeholders: `{{company_name}}`, `{{invoice_number}}`, `{{items_table}}`, etc.
- Customizable line-items table (columns, header styling)
- Layers panel, undo/redo, grid + snap guides, A4 print layout
- Designs saved as JSON per business in `localStorage` (`mgr_invoice_designs`)

**Rebuild the module** after editing source:

```sh
cd invoice-designer && npm run build
```
