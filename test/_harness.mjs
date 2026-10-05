/* Loads the app's browser scripts into a Node sandbox.
   js/data.js, js/accounting.js and js/app.js are plain <script> files that
   share one global scope and have no side effects at load time, so they can be
   evaluated in a vm context with a few browser globals stubbed out.
   js/designer.js is deliberately NOT loaded — it calls App.init() on load. */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal localStorage that behaves like the real one (string values only). */
export function makeLocalStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

/**
 * Build a fresh app context (js/users.js included: it owns login, users and permissions).
 *
 * Note: objects and arrays returned from the sandbox carry the vm realm's
 * prototypes, so `assert.deepStrictEqual` against a host-side literal fails on
 * prototype identity. Spread (`[...arr]`) or use `assert.deepEqual` when
 * comparing values that came out of the app.
 * Returns the sandbox, so tests can reach App, DB, SIDEBAR, REG and the
 * accounting functions, plus `alerts` capturing anything the app tried to
 * alert() and `stubEl` for registering fake DOM elements by id.
 */
export function loadApp({ storage = {} } = {}) {
  const alerts = [];
  const elements = new Map();

  /* A stand-in DOM node. The app renders by assigning innerHTML and toggling
     classes, so the tests only need those to be writable — the point is to let
     render paths run to completion, not to reproduce a browser. */
  const makeNode = (id) => {
    const classes = new Set();
    return {
      id, value: '', checked: false, innerHTML: '', textContent: '', style: {},
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        toggle: (c, on) => (on === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : on ? classes.add(c) : classes.delete(c)),
        contains: (c) => classes.has(c),
      },
      appendChild() {}, removeChild() {}, remove() {}, click() {}, focus() {}, select() {},
      querySelectorAll: () => [], querySelector: () => null,
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null,
    };
  };
  /* Unknown ids are created on demand so render paths don't crash on a missing
     node; ids registered via stubEl keep whatever value the test gave them. */
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeNode(id));
    return elements.get(id);
  };

  const sandbox = {
    console,
    localStorage: makeLocalStorage(storage),
    alert: (m) => { alerts.push(String(m)); },
    navigator: { userAgent: 'node-test', clipboard: { writeText: async () => {} } },
    location: { protocol: 'http:', origin: 'http://localhost:8080', href: '' },
    document: {
      getElementById: getEl,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: (tag) => makeNode(tag),
      /* a real node, so code that toggles a class on <body> (the mobile nav
         drawer) works and tests can assert on it */
      body: makeNode('body'),
    },
    window: {},
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Intl,
    /* js/users.js hashes passwords and computes TOTP codes with Web Crypto */
    crypto: globalThis.crypto,
    TextEncoder,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  // The files must run as one script: they reference each other's top-level
  // bindings, and `const App = …` / `const DB = …` are lexical, so they are not
  // reachable as globals until we publish them explicitly at the end.
  const FILES = ['js/data.js', 'js/accounting.js', 'js/app.js', 'js/users.js'];
  const EXPORTS = ['App', 'DB', 'SIDEBAR', 'SIDEBAR_FOOT', 'SIDEBAR_GROUPS', 'LABEL2KEY', 'KEY2LABEL', 'REG', 'CUR'];
  const source =
    FILES.map((f) => `/* ==== ${f} ==== */\n` + readFileSync(join(ROOT, f), 'utf8')).join('\n;\n') +
    `\n;(function(){ ${EXPORTS.map((n) => `try{ globalThis.${n} = ${n}; }catch(e){}`).join(' ')} })();`;
  vm.runInContext(source, sandbox, { filename: 'app-bundle.js' });

  sandbox.alerts = alerts;
  /** Give a form control a value the app will read back by id. */
  sandbox.stubEl = (id, value) => { const el = getEl(id); el.value = value; el.checked = !!value; };
  /** Read what the app rendered into a container. */
  sandbox.htmlOf = (id) => getEl(id).innerHTML;
  sandbox.clearEls = () => elements.clear();
  return sandbox;
}

/** An app context with the seeded demo business open. */
export function loadAppWithDemo() {
  const ctx = loadApp();
  const biz = ctx.demoBusiness();
  ctx.ensureSettings(biz);
  ctx.ensureCoa(biz);
  ctx.DB.set(ctx.DB.k.biz, [biz]);
  ctx.App.openBiz = biz.id;
  return { ctx, biz: ctx.App.curBiz() };
}
