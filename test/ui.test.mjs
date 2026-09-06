/* The redesigned shell. These guard the things a visual pass can silently
   break: a nav group that stops matching a routing label, an icon map that
   drifts from the sidebar, or a dashboard figure that stops agreeing with the
   statements it sits above. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp } from './_harness.mjs';

const ctx = loadApp();
const { App, SIDEBAR, SIDEBAR_FOOT, SIDEBAR_GROUPS, REG,
        ensureCoa, ensureSettings, ensureAllControls, refreshSummary,
        summaryFromCoa, cashTotal, findAcct, liveBalance } = ctx;

const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const iconsSrc = readFileSync(new URL('../js/icons.js', import.meta.url), 'utf8');

describe('navigation grouping', () => {
  test('every section appears in exactly one group', () => {
    const seen = new Map();
    for (const [name, labels] of SIDEBAR_GROUPS)
      for (const l of labels) seen.set(l, (seen.get(l) || 0) + 1);
    const dupes = [...seen].filter(([, n]) => n > 1).map(([l]) => l);
    assert.deepEqual([...dupes], []);
  });

  test('every grouped label is a real routing label', () => {
    const labels = SIDEBAR.map(r => r[1]);
    const unknown = SIDEBAR_GROUPS.flatMap(g => g[1]).filter(l => !labels.includes(l));
    assert.deepEqual([...unknown], []);
  });

  test('every sidebar section is grouped, so none falls into "More"', () => {
    const grouped = SIDEBAR_GROUPS.flatMap(g => g[1]);
    const orphans = SIDEBAR.map(r => r[1]).filter(l => !grouped.includes(l));
    assert.deepEqual([...orphans], []);
  });

  test('groups are named', () => {
    for (const [name, labels] of SIDEBAR_GROUPS) {
      assert.ok(name && name.length, 'a group has no name');
      assert.ok(labels.length, `group ${name} is empty`);
    }
  });
});

describe('icons', () => {
  /* Read the maps out of the source rather than the module, so this still
     checks the file that ships even though icons.js is browser-only. */
  const sectionKeys = [...iconsSrc.matchAll(/'([^']+)':\s*'([a-zA-Z0-9]+)',?/g)];

  test('every sidebar label has an icon mapped', () => {
    const block = iconsSrc.slice(iconsSrc.indexOf('var SECTION'), iconsSrc.indexOf('var ICO'));
    const missing = SIDEBAR.concat(SIDEBAR_FOOT.map(f => [f[0], f[1], null]))
      .map(r => r[1]).filter(l => block.indexOf("'" + l + "'") < 0);
    assert.deepEqual([...missing], []);
  });

  test('every settings tile has an icon mapped', () => {
    const block = iconsSrc.slice(iconsSrc.indexOf('var SETTING'), iconsSrc.indexOf('var ICO'));
    const missing = App.setTiles().map(t => t[2]).filter(k => block.indexOf(k + ':') < 0);
    assert.deepEqual([...missing], []);
  });

  test('every mapped icon name resolves to a drawn path', () => {
    const paths = iconsSrc.slice(iconsSrc.indexOf('var P = {'), iconsSrc.indexOf('/* Sidebar label'));
    const maps = iconsSrc.slice(iconsSrc.indexOf('var SECTION'), iconsSrc.indexOf('var ICO'));
    const used = [...maps.matchAll(/:\s*'([a-zA-Z0-9]+)'/g)].map(m => m[1]);
    const missing = [...new Set(used)].filter(n => paths.indexOf('\n    ' + n + ':') < 0);
    assert.deepEqual([...missing], []);
  });

  test('no emoji glyphs remain in the app shell markup', () => {
    /* The shell is the chrome the user always sees; a stray emoji there breaks
       the single-icon-family rule the design asks for. */
    const shell = html.slice(html.indexOf('<div id="app"'), html.indexOf('<template id="fedTpl"'));
    const emoji = shell.match(/[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/gu) || [];
    assert.deepEqual([...emoji], []);
  });
});

describe('design tokens', () => {
  const root = css.slice(css.indexOf(':root{'), css.indexOf('*{box-sizing'));
  const dark = css.slice(css.indexOf('body.theme-dark{'), css.indexOf('background:var(--bg); color:var(--ink);'));

  test('the dark theme redefines every colour token the light one sets', () => {
    const names = [...root.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1])
      /* shape, motion and type are shared by both themes on purpose */
      .filter(n => !/^--(radius|t-|font)/.test(n));
    const missing = names.filter(n => dark.indexOf(n + ':') < 0);
    assert.deepEqual([...missing], []);
  });

  test('the sidebar has its own ramp, toned separately from the cards', () => {
    for (const n of ['--nav-bg', '--nav-ink', '--nav-ink-2', '--nav-muted', '--nav-muted-2',
      '--nav-hover', '--nav-line', '--nav-chip', '--nav-thumb', '--nav-active-bg', '--nav-active-ink'])
      assert.ok(root.indexOf(n + ':') >= 0, `${n} missing from :root`);
  });

  test('nothing in the rail assumes a dark background any more', () => {
    /* The rail is cream in the light theme, so a hard-coded white-on-dark wash
       would be invisible. Every such colour must come through a --nav-* token,
       which the dark block flips. */
    const rail = css.slice(css.indexOf('/* ---- sidebar rail'), css.indexOf('/* ---- open business'));
    const stray = [...rail.matchAll(/rgba\(255,\s*255,\s*255[^)]*\)/g)].map((m) => m[0]);
    assert.deepEqual([...stray], []);
  });

  test('the rail draws an edge, now that it shares the canvas colour family', () => {
    assert.match(css, /\.sidebar\{[^}]*border-right:1px solid var\(--nav-line\)/);
  });

  test('generous radii and an orange accent, per the design brief', () => {
    assert.match(root, /--radius-xl:\s*2\dpx/);
    assert.match(root, /--radius-pill:\s*999px/);
    assert.ok(root.indexOf('--accent-solid:#EA6A24') >= 0);
  });

  test('reduced-motion is honoured', () =>
    assert.ok(css.indexOf('prefers-reduced-motion') >= 0));

  test('there are breakpoints for tablet and phone', () => {
    assert.ok(css.indexOf('@media (max-width:1024px)') >= 0);
    assert.ok(css.indexOf('@media (max-width:760px)') >= 0);
  });

  test('the scroll chain is bounded end to end', () => {
    /* #app is viewport-height and overflow:hidden, so every flex column between
       it and the scroller must set min-height:0 — a flex item's default
       min-height:auto floors it at content height, which pushes the content out
       of #app where it gets clipped with nothing to scroll. This is exactly the
       bug that made the dashboard unscrollable. */
    assert.ok(/#app\{[^}]*height:100%/.test(css), '#app is not viewport-height');
    assert.ok(/#app\{[^}]*overflow:hidden/.test(css), '#app does not clip');
    assert.ok(/#app>\.page,#pageWorkspace\{min-height:0\}/.test(css),
      'the page/workspace columns do not opt out of min-height:auto');
    assert.ok(/\.ws-body\{[^}]*min-height:0/.test(css), '.ws-body does not opt out');
    assert.ok(/\.ws-main\{[^}]*overflow-y:auto/.test(css), '.ws-main is not the scroller');
    /* The nav list does not scroll — App._fitSidebar() shrinks it to fit — but it
       must still bound itself, or it pushes the workspace out of #app. The
       overflow fallback keeps every link reachable on a window too short to fit. */
    assert.ok(/\.side-scroll\{[^}]*min-height:0[^}]*overflow:hidden/.test(css),
      'the sidebar nav list does not bound itself');
    assert.ok(/\.sidebar\.side-overflow \.side-scroll\{overflow-y:auto\}/.test(css),
      'there is no scroll fallback for a window shorter than the nav can go');
    assert.ok(/#app>\.page\{overflow-y:auto\}/.test(css),
      'pages outside the workspace cannot scroll');
  });

  test('printing releases the viewport-height shell', () => {
    const print = css.slice(css.indexOf('@media print{\n    /* the app shell'));
    assert.ok(print.indexOf('#app{height:auto !important') >= 0);
  });
});

describe('dashboard', () => {
  function biz() {
    const b = {
      id: 1, name: 'Test Co', country: 'United Arab Emirates', baseCurrency: 'AED',
      period: { from: '2026-01-01', to: '2026-12-31' },
      balanceSheet: [
        { title: 'Assets', total: 0, children: [{ name: 'Accounts receivable', amt: 0 }, { name: 'Cash & cash equivalents', amt: 0 }] },
        { title: 'Liabilities', total: 0, children: [{ name: 'Accounts payable', amt: 0 }] },
        { title: 'Equity', total: 0, children: [{ name: 'Retained earnings', amt: 0 }] },
      ],
      profitLoss: [
        { title: 'Income', children: [{ name: 'Sales', amt: 0 }] },
        { title: 'Expenses', children: [{ name: 'Rent', amt: 0 }] },
      ],
      records: {
        bankCash: [{ id: 1, name: 'ADCB', balance: 10000 }],
        customers: [{ id: 2, name: 'Acme', balance: 0 }],
        suppliers: [{ id: 3, name: 'Gulf', balance: 0 }],
        salesInv: [
          { id: 4, issueDate: '2026-03-01', dueDate: '2026-03-31', reference: 'SI-1', customer: 'Acme',
            subtotal: 5000, tax: 0, total: 5000, balanceDue: 5000, lines: [{ net: 5000 }] },
          { id: 5, issueDate: '2026-04-01', dueDate: '2026-04-30', reference: 'SI-2', customer: 'Acme',
            subtotal: 3000, tax: 0, total: 3000, balanceDue: 0, lines: [{ net: 3000 }] },
        ],
        purchInv: [{ id: 6, issueDate: '2026-03-05', reference: 'PI-1', supplier: 'Gulf',
                     subtotal: 1200, tax: 0, total: 1200, balanceDue: 0, lines: [{ net: 1200 }] }],
        receipts: [{ id: 7, date: '2026-03-10', reference: 'R-1', receivedIn: 'ADCB', amount: 900, lines: [{ amount: 900 }] }],
        payments: [{ id: 8, date: '2026-03-12', reference: 'P-1', paidFrom: 'ADCB', amount: 400, lines: [{ amount: 400 }] }],
      },
    };
    ensureSettings(b); ensureCoa(b); ensureAllControls(b); refreshSummary(b);
    return b;
  }
  const b = biz();
  App.openBiz = b.id; App.curBiz = () => b;

  test('the period follows the business, not the wall clock', () => {
    const p = App.dashPeriod(b);
    assert.equal(p.from, '2026-01-01');
    assert.equal(p.to, '2026-12-31');
  });

  test('month buckets are contiguous and end at the period end', () => {
    const m = App._dashMonths('2026-12-31', 12);
    assert.equal(m.length, 12);
    assert.equal(m[0].key, '2026-01');
    assert.equal(m[11].key, '2026-12');
  });

  test('cash in and out come off the bank ledgers', () => {
    const cf = App._dashCash(b, '2026-01-01', '2026-12-31');
    assert.equal(cf.in, 900);
    assert.equal(cf.out, 400);
    assert.equal(cf.net, 500);
  });

  test('invoice status counts match invStatus, so the donut cannot drift', () => {
    const counts = App._dashInvoiceStatus(b);
    const byHand = { Paid: 0, Unpaid: 0, Overdue: 0, Draft: 0 };
    for (const inv of b.records.salesInv) byHand[App.invStatus(inv)]++;
    assert.equal(counts.Paid, byHand.Paid);
    assert.equal(counts.Overdue, byHand.Overdue);
    assert.equal(counts.Paid + counts.Unpaid + counts.Overdue + counts.Draft, 2);
  });

  test('the cash card agrees with cashTotal', () =>
    assert.equal(cashTotal(b), 10000 + 900 - 400));

  test('revenue and expenses agree with the Profit and Loss beneath them', () => {
    const tot = App._dashTotals(b, '2026-01-01', '2026-12-31');
    const s = summaryFromCoa(b);
    const inc = (s.profitLoss || []).filter(x => x.plkind !== 'expense').reduce((a, x) => a + (x.total || 0), 0);
    const exp = (s.profitLoss || []).filter(x => x.plkind === 'expense').reduce((a, x) => a + (x.total || 0), 0);
    assert.equal(Math.round(tot.revenue * 100) / 100, Math.round(inc * 100) / 100);
    assert.equal(Math.round(tot.expenses * 100) / 100, Math.round(exp * 100) / 100);
  });

  test('monthly series sums back to the period total', () => {
    const months = App._dashMonths('2026-12-31', 12);
    const ser = App._dashSeries(b, months);
    const tot = App._dashTotals(b, '2026-01-01', '2026-12-31');
    const sum = a => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
    assert.equal(sum(ser.inc), Math.round(tot.revenue * 100) / 100);
    assert.equal(sum(ser.exp), Math.round(tot.expenses * 100) / 100);
  });

  test('recent transactions come back newest first', () => {
    const r = App._dashRecent(b, 6);
    assert.ok(r.length);
    for (let i = 1; i < r.length; i++)
      assert.ok(String(r[i - 1].date) >= String(r[i].date), 'not sorted newest first');
  });

  test('upcoming payments exclude settled invoices and sort by due date', () => {
    const u = App._dashUpcoming(b, 5);
    assert.ok(u.every(x => x.st !== 'Paid'));
    for (let i = 1; i < u.length; i++)
      assert.ok(String(u[i - 1].due || '9999') <= String(u[i].due || '9999'));
  });

  test('financial health stays inside 0–100', () => {
    const tot = App._dashTotals(b, '2026-01-01', '2026-12-31');
    for (const cash of [-5000, 0, 10, 1e9]) {
      const h = App._dashHealth(b, tot, cash);
      assert.ok(h >= 0 && h <= 100, `out of range: ${h}`);
    }
  });

  test('the gauge draws a single arc, never the complement', () => {
    /* A semicircle spans at most 180°, so the large-arc flag must stay 0. */
    for (const pct of [0, 10, 50, 51, 80, 100]) {
      const svg = App._dashGauge(pct);
      const arcs = [...svg.matchAll(/A88 88 0 (\d) 1/g)].map(m => m[1]);
      assert.deepEqual([...new Set(arcs)], ['0'], `large-arc flag set at ${pct}%`);
    }
  });

  test('the donut segments add up to the whole ring', () => {
    const svg = App._dashDonut({ Paid: 3, Unpaid: 1, Overdue: 2, Draft: 0 });
    const lens = [...svg.matchAll(/stroke-dasharray="([\d.]+) /g)].map(m => parseFloat(m[1]));
    const c = 2 * Math.PI * 52;
    assert.ok(Math.abs(lens.reduce((a, x) => a + x, 0) - c) < 0.5, 'segments do not close the ring');
  });

  test('the dashboard renders, and says so plainly when there is no data', () => {
    const out = App.dashboardHtml(b);
    assert.ok(out.indexOf('Total revenue') >= 0);
    assert.ok(out.indexOf('Financial Overview') >= 0);
    assert.ok(out.indexOf('could not be built') < 0);

    const empty = biz(); empty.records = { bankCash: [] };
    ensureAllControls(empty); refreshSummary(empty);
    App.curBiz = () => empty;
    const out2 = App.dashboardHtml(empty);
    assert.ok(out2.indexOf('No income or expenses recorded') >= 0);
    App.curBiz = () => b;
  });

  test('Summary is the statements, and only the statements', () => {
    const out = App.summaryHtml(b);
    assert.ok(out.indexOf('Balance Sheet') >= 0);
    assert.ok(out.indexOf('Profit and Loss Statement') >= 0);
    assert.ok(out.indexOf('sum-grid') >= 0);
    assert.ok(out.indexOf('dash-stats') < 0, 'the cards belong on the Dashboard tab now');
  });

  test('the Dashboard tab carries the cards and charts', () => {
    const out = App.dashboardPageHtml(b);
    assert.ok(out.indexOf('dash-stats') >= 0);
    assert.ok(out.indexOf('Financial Overview') >= 0);
    assert.ok(out.indexOf('Recent Transactions') >= 0);
    assert.ok(out.indexOf('Financial Health') >= 0);
    assert.ok(out.indexOf('sum-grid') < 0, 'the statements stay on Summary');
  });

  test('Dashboard sits first in the sidebar, above Summary, and cannot be hidden', () => {
    const overview = SIDEBAR_GROUPS.find((g) => g[0] === 'Overview')[1];
    assert.deepEqual([...overview], ['Dashboard', 'Summary']);
    assert.equal(SIDEBAR[0][1], 'Dashboard');
    assert.equal(App.isHidden({ sidebarHidden: ['Dashboard'] }, 'Dashboard'), false);
  });

  test('both workspace homes route to their own view', () => {
    App.selectSection('Dashboard');
    assert.equal(App.wsMode, 'dashboard');
    App.selectSection('Summary');
    assert.equal(App.wsMode, 'summary');
  });
});

describe('shell behaviour', () => {
  test('the drawer opens and closes off a body class', () => {
    App.closeNav();
    assert.equal(ctx.document.body.classList.contains('nav-open'), false);
    App.toggleNav();
    assert.equal(ctx.document.body.classList.contains('nav-open'), true);
    App.closeNav();
    assert.equal(ctx.document.body.classList.contains('nav-open'), false);
  });

  test('the create-new menu only offers sections that exist', () => {
    const missing = App._createTargets().map(t => t[0]).filter(l => !ctx.LABEL2KEY[l]);
    assert.deepEqual([...missing], []);
  });

  test('header search falls back to finding a section by name', () => {
    App.wsMode = 'summary';
    App.globalSearch('journal');
    assert.equal(App.wsSection, 'Journal Entries');
  });

  test('an empty search outside a register changes nothing', () => {
    App.wsMode = 'summary'; App.wsSection = 'Summary';
    App.globalSearch('   ');
    assert.equal(App.wsSection, 'Summary');
  });
});
