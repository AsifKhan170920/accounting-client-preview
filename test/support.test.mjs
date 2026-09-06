import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, loadAppWithDemo } from './_harness.mjs';

describe('_kb', () => {
  const { App } = loadApp();
  test('formats bytes, kilobytes and megabytes', () => {
    assert.equal(App._kb(512), '512 B');
    assert.equal(App._kb(2048), '2.0 KB');
    assert.equal(App._kb(5 * 1024 * 1024), '5.00 MB');
  });
  test('renders a dash for a non-finite value instead of NaN', () => {
    assert.equal(App._kb(NaN), '—');
    assert.equal(App._kb(Infinity), '—');
  });
});

describe('storageBytes', () => {
  test('separates this app\'s keys from other apps on the same origin', () => {
    const ctx = loadApp({ storage: { mgr_businesses: 'x'.repeat(100), other_app_data: 'y'.repeat(200) } });
    const s = ctx.App.storageBytes();
    assert.ok(s.mine > 0);
    assert.ok(s.total > s.mine, 'total must include the foreign key');
    assert.ok(s.per.mgr_businesses > 0);
  });

  test('reports zero for an empty store', () => {
    const s = loadApp().App.storageBytes();
    assert.equal(s.mine, 0);
  });

  test('only mgr_ keys count as this app\'s', () => {
    const ctx = loadApp({ storage: { not_mgr: 'z'.repeat(50) } });
    assert.equal(ctx.App.storageBytes().mine, 0);
  });
});

describe('supportDiag', () => {
  let ctx;
  beforeEach(() => { ({ ctx } = loadAppWithDemo()); });

  test('counts businesses and their records', () => {
    const d = ctx.App.supportDiag();
    assert.equal(d.businesses, 1);
    assert.ok(d.records > 0, 'the demo business has seeded records');
  });

  test('reports the serving protocol', () => {
    assert.equal(ctx.App.supportDiag().protocol, 'http:');
  });

  test('detects that localStorage is writable', () => {
    assert.equal(ctx.App.supportDiag().localStorageOk, true);
  });

  test('probing localStorage leaves no leftover key behind', () => {
    ctx.App.supportDiag();
    assert.equal(ctx.localStorage.getItem('__t'), null);
  });

  test('reports the designer module as absent when it has not loaded', () => {
    assert.equal(ctx.App.supportDiag().designerLoaded, false);
  });

  test('counts saved invoice designs across businesses', () => {
    ctx.localStorage.setItem('mgr_invoice_designs', JSON.stringify({ b1: { salesInv: {}, purchInv: {} }, b2: { salesInv: {} } }));
    assert.equal(ctx.App.supportDiag().designs, 3);
  });

  test('survives a corrupt designs blob rather than throwing', () => {
    ctx.localStorage.setItem('mgr_invoice_designs', 'not json{');
    assert.equal(ctx.App.supportDiag().designs, 0);
  });
});

describe('supportHtml', () => {
  test('renders without a business open', () => {
    const html = loadApp().App.supportHtml();
    assert.ok(html.includes('Getting started'));
    assert.ok(html.includes('Diagnostics'));
    assert.ok(html.includes('Troubleshooting'));
  });

  test('does not double-escape entities', () => {
    assert.ok(!loadApp().App.supportHtml().includes('&amp;amp;'));
  });

  test('lists the storage keys the data actually lives under', () => {
    const html = loadApp().App.supportHtml();
    for (const k of ['mgr_businesses', 'mgr_users', 'mgr_session', 'mgr_invoice_designs']) {
      assert.ok(html.includes(k), `support page should document ${k}`);
    }
  });
});

describe('settings coverage', () => {
  test('every Settings tile has a matching set_* handler', () => {
    const { App } = loadApp();
    for (const tile of App.setTiles()) {
      const [, label, key] = tile;
      assert.equal(typeof App['set_' + key], 'function', `Settings tile "${label}" has no set_${key}() handler`);
    }
  });

  test('every sidebar section maps to a register, so none falls through', () => {
    const ctx = loadApp();
    for (const [, label, key] of ctx.SIDEBAR) {
      if (label === 'Summary' || label === 'Dashboard') continue;  // workspace homes, not registers
      assert.ok(key, `sidebar entry "${label}" has no register key`);
      assert.ok(ctx.REG[key], `sidebar entry "${label}" points at missing REG.${key}`);
    }
  });
});

/* Guards the work that replaced the placeholder screens: if someone
   reintroduces a dead-end, these fail. */
describe('no stubbed-out entry points', () => {
  const { App } = loadApp();

  test('the removed App.stub() helper has not come back', () => {
    assert.equal(App.stub, undefined);
    assert.equal(App.setStub, undefined);
  });

  test('Support, Customize and Import are real handlers', () => {
    for (const fn of ['renderSupport', 'supportHtml', 'openCustomize', 'customizeHtml', 'saveCustomize', 'importBusiness']) {
      assert.equal(typeof App[fn], 'function', `${fn} should be implemented`);
    }
  });

  test('no user-facing copy promises a later step', () => {
    const ctx = loadApp();
    const { biz } = loadAppWithDemo();
    const screens = [App.supportHtml(), App.customizeHtml(biz)];
    for (const html of screens) {
      assert.ok(!/later step/i.test(html), 'a screen still promises to be built later');
    }
  });
});
