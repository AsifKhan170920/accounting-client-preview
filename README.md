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
│   ├── app.css                    # Main application styles + the design tokens in :root
│   ├── form-editor-embedded.css   # Styles for the form editor embedded inside the app
│   └── form-editor.css            # Styles for the standalone form designer
├── js/
│   ├── icons.js                   # Inline SVG icon set + label→icon maps (ICO) — loaded first
│   ├── data.js                    # Persistence (localStorage) + sidebar / register config (DB, SIDEBAR, REG)
│   │                              #   36 sidebar entries, 35 registers — adding a tab is one SIDEBAR
│   │                              #   row, one REG entry and one STARTERS entry in the form editors
│   │                              #   SIDEBAR_GROUPS controls how the rail groups them (display only)
│   ├── accounting.js              # Demo seed data + accounting engine (balances, ledgers, COA, movements)
│   │                              #   plus settlementIndex(): payment/invoice allocation and balances
│   ├── app.js                     # App controller: auth, pages, registers, forms, reports, settings
│   ├── designer.js                # Voucher / invoice template designer + app bootstrap (App.init)
│   ├── allocations.js             # Receipt/Payment panel applying money to a party's open invoices
│   ├── party-balance.js           # The selected customer/supplier's balance, beside Paid by / Paid to
│   ├── enter-nav.js               # ENTER behaves like TAB in form fields (one document keydown listener)
│   ├── form-editor-bridge.js      # Glue between the app and the embedded form editor (postMessage bridge)
│   ├── form-editor-embedded.js    # The form editor as embedded in index.html
│   ├── form-editor.js             # The form editor as used by the standalone form-html-editor.html
│   ├── invoice-designer-bridge.js # Canva-style invoice designer integration (React + Fabric.js module)
│   └── quick-create.js            # "＋ Add New …" on entity dropdowns: dialog, validation, searchable panel
├── invoice-designer/              # React + TypeScript + Fabric.js invoice designer (source)
│   └── src/ …                     # Build with: cd invoice-designer && npm install && npm run build
├── dist/invoice-designer/         # Built IIFE bundle loaded by index.html
│   ├── invoice-designer.js
│   └── invoice-designer.css
├── test/                          # Tests for the app scripts (node --test)
│   ├── _harness.mjs               # Loads js/*.js into a vm sandbox with stub DOM/localStorage
│   ├── accounting.test.mjs        # Balances, bank matching, chart of accounts
│   ├── newmodules.test.mjs        # Claims, billable time, WHT, inventory ops, intangibles, investments
│   ├── reports.test.mjs           # Every report in the catalogue renders
│   ├── settings.test.mjs          # Settings screens + the behaviour they drive
│   ├── ui.test.mjs                # Design tokens, icon coverage, nav groups, dashboard maths
│   ├── email.test.mjs             # Templates, mailto building, send validation, log
│   ├── allocations.test.mjs       # Payment/invoice allocation: partial, full, multi, unallocated, ageing
│   ├── partybalance.test.mjs      # Party balance badge: right ledger per party type, right wording
│   ├── enternav.test.mjs          # ENTER-as-TAB decision table (fields, textareas, dropdowns, buttons)
│   ├── quickcreate.test.mjs       # "＋ Add New" entity registry, validation and shared creation logic
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

## What the app covers

The tab list, report catalogue and settings mirror Manager.io's. Everything below
is wired to the same posting engine, so a record entered on any tab moves the
balance sheet and shows up in the ledgers.

### Tabs

Summary · Bank and Cash Accounts · Receipts · Payments · Inter Account Transfers ·
Bank Reconciliations · **Expense Claims** · Customers · Sales Quotes · Sales Orders ·
Sales Invoices · Credit Notes · Delivery Notes · **Billable Time** ·
**Withholding Tax Receipts** · Suppliers · Purchase Quotes · Purchase Orders ·
Purchase Invoices · Debit Notes · Goods Receipts · Inventory Items ·
**Inventory Transfers** · **Inventory Write-offs** · **Production Orders** ·
**Non-inventory Items** · Employees · Payslips · Fixed Assets · Depreciation Entries ·
**Intangible Assets** · **Amortization Entries** · Capital Accounts · Special Accounts ·
**Investments** · Journal Entries

### How the newer record types post

| Record | Debit | Credit |
|---|---|---|
| Expense claim | the line accounts | `Expense claims` (liability to the payer) |
| Billable time — uninvoiced | `Billable time` (asset) | `Billable time - movement` (income) |
| Billable time — written off | `Billable time - write-offs` | `Billable time - movement` |
| Withholding tax receipt | `Withholding tax receivable` | Accounts receivable, against that customer |
| Inventory transfer | — | — (quantity moves between locations; no ledger effect) |
| Inventory write-off | the chosen account | `Inventory on hand`, at weighted-average cost |
| Production order | finished goods, at BOM cost + extras | components, plus the extra-cost account |
| Intangible asset | `Intangible assets, at cost` | `Intangible assets, accumulated amortization` (opening) |
| Amortization entry | `Amortization` | `Intangible assets, accumulated amortization` |
| Investment | `Investments`, at cost + revaluation | `Investment gains (losses)` for the gain |
| Late payment fee | Accounts receivable | the income account set in Settings |

Control accounts are created the first time a record of that type exists —
`ensureAllControls()` runs on every `refreshSummary()`, so nothing needs setting
up by hand. Accumulated depreciation and amortization sit under Assets as contra
accounts and therefore carry negative balances.

`test/newmodules.test.mjs` asserts Assets − Liabilities − Equity is exactly zero
for each of these in isolation and for one business carrying all of them at once.

### Reports

Financial statements, cash, general ledger and tax as before, plus **Aged
Receivables / Payables**, **Customer & Supplier Statements (Unpaid Invoices)**,
**Sales / Purchase Invoice Totals by Customer, Supplier and Item**, **Inventory
Quantity & Value Movement**, **Inventory Profit Margin**, **Inventory Price
List**, **Non-inventory Item Totals**, **Tax Reconciliation**, **Tax Audit**,
**Fixed Asset Depreciation Schedule**, **Intangible Asset Summary** and
**Amortization Schedule**, **Expense Claims Summary**, **Billable Time Summary &
Movement**, **Investment Summary**, **Capital Accounts Transactions**,
**Transactions by Division** and **Custom Reports**.

Adding one means three edits: an entry in `App._REPDEF`, a link in the groups
list inside `reportsHtml()`, and a `_render*` method wired into
`reportViewHtml()`'s dispatch. `test/reports.test.mjs` walks the whole catalogue
and fails if any report throws, is unreachable from the Reports page, or is
still a placeholder.

Ageing applies payments that are not tied to a particular invoice oldest-first,
using the due date where an invoice has one and the issue date otherwise.

### Settings

Business Details · Chart of Accounts · Control Accounts · Custom Theme ·
Date & Number Format · Currencies · Email Settings · Tax Codes · Lock Date ·
Divisions · **Projects** · **Form Defaults** · **Recurring Transactions** ·
**Starting Balances** · **Custom Fields** · **Custom Reports** ·
**Inventory Locations** · **Inventory Kits** · **Expense Claim Payers** ·
**Late Payment Fees** · **Bank Rules** · **User Permissions** ·
**Attachments** · **Obsolete Features** · **Extensions**

Each tile is `[icon, name, key, description, group, ready]` in `App.setTiles()`
with a matching `App.set_<key>(b)` method; a test enforces the pairing so a tile
can never render a blank page. Several of them change behaviour elsewhere:

- **Form Defaults** seed `App._prefill` when you click New.
- **Bank Rules** code the lines that **Import bank statement** creates (on the
  Bank and Cash Accounts footer). It reads CSV with a header row and either an
  `amount` column or separate `debit`/`credit` columns; positive amounts become
  receipts, negative become payments, and anything a rule does not match lands
  in Suspense.
- **Inventory Kits** appear in the item dropdown and draw their components down
  from stock when sold.
- **User Permissions** drive `App.isHidden()` and `App.guardWrite()` — *Read
  only* blocks New / Edit / Delete, *Restricted* also hides tabs. With no
  permissions set nobody is restricted, so a single-user install is unaffected.
- **Late Payment Fees** are opt-in per invoice as well as globally.

### Dates

Date arithmetic goes through `App._isoShift()` / `App._ageDays()`, which parse
`YYYY-MM-DD` as UTC. Parsing those strings as local time and formatting back
through `toISOString()` loses a day everywhere east of Greenwich — the test
suite is run under `TZ=UTC`, `Asia/Dubai`, `America/New_York` and
`Pacific/Kiritimati` for this reason.

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

## Design system

The UI is a warm, card-based SaaS layout: a near-black rail on the left, a warm
off-white canvas, white cards on generous radii, and an amber-orange accent used
only for actions, status and data.

Everything is driven by CSS custom properties declared once in `:root` at the top
of `css/app.css`. **Change a value there and it propagates through the whole app**,
dark mode included — a test asserts the dark block redefines every colour token
the light block sets, so the two can't drift.

```
--accent-solid    filled buttons, the Create New pill, chart lines
--primary         accent for links and rules   --link
--ink / --ink-2 / --muted / --muted-2          text ramp
--bg / --bg-sunken                             warm page ground
--surface / --surface-2 / --surface-3          white card planes
--line / --line-soft / --line-strong           hairlines
--success / --danger / --warn / --info / --violet   (each with --*-tint and --*-line)
--radius (10) / --radius-lg (16) / --radius-xl (22) / --radius-pill
--shadow-card / --shadow-hover / --shadow-1..3
--t-fast / --t-med                             the only two motion durations
```

`--nav-*` is a **separate ramp for the sidebar**, which is dark in both themes
and so cannot inherit the surface tokens. That is why the rail looks the same at
noon and at night while the rest of the app inverts.

`--accent-solid` stays distinct from `--primary`: dark mode needs a deeper fill
behind white button text than the lighter accent it uses for links.

**Dark mode** (`body.theme-dark`, the ◐ control in the header) works almost
entirely by redefining those variables. The exceptions are surfaces that are
deliberately light in *both* themes — printed documents and print previews
represent paper — and the four pastel stat-card grounds, which are mixed for a
light canvas and restated once for dark.

### Layout

`#app` is viewport-height and `overflow:hidden`, so the rail and header stay put
and only the content column scrolls. The print block releases that
(`#app{height:auto}`) or printing would clip to one page.

### Typography and icons

Plus Jakarta Sans, with Inter as the fallback. Money and counts use
`font-variant-numeric: tabular-nums` so columns align on the decimal.

`js/icons.js` holds the whole icon set as inline SVG — a Lucide-style family at a
uniform 1.75 stroke, drawn in `currentColor` so an icon takes the colour of
whatever contains it. Nothing is fetched at runtime. Two maps drive it:
`SECTION` (sidebar label → icon) and `SETTING` (settings key → icon); both are
covered by tests, so adding a tab or a settings tile without an icon fails the
build rather than rendering a hole. Static markup in `index.html` uses
`data-ico="name"` placeholders that `App.paintStaticIcons()` fills at boot.

### Navigation

`SIDEBAR_GROUPS` in `js/data.js` is **presentation only** — it says which group a
section appears under. The labels inside it are the same routing keys
`selectSection()`, Customize and `sidebarHidden` use, so renaming one there would
break navigation and per-business visibility. Tests assert every label is real,
appears in exactly one group, and that nothing falls through to "More".

### Responsive

One rail at ≥1025px. At ≤1024px it becomes an off-canvas drawer behind a scrim,
toggled by `body.nav-open`. At ≤760px the header stacks and the profile card
collapses to its avatar; at ≤520px stat cards go single-column. Tables always
scroll horizontally inside their rounded shell (`.tbl-scroll`) rather than
squashing. `prefers-reduced-motion` disables every transition.

## Dashboard

The Summary page opens with a dashboard, above the Balance Sheet and Profit and
Loss it is derived from. Every figure comes from the same engine the reports use
— `summaryFromCoa`, `glEntries`, `cashTotal`, `liveBalance`, `invStatus` — so the
cards can never disagree with the statements underneath them; a test asserts that
equality directly.

| Widget | Source |
|---|---|
| Total revenue / expenses | period movement on income and expense accounts |
| Outstanding receivables | live Accounts receivable balance + unpaid invoice count |
| Cash balance | `cashTotal()` across bank and cash accounts |
| Financial Overview | monthly income vs expense, one `glEntries` pass per account |
| Cash Flow | receipts against payments in the period |
| Recent Transactions | receipts, payments and invoices, newest first |
| Upcoming Payments | unsettled invoices by due date |
| Invoice Status | `invStatus()` over every sales invoice |
| Expense Breakdown | largest expense accounts for the period |
| Financial Health | profit margin, cash runway, and overdue share of receivables |

Charts are hand-drawn inline SVG — there is no chart library, so the app stays
offline-capable and the charts inherit the theme tokens. Two details worth
knowing before editing them: a gauge arc spans at most 180°, so its
`large-arc-flag` is always `0`; and the donut's segment lengths must sum to the
ring circumference. Both are pinned by tests.

The 3M / 6M / 12M switch sets `App._dashRange` and re-renders; the period itself
follows `b.period`, the same range the Summary's **Edit** button controls.

## Testing

Tests use Node's built-in runner — no extra dependencies, and Node runs the
designer's TypeScript directly.

```sh
npm test              # both suites
npm run test:app      # js/*.js — accounting engine, reports, settings, email, sidebar, support
npm run test:designer # invoice-designer/src — snapping, history, tokens, templates, render
npm run check         # tests + dist freshness
```

`check:dist` needs the designer's dependencies, so run
`npm --prefix ./invoice-designer install` once before `npm run check`.

Because report periods and ageing do date maths, run the app suite under a few
zones before shipping a change that touches dates:

```sh
for tz in UTC Asia/Dubai America/New_York Pacific/Kiritimati; do TZ=$tz npm run test:app; done
```

The app scripts are plain `<script>` files sharing one global scope, so
`test/_harness.mjs` evaluates them in a `vm` context with a stub DOM and
`localStorage`. Values crossing back out carry the sandbox realm's prototypes —
spread them (`[...arr]`) before `assert.deepStrictEqual`.
