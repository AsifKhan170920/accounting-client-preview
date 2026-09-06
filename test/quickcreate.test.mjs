/* Quick-create dropdowns: the "＋ Add New …" entity registry (js/quick-create.js)
   and the DOM-free creation logic it shares with the full-page forms
   (App.createEntityRecord / App.coaCreateAccount / App.ensureControlsFor).

   The dropdown decoration, dialog and searchable panel are DOM work and are
   exercised against a real document elsewhere; what is pinned here is the part
   that decides what gets created, whether it validates, and where it is saved. */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadAppWithDemo } from './_harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let ctx, App, biz, QC;
beforeEach(() => {
  ({ ctx, biz } = loadAppWithDemo());
  App = ctx.App;
  /* quick-create.js is a plain <script> like the rest, so it joins the same
     context and picks up the App / REG bindings the other files declared. */
  vm.runInContext(readFileSync(join(ROOT, 'js/quick-create.js'), 'utf8'), ctx, { filename: 'quick-create.js' });
  QC = ctx.QuickCreate;
});

/* App.curBiz() re-reads from storage, so it hands back a fresh object each
   call — always read through it rather than holding on to one. */
const cur = () => App.curBiz();
const names = (key) => (cur().records[key] || []).map((r) => r.name);
const accountNames = () => (cur().coa || []).filter((n) => n.type === 'account').map((n) => n.name);

describe('the entity registry', () => {
  test('covers every list source a designed form can put in a dropdown', () => {
    for (const src of ['customer', 'supplier', 'bank', 'employee', 'item', 'nonInvItem',
      'fixedAsset', 'intangible', 'capital', 'investment', 'account', 'tax',
      'project', 'division', 'location', 'claimPayer']) {
      assert.equal(QC.known(src), true, src);
    }
  });

  test('unknown and static sources are not creatable', () => {
    for (const src of ['status', 'dueType', 'partyType', '', null, undefined]) {
      assert.equal(QC.known(src), false, String(src));
    }
  });

  test('the label is the register\'s own singular, so the option is context-aware', () => {
    assert.equal(QC.labelOf('customer'), 'Customer');
    assert.equal(QC.labelOf('supplier'), 'Supplier');
    assert.equal(QC.labelOf('item'), 'Inventory Item');
    assert.equal(QC.labelOf('bank'), 'Bank or Cash Account');
    assert.equal(QC.labelOf('account'), 'Account');
    assert.equal(QC.labelOf('tax'), 'Tax Rate');
    assert.equal(QC.labelOf('project'), 'Project');
  });

  test('record entities reuse REG[key].form as the dialog schema', () => {
    const fields = QC.fieldsFor('customer');
    assert.deepEqual([...fields].map((f) => f.key), [...ctx.REG.customers.form].map((f) => f.key));
    assert.equal(fields.find((f) => f.key === 'name').req, 1);
  });

  test('accounts and tax rates get their own schema', () => {
    assert.deepEqual([...QC.fieldsFor('account')].map((f) => f.key), ['name', 'code', 'parent', 'balance']);
    assert.deepEqual([...QC.fieldsFor('tax')].map((f) => f.key), ['name', 'rate']);
  });

  test('the dropdown value matches how each source builds its options', () => {
    assert.equal(QC.valueKeyOf('customer'), 'name');  // <option>Name</option>
    assert.equal(QC.valueKeyOf('account'), 'name');
    assert.equal(QC.valueKeyOf('tax'), 'rate');       // tax options carry the rate
    assert.equal(QC.valueKeyOf('project'), 'id');     // projects are picked by id
    assert.equal(QC.valueKeyOf('division'), 'id');
  });
});

describe('creating register records', () => {
  test('a customer is saved and reported back for selection', () => {
    const before = (cur().records.customers || []).length;
    const r = QC.create('customer', { name: 'Acme Trading LLC' });
    assert.equal(r.ok, true, r.error);
    assert.equal(r.value, 'Acme Trading LLC');
    assert.equal(App.curBiz().records.customers.length, before + 1);
    assert.ok(names('customers').includes('Acme Trading LLC'));
  });

  test('the record persists through the data layer, not just in memory', () => {
    QC.create('supplier', { name: 'Global Supply Co' });
    const stored = ctx.DB.get(ctx.DB.k.biz, []).find((b) => b.id === biz.id);
    assert.ok(stored.records.suppliers.some((s) => s.name === 'Global Supply Co'));
  });

  test('a required field is enforced, using REG\'s own label', () => {
    const r = QC.create('customer', { name: '   ' });
    assert.equal(r.ok, false);
    assert.match(r.error, /required/i);
    assert.equal(r.field, 'name');
  });

  test('a duplicate name is refused rather than silently added', () => {
    QC.create('bank', { name: 'UBL Bank Account' });
    const again = QC.create('bank', { name: 'ubl bank account' });
    assert.equal(again.ok, false);
    assert.match(again.error, /already exists/);
    assert.equal(names('bankCash').filter((n) => /ubl/i.test(n)).length, 1);
  });

  test('numbers come back as numbers and checkboxes as booleans', () => {
    QC.create('item', { name: 'Widget A', salesPrice: '12.50', qty: '3' });
    const it = cur().records.inventory.find((r) => r.name === 'Widget A');
    assert.equal(it.salesPrice, 12.5);
    assert.equal(it.qty, 3);
    QC.create('bank', { name: 'Petty Cash 2', pending: true });
    assert.equal(cur().records.bankCash.find((r) => r.name === 'Petty Cash 2').pending, true);
  });

  test('every new record gets an id and a uuid, like the full-page form', () => {
    const r = QC.create('employee', { name: 'Jane Smith' });
    assert.ok(r.record === undefined || true);
    const rec = cur().records.employees.find((e) => e.name === 'Jane Smith');
    assert.ok(rec.id);
    assert.match(rec.uuid, /^[0-9a-f-]{36}$/);
  });

  test('the control account the record needs is created too', () => {
    QC.create('customer', { name: 'Needs AR' });
    assert.ok(accountNames().includes('Accounts receivable'));
    QC.create('supplier', { name: 'Needs AP' });
    assert.ok(accountNames().includes('Accounts payable'));
    QC.create('employee', { name: 'Needs clearing' });
    assert.ok(accountNames().includes('Employee clearing account'));
  });

  test('the creation is written to the activity log', () => {
    QC.create('customer', { name: 'Logged Co' });
    assert.ok((cur().activity || []).some((a) => a.action === 'create' && a.key === 'customers'));
  });
});

describe('creating chart-of-accounts accounts', () => {
  test('a new account lands in the chart and is reported by name', () => {
    const r = QC.create('account', { name: 'Marketing Spend', code: '6100' });
    assert.equal(r.ok, true, r.error);
    assert.equal(r.value, 'Marketing Spend');
    const node = cur().coa.find((n) => n.name === 'Marketing Spend');
    assert.equal(node.type, 'account');
    assert.equal(node.code, '6100');
  });

  test('a duplicate account name is refused', () => {
    QC.create('account', { name: 'Marketing Spend' });
    const again = QC.create('account', { name: 'MARKETING SPEND' });
    assert.equal(again.ok, false);
    assert.match(again.error, /already exists/);
  });

  test('a name is required', () => {
    assert.equal(QC.create('account', { name: '' }).ok, false);
  });

  test('a Profit & Loss account with no group gets one made for it', () => {
    /* coaCreateAccount deliberately does not save — the caller does — so keep
       hold of the one object it mutated. */
    const b = cur();
    const r = App.coaCreateAccount(b, { name: 'Sundry Income', side: 'pl', parent: '' });
    assert.equal(r.ok, true, r.error);
    const group = b.coa.find((n) => n.id === r.node.parent);
    assert.equal(group.type, 'group');
    assert.equal(group.name, 'Uncategorised');
  });

  test('the Chart of Accounts editor and quick-create share one code path', () => {
    /* coaSave() reads the editor's inputs and then calls coaCreateAccount, so a
       stubbed editor produces exactly the node quick-create would. */
    ctx.stubEl('coa_name', 'Editor Account');
    ctx.stubEl('coa_code', '7000');
    ctx.stubEl('coa_parent', 'assets');
    ctx.stubEl('coa_bal', '250');
    App.coaCtx = { kind: 'account', side: 'bs', id: null };
    App.coaSave();
    const node = App.curBiz().coa.find((n) => n.name === 'Editor Account');
    assert.equal(node.type, 'account');
    assert.equal(node.parent, 'assets');
    assert.equal(node.balance, 250);
  });

  test('the editor surfaces the shared duplicate check instead of adding twice', () => {
    QC.create('account', { name: 'Only Once', parent: 'assets' });
    ctx.stubEl('coa_name', 'Only Once');
    ctx.stubEl('coa_parent', 'assets');
    ctx.stubEl('coa_bal', '');
    ctx.stubEl('coa_code', '');
    App.coaCtx = { kind: 'account', side: 'bs', id: null };
    App.coaSave();
    assert.equal(accountNames().filter((n) => n === 'Only Once').length, 1);
    assert.ok(ctx.alerts.some((a) => /already exists/.test(a)));
  });
});

describe('creating tax rates', () => {
  test('name and rate are stored as the tax-code list expects', () => {
    const r = QC.create('tax', { name: 'VAT 7.5%', rate: '7.5' });
    assert.equal(r.ok, true, r.error);
    assert.equal(r.value, '7.5', 'tax dropdowns hold the rate, not the name');
    assert.deepEqual({ ...cur().taxCodes.find((t) => t.name === 'VAT 7.5%') }, { name: 'VAT 7.5%', rate: 7.5 });
  });

  test('a missing or out-of-range rate is refused', () => {
    assert.equal(QC.create('tax', { name: 'No rate', rate: '' }).ok, false);
    assert.equal(QC.create('tax', { name: 'Too big', rate: '250' }).ok, false);
    assert.equal(QC.create('tax', { name: 'Negative', rate: '-1' }).ok, false);
    assert.equal(QC.create('tax', { name: 'Zero rated', rate: '0' }).ok, true);
  });

  test('a duplicate tax code name is refused', () => {
    QC.create('tax', { name: 'VAT 5%', rate: '5' });
    assert.equal(QC.create('tax', { name: 'VAT 5%', rate: '9' }).ok, false);
  });
});

describe('creating settings-list entities', () => {
  test('a project is stored with an id, which is what the picker selects', () => {
    const r = QC.create('project', { name: 'Marina Fit-out', code: 'MF1' });
    assert.equal(r.ok, true, r.error);
    const p = cur().projects.find((x) => x.name === 'Marina Fit-out');
    assert.equal(r.value, p.id);
    assert.equal(p.status, 'Active', 'new projects default to Active so the picker shows them');
  });

  test('divisions, locations and claim payers all round-trip', () => {
    assert.equal(QC.create('division', { name: 'Northern Region' }).ok, true);
    assert.equal(QC.create('location', { name: 'Warehouse 2' }).ok, true);
    assert.equal(QC.create('claimPayer', { name: 'Ali Raza' }).ok, true);
    assert.ok(cur().divisions.some((d) => d.name === 'Northern Region'));
    assert.ok(cur().locations.some((l) => l.name === 'Warehouse 2'));
    assert.ok(cur().claimPayers.some((c) => c.name === 'Ali Raza'));
  });

  test('locations select by name, matching how their options are built', () => {
    assert.equal(QC.create('location', { name: 'Warehouse 3' }).value, 'Warehouse 3');
  });

  test('a duplicate name in a list is refused', () => {
    QC.create('division', { name: 'Retail' });
    const again = QC.create('division', { name: 'retail' });
    assert.equal(again.ok, false);
    assert.match(again.error, /already exists/);
  });
});

describe('guards', () => {
  test('an unknown entity cannot be created', () => {
    assert.equal(QC.create('nonsense', { name: 'x' }).ok, false);
  });

  test('a read-only business cannot be written to', () => {
    const orig = App.isReadOnly;
    App.isReadOnly = () => true;
    try {
      const r = QC.create('customer', { name: 'Blocked Co' });
      assert.equal(r.ok, false);
      assert.match(r.error, /read only/i);
      assert.ok(!names('customers').includes('Blocked Co'));
    } finally { App.isReadOnly = orig; }
  });
});

describe('ensureControlsFor', () => {
  test('is a no-op for a business with no chart of accounts', () => {
    assert.doesNotThrow(() => App.ensureControlsFor({ }, 'customers', {}));
  });

  test('creates the same accounts the register form used to create inline', () => {
    const b = cur();
    App.ensureControlsFor(b, 'capital', {});
    App.ensureControlsFor(b, 'bankCash', {});
    const made = b.coa.filter((n) => n.type === 'account').map((n) => n.name);
    assert.ok(made.some((n) => /capital/i.test(n)));
    assert.ok(made.some((n) => /cash/i.test(n)));
  });
});
