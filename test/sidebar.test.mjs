import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppWithDemo } from './_harness.mjs';

let ctx, App, biz;
beforeEach(() => {
  ({ ctx, biz } = loadAppWithDemo());
  App = ctx.App;
});

const labels = (ctx) => ctx.SIDEBAR.map((s) => s[1]);

describe('hiddenSections / isHidden', () => {
  test('nothing is hidden on a fresh business', () => {
    assert.equal(App.hiddenSections(biz).length, 0);
    assert.equal(App.isHidden(biz, 'Payments'), false);
  });

  test('a hidden label reads back as hidden', () => {
    biz.sidebarHidden = ['Payments'];
    assert.equal(App.isHidden(biz, 'Payments'), true);
    assert.equal(App.isHidden(biz, 'Receipts'), false);
  });

  test('Summary can never be hidden, even if it is in the list', () => {
    biz.sidebarHidden = ['Summary'];
    assert.equal(App.isHidden(biz, 'Summary'), false, 'Summary is the workspace home');
  });

  test('tolerates a business with no sidebar preference at all', () => {
    assert.equal(App.hiddenSections({}).length, 0);
    assert.equal(App.isHidden(undefined, 'Payments'), false);
  });
});

describe('custAll', () => {
  test('hide all leaves Summary visible', () => {
    App.openCustomize();
    App.custAll(false);
    assert.ok(!App._custDraft.includes('Summary'));
    assert.equal(App._custDraft.length, labels(ctx).length - 1);
  });

  test('show all clears the draft', () => {
    App.openCustomize();
    App.custAll(false);
    App.custAll(true);
    assert.equal(App._custDraft.length, 0);
  });
});

describe('custHideEmpty', () => {
  test('hides exactly the sections with no records', () => {
    App.openCustomize();
    App.custHideEmpty();
    const rec = biz.records || {};
    const expected = ctx.SIDEBAR
      .filter(([, label, key]) => label !== 'Summary' && key && (rec[key] || []).length === 0)
      .map((s) => s[1]);
    assert.deepEqual([...App._custDraft].sort(), [...expected].sort());
  });

  test('keeps the sections that do have records', () => {
    App.openCustomize();
    App.custHideEmpty();
    // the demo business has bank accounts, receipts, customers and a supplier
    for (const keep of ['Bank and Cash Accounts', 'Receipts', 'Customers', 'Suppliers']) {
      assert.ok(!App._custDraft.includes(keep), `${keep} has records and must stay visible`);
    }
  });
});

describe('custToggle', () => {
  test('unchecking adds to the draft, rechecking removes it', () => {
    App.openCustomize();
    App.custToggle('Payments', false);
    assert.ok(App._custDraft.includes('Payments'));
    App.custToggle('Payments', true);
    assert.ok(!App._custDraft.includes('Payments'));
  });

  test('toggling the same section off twice does not duplicate it', () => {
    App.openCustomize();
    App.custToggle('Payments', false);
    App.custToggle('Payments', false);
    assert.equal(App._custDraft.filter((x) => x === 'Payments').length, 1);
  });

  test('Summary cannot be toggled off', () => {
    App.openCustomize();
    App.custToggle('Summary', false);
    assert.ok(!App._custDraft.includes('Summary'));
  });
});

describe('saveCustomize', () => {
  test('persists the draft to the business and clears it', () => {
    App.openCustomize();
    App.custToggle('Payments', false);
    App.custToggle('Debit Notes', false);
    App.saveCustomize();

    const stored = ctx.DB.get(ctx.DB.k.biz, []).find((b) => b.id === biz.id);
    assert.deepEqual([...stored.sidebarHidden].sort(), ['Debit Notes', 'Payments']);
    assert.equal(App._custDraft, null, 'draft should be released after saving');
  });

  test('returns the user to the Summary', () => {
    App.openCustomize();
    App.saveCustomize();
    assert.equal(App.wsMode, 'summary');
  });

  test('never persists Summary as hidden', () => {
    App.openCustomize();
    App._custDraft = ['Summary', 'Payments'];
    App.saveCustomize();
    const stored = ctx.DB.get(ctx.DB.k.biz, []).find((b) => b.id === biz.id);
    assert.deepEqual([...stored.sidebarHidden], ['Payments']);
  });
});

describe('customizeCancel', () => {
  test('discards the draft and leaves the saved state alone', () => {
    biz.sidebarHidden = ['Payments'];
    App.saveBiz(biz);
    App.openCustomize();
    App.custAll(false); // hide everything in the draft
    App.customizeCancel();

    const stored = ctx.DB.get(ctx.DB.k.biz, []).find((b) => b.id === biz.id);
    assert.deepEqual([...stored.sidebarHidden], ['Payments'], 'cancel must not save');
    assert.equal(App._custDraft, null);
  });
});

describe('per-business isolation', () => {
  test('hiding sections in one business does not affect another', () => {
    const other = { id: 4242, name: 'Other Co', records: {} };
    ctx.DB.set(ctx.DB.k.biz, [...ctx.DB.get(ctx.DB.k.biz, []), other]);

    App.openCustomize();
    App.custToggle('Payments', false);
    App.saveCustomize();

    const stored = ctx.DB.get(ctx.DB.k.biz, []).find((b) => b.id === 4242);
    assert.equal(App.hiddenSections(stored).length, 0);
  });
});
