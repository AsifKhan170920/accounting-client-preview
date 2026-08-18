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
├── test/                          # Tests for the app scripts (node --test)
│   ├── _harness.mjs               # Loads js/*.js into a vm sandbox with stub DOM/localStorage
│   ├── accounting.test.mjs        # Balances, bank matching, chart of accounts
│   ├── email.test.mjs             # Templates, mailto building, send validation, log
│   ├── sidebar.test.mjs           # Customize (per-business section visibility)
│   └── support.test.mjs           # Diagnostics + settings-coverage guard
├── scripts/check-dist.mjs         # Fails if dist/ has drifted from invoice-designer/src
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

The **Support** tab (top toolbar) has getting-started steps, a note of which
`localStorage` keys hold what, live diagnostics (record counts, storage use,
whether the designer bundle loaded) and a troubleshooting FAQ.

**Customize** at the foot of the sidebar hides sections you don't use. It is saved
per business and only affects the sidebar — records, totals and reports are
untouched. *Hide empty sections* clears out everything with no records.

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
npm run build:dist          # or: cd invoice-designer && npm run build
```

`dist/` is committed because `index.html` loads it directly, so it can drift from
`invoice-designer/src/`. `npm run check:dist` rebuilds into a temp directory and
compares — it exits non-zero if the committed bundle is stale, and never touches
your working tree. Use `node scripts/check-dist.mjs --fix` to rebuild in place.

## Emailing documents

A web page cannot open an SMTP socket, so **Settings → Email Settings** offers two
delivery methods:

| Method | What happens | Attachments |
|---|---|---|
| **Mail client** (default) | Opens your mail app with recipient, subject and body pre-filled from the template | Save the PDF first and attach it yourself — `mailto:` cannot carry files |
| **HTTP relay** | `POST`s `{to, subject, body, from, smtp:{…}}` to an endpoint you run, which does the SMTP delivery | Handled by your relay |

Documents and reports get an **Email** button that composes from the per-document
templates (`{business}`, `{party}`, `{ref}`, `{document}`, `{amount}`, `{date}`).
Every attempt — sent, handed off, or failed — is recorded under **Emails** in the
business header. The relay must allow this origin via CORS. SMTP credentials are
stored in `localStorage` in plain text, so use an app-specific password.

## Theming

The UI uses a **"crisp financial navy"** theme: white surfaces, hairline rules, a deep
navy accent, shallow elevation and tabular figures so money columns align on the decimal.

Everything is driven by CSS custom properties declared once in `:root` at the top of
`css/app.css` — accent, status colours, ink, surfaces, hairlines, form controls, radii,
shadows and the type stack. **Change a colour there and it propagates through the whole
app**, including dark mode.

```
--accent-solid   filled buttons/toggles   --ink / --ink-2 / --muted / --muted-2   text ramp
--primary        accent for text & rules  --surface / --surface-2 / --surface-3    raised planes
--link           hyperlinks               --bg / --bg-sunken                       page grounds
--success/--danger/--warn/--info          --line / --line-soft / --line-strong     hairlines
  (each with a matching --*-tint and --*-line)
```

`--accent-solid` is deliberately separate from `--primary`: dark mode needs a deeper fill
behind white button text than the lighter accent it uses for links and rules.

**Dark mode** (`body.theme-dark`, toggled by the ◐ control top-right) is a navy-tinted dark
that works almost entirely by redefining those same variables — so components need no
dark-specific rules. The handful of overrides that remain cover surfaces which are
deliberately light in *both* themes: printed documents and print previews represent paper,
so they stay white and are what the Print button emits.

Two scoping rules worth knowing before editing:

- `.inv-designer-host` rules keep `app.css`'s generic form styling out of the Invoice
  Designer, which is a self-contained React app with its own control styles loaded after
  this file.
- The form editor marks computed / auto-derived fields (amount in words, journal balance,
  formula results) with a green wash written as an *inline* style, so re-toning it for
  dark mode needs `!important`.

Contrast is checked against WCAG AA: `--muted` clears 4.5:1 on both `--surface` and
`--surface-2`, and `--muted-2` (de-emphasis only) clears the 3:1 non-text threshold.

## Testing

Tests use Node's built-in runner — no extra dependencies, and Node runs the
designer's TypeScript directly.

```sh
npm test              # both suites
npm run test:app      # js/*.js — accounting engine, email, sidebar, support
npm run test:designer # invoice-designer/src — snapping, history, tokens, templates, render
npm run check         # tests + dist freshness
```

The app scripts are plain `<script>` files sharing one global scope, so
`test/_harness.mjs` evaluates them in a `vm` context with a stub DOM and
`localStorage`. Values crossing back out carry the sandbox realm's prototypes —
spread them (`[...arr]`) before `assert.deepStrictEqual`.
