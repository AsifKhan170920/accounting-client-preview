/* ENTER-as-TAB navigation (js/enter-nav.js).
   The module's decision logic is pure, so it is loaded into a vm with a tiny
   fake document and exercised against plain objects shaped like DOM nodes —
   enough to pin the whole Enter/TAB/textarea/dropdown/button decision table
   without pulling in a real browser. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Load enter-nav.js and hand back its EnterNav plus the listeners it attached. */
function loadEnterNav() {
  const listeners = [];
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = {
    addEventListener: (type, fn) => listeners.push([type, fn]),
    querySelectorAll: () => [],
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'js/enter-nav.js'), 'utf8'), sandbox, { filename: 'enter-nav.js' });
  return { EnterNav: sandbox.EnterNav, listeners };
}

const { EnterNav, listeners } = loadEnterNav();

/** A stand-in DOM node: only the bits enter-nav.js actually reads. */
function el(tagName, props = {}) {
  const { attrs = {}, rects = 1, optedOut = false, ...rest } = props;
  const node = {
    tagName,
    disabled: false,
    hidden: false,
    readOnly: false,
    isContentEditable: false,
    focused: false,
    selected: false,
    getAttribute: (n) => (n in attrs ? attrs[n] : null),
    getClientRects: () => new Array(rects).fill(0),
    closest: () => (optedOut ? { tagName: 'DIV' } : null),
    focus() { node.focused = true; },
    select() { node.selected = true; },
    ...rest,
  };
  return node;
}

const evt = (over = {}) => ({ key: 'Enter', defaultPrevented: false, ...over });

describe('which controls Enter navigates from', () => {
  test('text, number, date, password and search inputs are fields', () => {
    for (const type of ['text', 'number', 'date', 'password', 'search', 'email', 'tel']) {
      assert.equal(EnterNav.isField(el('INPUT', { type })), true, type);
    }
  });

  test('selects and textareas are fields', () => {
    assert.equal(EnterNav.isField(el('SELECT')), true);
    assert.equal(EnterNav.isField(el('TEXTAREA')), true);
  });

  test('buttons and button-like inputs are not', () => {
    assert.equal(EnterNav.isField(el('BUTTON')), false);
    assert.equal(EnterNav.isField(el('A', { attrs: { href: '#' } })), false);
    for (const type of ['submit', 'button', 'reset', 'image', 'hidden']) {
      assert.equal(EnterNav.isField(el('INPUT', { type })), false, type);
    }
  });

  test('checkboxes and radios navigate — Space still toggles them', () => {
    assert.equal(EnterNav.isField(el('INPUT', { type: 'checkbox' })), true);
    assert.equal(EnterNav.isField(el('INPUT', { type: 'radio' })), true);
  });
});

describe('decide()', () => {
  test('plain Enter in a text input moves on', () => {
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text' }), evt()), 'move');
  });

  test('plain Enter in a date input and a select moves on', () => {
    assert.equal(EnterNav.decide(el('INPUT', { type: 'date' }), evt()), 'move');
    assert.equal(EnterNav.decide(el('SELECT'), evt()), 'move');
  });

  test('Enter on a button is left alone', () => {
    assert.equal(EnterNav.decide(el('BUTTON'), evt()), 'ignore');
    assert.equal(EnterNav.decide(el('INPUT', { type: 'submit' }), evt()), 'ignore');
  });

  test('Enter in a textarea still makes a newline', () => {
    assert.equal(EnterNav.decide(el('TEXTAREA'), evt()), 'ignore');
  });

  test('a one-row line-items grid cell is single-line, so Enter moves on', () => {
    const cell = el('TEXTAREA', { attrs: { rows: '1', class: 'li-grow' }, closest: (sel) => (sel === EnterNav.LINE_GRID ? { tagName: 'TABLE' } : null) });
    assert.equal(EnterNav.isGridCell(cell), true);
    assert.equal(EnterNav.decide(cell, evt()), 'move');
  });

  test('a one-row textarea outside a line-items grid is still a textarea', () => {
    assert.equal(EnterNav.decide(el('TEXTAREA', { attrs: { rows: '1' } }), evt()), 'ignore');
  });

  test('a multi-row textarea inside a grid keeps its newline', () => {
    const notes = el('TEXTAREA', { attrs: { rows: '4' }, closest: (sel) => (sel === EnterNav.LINE_GRID ? { tagName: 'TABLE' } : null) });
    assert.equal(EnterNav.decide(notes, evt()), 'ignore');
  });

  test('Ctrl/Cmd+Enter leaves a textarea, and a read-only one always does', () => {
    assert.equal(EnterNav.decide(el('TEXTAREA'), evt({ ctrlKey: true })), 'move');
    assert.equal(EnterNav.decide(el('TEXTAREA'), evt({ metaKey: true })), 'move');
    assert.equal(EnterNav.decide(el('TEXTAREA', { readOnly: true }), evt()), 'move');
  });

  test('SHIFT+ENTER and ALT+ENTER are never touched', () => {
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text' }), evt({ shiftKey: true })), 'ignore');
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text' }), evt({ altKey: true })), 'ignore');
    assert.equal(EnterNav.decide(el('TEXTAREA'), evt({ shiftKey: true })), 'ignore');
  });

  test('Ctrl/Cmd+Enter on a normal field is left for shortcuts', () => {
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text' }), evt({ ctrlKey: true })), 'ignore');
    assert.equal(EnterNav.decide(el('SELECT'), evt({ metaKey: true })), 'ignore');
  });

  test('keys other than Enter are ignored', () => {
    for (const key of ['Tab', 'ArrowDown', 'ArrowUp', 'Escape', ' ', 'a']) {
      assert.equal(EnterNav.decide(el('INPUT', { type: 'text' }), evt({ key })), 'ignore', key);
    }
  });

  test('an app handler that already claimed the key wins', () => {
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text' }), evt({ defaultPrevented: true })), 'ignore');
  });

  test('a field with its own inline Enter handler keeps it', () => {
    const pass = el('INPUT', { type: 'password', attrs: { onkeydown: "if(event.key==='Enter')App.submitAuth()" } });
    assert.equal(EnterNav.decide(pass, evt()), 'ignore');
  });

  test('an unrelated inline handler does not opt the field out', () => {
    const search = el('INPUT', { type: 'search', attrs: { onkeydown: "if(event.key==='Escape'){this.value=''}" } });
    assert.equal(EnterNav.decide(search, evt()), 'move');
  });

  test('IME composition is never interrupted', () => {
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text' }), evt({ isComposing: true })), 'ignore');
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text' }), evt({ keyCode: 229 })), 'ignore');
  });

  test('contenteditable is left to the editor that owns it', () => {
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text', isContentEditable: true }), evt()), 'ignore');
  });

  test('the designer subtrees opt out', () => {
    assert.equal(EnterNav.decide(el('INPUT', { type: 'text', optedOut: true }), evt()), 'ignore');
    assert.match(EnterNav.OPT_OUT, /#invDesignerHost/);
    assert.match(EnterNav.OPT_OUT, /#fedHost/);
  });
});

describe('isFocusable()', () => {
  test('a plain visible control is focusable', () => {
    assert.equal(EnterNav.isFocusable(el('INPUT', { type: 'text' })), true);
  });

  test('disabled, hidden, zero-box and hidden-type controls are skipped', () => {
    assert.equal(EnterNav.isFocusable(el('INPUT', { type: 'text', disabled: true })), false);
    assert.equal(EnterNav.isFocusable(el('SELECT', { hidden: true })), false);
    assert.equal(EnterNav.isFocusable(el('INPUT', { type: 'text', rects: 0 })), false);
    assert.equal(EnterNav.isFocusable(el('INPUT', { type: 'hidden' })), false);
  });

  test('tabindex="-1" is out of the tab order, tabindex="0" is in it', () => {
    assert.equal(EnterNav.isFocusable(el('DIV', { attrs: { tabindex: '-1' } })), false);
    assert.equal(EnterNav.isFocusable(el('DIV', { attrs: { tabindex: '0' } })), true);
  });
});

describe('tabOrder() / neighbour()', () => {
  const doc = (nodes) => ({ querySelectorAll: () => nodes });

  test('tab order is document order, minus what cannot be focused', () => {
    const a = el('INPUT', { type: 'date' });
    const skipped = el('INPUT', { type: 'text', disabled: true });
    const b = el('SELECT');
    /* spread: the array comes out of the vm realm, so its prototype differs */
    assert.deepEqual([...EnterNav.tabOrder(doc([a, skipped, b]))], [a, b]);
  });

  test('neighbour walks forward and back, and stops at the ends', () => {
    const list = [el('INPUT'), el('SELECT'), el('BUTTON')];
    assert.equal(EnterNav.neighbour(list, list[0], 1), list[1]);
    assert.equal(EnterNav.neighbour(list, list[1], -1), list[0]);
    assert.equal(EnterNav.neighbour(list, list[2], 1), null);
    assert.equal(EnterNav.neighbour(list, list[0], -1), null);
    assert.equal(EnterNav.neighbour(list, el('INPUT'), 1), null, 'unknown element');
  });

  test('the last field lands on the Save button rather than nowhere', () => {
    const amount = el('INPUT', { type: 'number' });
    const save = el('BUTTON');
    assert.equal(EnterNav.neighbour(EnterNav.tabOrder(doc([amount, save])), amount, 1), save);
  });
});

describe('focusLikeTab()', () => {
  test('text-like inputs get their content selected, as TAB does', () => {
    const input = el('INPUT', { type: 'text' });
    EnterNav.focusLikeTab(input);
    assert.equal(input.focused, true);
    assert.equal(input.selected, true);
  });

  test('date inputs are focused but not selected (.select() throws on them)', () => {
    const date = el('INPUT', { type: 'date', select() { throw new Error('InvalidStateError'); } });
    assert.equal(EnterNav.focusLikeTab(date), true);
    assert.equal(date.focused, true);
  });

  test('selects are focused, not selected', () => {
    const sel = el('SELECT');
    EnterNav.focusLikeTab(sel);
    assert.equal(sel.focused, true);
    assert.equal(sel.selected, false);
  });

  test('nothing to focus is not an error', () => {
    assert.equal(EnterNav.focusLikeTab(null), false);
  });
});

describe('onKeyDown() end to end', () => {
  /** A form's worth of controls sharing one fake ownerDocument. */
  function form(nodes) {
    const doc = { querySelectorAll: () => nodes };
    nodes.forEach((n) => { n.ownerDocument = doc; });
    return nodes;
  }

  function press(target, over = {}) {
    let prevented = false;
    EnterNav.onKeyDown({ ...evt(over), target, preventDefault: () => { prevented = true; } });
    return prevented;
  }

  test('the Payment form walks Date → Paid From → Paid To → Amount', () => {
    const [date, paidFrom, paidTo, amount] = form([
      el('INPUT', { type: 'date' }), el('SELECT'), el('SELECT'), el('INPUT', { type: 'number' }),
    ]);
    assert.equal(press(date), true, 'form submission is prevented');
    assert.equal(paidFrom.focused, true);
    press(paidFrom);
    assert.equal(paidTo.focused, true);
    press(paidTo);
    assert.equal(amount.focused, true);
  });

  test('Enter on the last field moves to Save, and Enter on Save is left alone', () => {
    const [amount, save] = form([el('INPUT', { type: 'number' }), el('BUTTON')]);
    press(amount);
    assert.equal(save.focused, true);
    assert.equal(press(save), false, 'the button keeps its own Enter action');
  });

  test('Enter in a textarea neither submits nor moves', () => {
    const [notes, next] = form([el('TEXTAREA'), el('INPUT', { type: 'text' })]);
    assert.equal(press(notes), false);
    assert.equal(next.focused, false);
  });

  test('Enter is still swallowed at the end of the form, so nothing submits', () => {
    const [only] = form([el('INPUT', { type: 'text' })]);
    assert.equal(press(only), true);
  });
});

test('the module attaches exactly one bubble-phase keydown listener', () => {
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0][0], 'keydown');
  assert.equal(listeners[0][1], EnterNav.onKeyDown);
});
