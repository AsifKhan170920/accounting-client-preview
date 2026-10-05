/* Native Receipt / Payment / Sales Invoice forms (js/txn-forms.js).

   The combo boxes, keyboard navigation and live in-place updates are DOM work
   and are driven in a real browser; what is pinned here is the part the rest of
   the app depends on: the line arithmetic, the record each save produces (and
   what accounting.js makes of it), loading records written by either engine,
   and the per-business switch back to the Form Designer path. */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadApp } from './_harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let ctx, App, TF;

function seed() {
  const biz = {
    id: 1, name: 'Forms Co', country: 'United Arab Emirates',
    records: {
      bankCash: [{ id: 300, name: 'ADCB', balance: 0 }, { id: 301, name: 'Cash', balance: 0 }],
      customers: [{ id: 100, name: 'ABC Customer', balance: 0, address: 'Dubai', trn: '1234' }],
      suppliers: [{ id: 200, name: 'Supplier ABC', balance: 0 }],
      inventory: [{ id: 400, name: 'Glass 6mm', salesPrice: 120, purchasePrice: 80, qty: 10, openingCost: 800, taxCode: 'VAT 5%' }],
      salesInv: [], receipts: [], payments: [],
    },
    balanceSheet: [{ title: 'Assets', children: [] }, { title: 'Liabilities', children: [] }, { title: 'Equity', children: [] }],
    profitLoss: [],
  };
  ctx.ensureSettings(biz);
  ctx.ensureCoa(biz);
  biz.taxCodes.push({ name: 'GST 18', components: [{ name: 'CGST', rate: 9 }, { name: 'SGST', rate: 9 }] });
  biz.coa.push({ id: 'gInc', type: 'group', name: 'Income', parent: 'pl', plkind: 'income' },
    { id: 'aSales', type: 'account', name: 'Sales', parent: 'gInc', balance: 0 },
    { id: 'gExp', type: 'group', name: 'Expenses', parent: 'pl', plkind: 'expense' },
    { id: 'aRent', type: 'account', name: 'Rent', parent: 'gExp', balance: 0 });
  biz.coaTop.pl.unshift('gInc', 'gExp');
  ctx.ensureControl(biz, 'Accounts receivable', 'assets');
  ctx.ensureControl(biz, 'Accounts payable', 'liabilities');
  ctx.ensureControl(biz, 'Output VAT', 'liabilities');
  ctx.ensureCashControl(biz);
  ctx.DB.set(ctx.DB.k.biz, [biz]);
  App.openBiz = biz.id;
}

beforeEach(() => {
  ctx = loadApp();
  App = ctx.App;
  vm.runInContext(readFileSync(join(ROOT, 'js/txn-forms.js'), 'utf8'), ctx, { filename: 'txn-forms.js' });
  TF = ctx.TxnForms;
  seed();
});

const cur = () => App.curBiz();
const acct = (name) => cur().coa.find((n) => n.type === 'account' && n.name === name).id;
const line = (o) => Object.assign({ item: '', account: '', sub: '', desc: '', qty: '', price: '', discount: '', taxCode: '', division: '' }, o);

/** Fill a fresh form for `key` and save it the way the Create button does. */
function create(key, fill) {
  const t = TF.start(cur(), key, null, 'new');
  fill(t);
  TF.setState(t);
  const rec = TF.save('create', { noNav: true });
  assert.ok(rec && !rec.errors, 'saved: ' + JSON.stringify(rec && rec.errors));
  return rec;
}

describe('line calculation', () => {
  test('qty x price with exclusive tax on an invoice', () => {
    const t = TF.start(cur(), 'salesInv', null, 'new');
    const c = TF.lineCalc(cur(), t, line({ account: acct('Sales'), qty: '3', price: '120', taxCode: 'VAT 5%' }));
    assert.equal(c.net, 360); assert.equal(c.tax, 18); assert.equal(c.total, 378);
  });

  test('inclusive tax backs the tax out of the entered amount', () => {
    const t = TF.start(cur(), 'salesInv', null, 'new'); t.taxInclusive = true;
    const c = TF.lineCalc(cur(), t, line({ account: acct('Sales'), qty: '1', price: '105', taxCode: 'VAT 5%' }));
    assert.equal(c.net, 100); assert.equal(c.tax, 5); assert.equal(c.total, 105);
  });

  test('money lines are tax inclusive unless "Amounts are tax exclusive" is ticked', () => {
    const t = TF.start(cur(), 'receipts', null, 'new');
    const l = line({ account: acct('Sales'), price: '210', taxCode: 'VAT 5%' });
    assert.equal(TF.lineCalc(cur(), t, l).net, 200);
    t.taxExclusive = true;
    assert.equal(TF.lineCalc(cur(), t, l).total, 220.5);
  });

  test('percentage and exact discounts come off before tax', () => {
    const t = TF.start(cur(), 'salesInv', null, 'new'); t.colDiscount = true;
    const l = line({ account: acct('Sales'), qty: '2', price: '100', discount: '10', taxCode: 'VAT 5%' });
    let c = TF.lineCalc(cur(), t, l);
    assert.equal(c.disc, 20); assert.equal(c.net, 180); assert.equal(c.tax, 9);
    t.discType = 'Exact amount';
    c = TF.lineCalc(cur(), t, l);
    assert.equal(c.disc, 10); assert.equal(c.net, 190);
  });

  test('a multi-component tax code charges the sum of its components', () => {
    const t = TF.start(cur(), 'salesInv', null, 'new');
    assert.equal(TF.taxInfo(cur(), 'GST 18').rate, 18);
    const c = TF.lineCalc(cur(), t, line({ account: acct('Sales'), qty: '1', price: '100', taxCode: 'GST 18' }));
    assert.equal(c.tax, 18);
  });

  test('control-account lines carry no tax', () => {
    const t = TF.start(cur(), 'receipts', null, 'new');
    const c = TF.lineCalc(cur(), t, line({ account: acct('Accounts receivable'), sub: 'ABC Customer', price: '500', taxCode: 'VAT 5%' }));
    assert.equal(c.tax, 0); assert.equal(c.total, 500);
  });

  test('rounding to nearest and down, per-tax totals', () => {
    const t = TF.start(cur(), 'salesInv', null, 'new'); t.rounding = true; t.roundMode = 'Round to nearest';
    t.lines = [line({ account: acct('Sales'), qty: '1', price: '100.4', taxCode: 'VAT 5%' }), line({ account: acct('Sales'), qty: '1', price: '10' })];
    let T = TF.totals(cur(), t);
    assert.equal(T.net, 110.4); assert.equal(T.tax, 5.02); assert.equal(T.rnd, -0.42); assert.equal(T.total, 115);
    assert.equal(T.taxes['VAT 5%'], 5.02);
    t.roundMode = 'Round down'; t.lines[1].price = '10.7';
    T = TF.totals(cur(), t);
    assert.equal(T.total, 116);
  });

  test('fixed total reports the difference', () => {
    const t = TF.start(cur(), 'payments', null, 'new'); t.fixedTotal = true; t.fixedTotalValue = '150';
    t.lines = [line({ account: acct('Rent'), price: '100' })];
    assert.equal(TF.totals(cur(), t).diff, 50);
  });
});

describe('saving produces the records accounting.js reads', () => {
  test('a receipt against income credits the account and debits the bank', () => {
    const rec = create('receipts', (t) => { t.bank = 'ADCB'; t.lines = [line({ account: acct('Sales'), price: '1000', desc: 'Cash sale' })]; });
    assert.equal(rec.receivedIn, 'ADCB'); assert.equal(rec.amount, 1000); assert.equal(rec.total, 1000);
    assert.equal(rec.lines[0].account, acct('Sales')); assert.equal(rec.lines[0].amount, 1000); assert.equal(rec.lines[0].desc, 'Cash sale');
    const b = cur();
    assert.equal(ctx.accountMovements(b)[acct('Sales')], 1000);
    assert.equal(ctx.bankActual(b, b.records.bankCash[0]), 1000);
    assert.equal(ctx.suspensePlug(b), 0);
  });

  test('a payment debits the expense and settles a supplier through Accounts payable', () => {
    const rec = create('payments', (t) => {
      t.bank = 'Cash'; t.partyType = 'supplier'; t.party = 'Supplier ABC';
      t.lines = [line({ account: acct('Rent'), price: '300' }), line({ account: acct('Accounts payable'), sub: 'Supplier ABC', price: '200' })];
    });
    assert.equal(rec.paidFrom, 'Cash'); assert.equal(rec.payee, 'Supplier ABC'); assert.equal(rec.payeeType, 'supplier');
    assert.equal(rec.amount, 500);
    const b = cur();
    assert.equal(ctx.accountMovements(b)[acct('Rent')], 300);
    assert.equal(ctx.supplierBalance(b, 'Supplier ABC'), -200);
    assert.equal(ctx.bankActual(b, b.records.bankCash[1]), -500);
  });

  test('a sales invoice posts revenue + Output VAT and owes the customer the total', () => {
    const rec = create('salesInv', (t) => {
      t.customer = 'ABC Customer'; t.dueType = 'Net'; t.dueDays = '30'; t.date = '2026-09-01';
      t.lines = [line({ account: acct('Sales'), qty: '3', price: '120', taxCode: 'VAT 5%' })];
    });
    assert.equal(rec.issueDate, '2026-09-01'); assert.equal(rec.dueDate, '2026-10-01');
    assert.equal(rec.subtotal, 360); assert.equal(rec.tax, 18); assert.equal(rec.total, 378); assert.equal(rec.balanceDue, 378);
    assert.equal(rec.lines[0].net, 360); assert.equal(rec.lines[0].taxAmt, 18); assert.equal(rec.lines[0].tax, 'VAT 5%');
    const b = cur(), mov = ctx.accountMovements(b);
    assert.equal(mov[acct('Sales')], 360);
    assert.equal(mov[acct('Output VAT')], 18);
    assert.equal(ctx.customerBalance(b, 'ABC Customer'), 378);
  });

  test('Receive payment prefills the balance due and settles the invoice', () => {
    const inv = create('salesInv', (t) => { t.customer = 'ABC Customer'; t.lines = [line({ account: acct('Sales'), qty: '1', price: '1000', taxCode: 'VAT 5%' })]; });
    const pf = TF.receiptPrefill(cur(), inv);
    assert.equal(pf.paidBy, 'ABC Customer'); assert.equal(pf.lines[0].amount, 1050);
    assert.equal(pf.allocations[0].uid, ctx.invUid(inv)); assert.equal(pf.allocations[0].amount, 1050);
    const t = TF.start(cur(), 'receipts', pf, 'new');
    assert.equal(t.partyType, 'customer'); assert.equal(t.lines[0].account, acct('Accounts receivable')); assert.equal(t.lines[0].sub, 'ABC Customer');
    t.bank = 'ADCB'; TF.setState(t);
    const rec = TF.save('create', { noNav: true });
    assert.equal(rec.allocations.length, 1);
    const b = cur();
    assert.equal(b.records.salesInv[0].balanceDue, 0);
    assert.equal(App.invStatus(b.records.salesInv[0]), 'Paid');
    assert.equal(ctx.customerBalance(b, 'ABC Customer'), 0);
  });

  test('an inventory item fills price, tax and a locked sales account', () => {
    const t = TF.start(cur(), 'salesInv', null, 'new'); TF.setState(t);
    TF._pickItem(0, 'Glass 6mm');
    const l = TF.state().lines[0];
    assert.equal(l.price, '120'); assert.equal(l.taxCode, 'VAT 5%');
    assert.equal(cur().coa.find((n) => n.id === l.account).name, 'Inventory - sales');
  });

  test('picking Accounts receivable on a customer receipt defaults the customer', () => {
    const t = TF.start(cur(), 'receipts', null, 'new'); t.partyType = 'customer'; t.party = 'ABC Customer'; TF.setState(t);
    TF._switchAccount(0, acct('Accounts receivable'));
    assert.equal(TF.state().lines[0].sub, 'ABC Customer');
  });
});

describe('validation', () => {
  test('bank, party, lines and sub-ledger are required', () => {
    const t = TF.start(cur(), 'receipts', null, 'new'); t.partyType = 'customer';
    t.lines = [line({ account: acct('Accounts receivable'), price: '10' })];
    const E = TF.validate(cur(), t).join('\n');
    assert.match(E, /Received in account is required/);
    assert.match(E, /Select a customer for Paid by/);
    assert.match(E, /select a customer for “Accounts receivable”/);
  });

  test('an empty form needs at least one line', () => {
    const t = TF.start(cur(), 'salesInv', null, 'new'); t.customer = 'ABC Customer';
    assert.match(TF.validate(cur(), t).join('\n'), /Add at least one line/);
  });

  test('a duplicate manual reference and the lock date are refused', () => {
    create('receipts', (t) => { t.bank = 'ADCB'; t.autoRef = false; t.reference = 'R-1'; t.lines = [line({ account: acct('Sales'), price: '5' })]; });
    const b = cur(); b.lockDate = '2026-06-30'; App.saveBiz(b);
    const t = TF.start(cur(), 'receipts', null, 'new'); t.bank = 'ADCB'; t.autoRef = false; t.reference = 'R-1'; t.date = '2026-06-01';
    t.lines = [line({ account: acct('Sales'), price: '5' })];
    const E = TF.validate(cur(), t).join('\n');
    assert.match(E, /Reference R-1 is already used/);
    assert.match(E, /lock date/);
  });

  test('a failed save stores nothing', () => {
    const t = TF.start(cur(), 'payments', null, 'new'); TF.setState(t);
    const r = TF.save('create', { noNav: true });
    assert.ok(r.errors.length);
    assert.equal(cur().records.payments.length, 0);
  });
});

describe('editing', () => {
  test('a saved record loads back and re-saves unchanged', () => {
    const rec = create('salesInv', (t) => {
      t.customer = 'ABC Customer'; t.colDiscount = true; t.taxInclusive = true;
      t.lines = [line({ account: acct('Sales'), qty: '2', price: '105', discount: '10', taxCode: 'VAT 5%', desc: 'Panels' })];
    });
    const t = TF.start(cur(), 'salesInv', rec, 'edit');
    assert.equal(t.mode, 'edit'); assert.equal(t.id, rec.id); assert.equal(t.taxInclusive, true);
    assert.equal(t.lines[0].price, '105'); assert.equal(t.lines[0].discount, '10'); assert.equal(t.lines[0].desc, 'Panels');
    TF.setState(t);
    const again = TF.save('update', { noNav: true });
    assert.equal(again.id, rec.id); assert.equal(again.uuid, rec.uuid);
    assert.equal(again.total, rec.total); assert.equal(again.tax, rec.tax);
    assert.equal(cur().records.salesInv.length, 1);
  });

  test('a receipt written by the Form Designer bridge loads with its account, tax code and amounts', () => {
    const designed = {
      id: 77, uuid: 'd-77', date: '2026-08-01', reference: '9', receivedIn: 'ADCB', paidBy: 'Walk-in', paidByType: 'other', amount: 105,
      lines: [{ items: '', item: '', description: 'Repair', desc: 'Repair', accounts: 'Sales', accountName: 'Sales', account: acct('Sales'),
        amountNoTax: 100, totalWithTax: 105, taxRate: 5, tax: 5, net: 100, amount: 105, taxAmt: 5, qty: '', price: '' }],
    };
    const b = cur(); b.records.receipts.push(designed); App.saveBiz(b);
    const t = TF.start(cur(), 'receipts', designed, 'edit');
    assert.equal(t.bank, 'ADCB'); assert.equal(t.partyType, 'other'); assert.equal(t.party, 'Walk-in');
    assert.equal(t.taxExclusive, true);
    assert.equal(t.lines[0].account, acct('Sales')); assert.equal(t.lines[0].taxCode, 'VAT 5%'); assert.equal(t.lines[0].price, '100');
    assert.equal(TF.totals(cur(), t).total, 105);
  });

  test('a clone starts with a fresh reference and none of the original allocations', () => {
    const inv = create('salesInv', (t) => { t.customer = 'ABC Customer'; t.lines = [line({ account: acct('Sales'), qty: '1', price: '100' })]; });
    const pf = TF.receiptPrefill(cur(), inv);
    const t0 = TF.start(cur(), 'receipts', pf, 'new'); t0.bank = 'ADCB'; TF.setState(t0);
    const rec = TF.save('create', { noNav: true });
    const cp = JSON.parse(JSON.stringify(rec)); delete cp.id; delete cp.uuid; delete cp.reference;   // what App.cloneRecord hands over
    const t = TF.start(cur(), 'receipts', cp, 'new');
    assert.equal(t.autoRef, true); assert.equal(t.allocations.length, 0);
    assert.notEqual(t.reference, rec.reference);
  });

  test('a legacy cash line ({account, sub, amount}) loads as an amount', () => {
    const t = TF.start(cur(), 'payments', { paidFrom: 'Cash', lines: [{ account: acct('Rent'), sub: '', desc: 'June', amount: 450 }] }, 'edit');
    assert.equal(t.lines[0].price, '450'); assert.equal(t.lines[0].desc, 'June');
    assert.equal(TF.totals(cur(), t).total, 450);
  });
});

describe('engine switch', () => {
  test('receipts, payments and sales invoices open in the native form by default', () => {
    for (const label of ['Receipts', 'Payments', 'Sales Invoices']) {
      App.wsSection = label; App.editingId = null;
      const html = App.formHtml(cur());
      assert.match(html, /id="txHost"/, label);
      assert.match(html, /Use Form Designer for this form/, label);
    }
  });

  test("b.formEngine[key] = 'designed' keeps the Form Designer path", () => {
    const b = cur(); b.formEngine = { receipts: 'designed' }; App.saveBiz(b);
    App.wsSection = 'Receipts'; App.editingId = null;
    const html = App.formHtml(cur());
    assert.doesNotMatch(html, /id="txHost"/);
    assert.equal(App._nativeTxnForm(cur(), 'receipts'), false);
    assert.equal(App._nativeTxnForm(cur(), 'payments'), true);
  });

  test('setEngine stores the choice per business and per form', () => {
    App.wsSection = 'Payments'; App.wsMode = 'list';
    TF.setEngine('payments', 'designed');
    assert.equal(cur().formEngine.payments, 'designed');
    TF.setEngine('payments', 'native');
    assert.equal(cur().formEngine.payments, undefined);
  });

  test('other documents never route to the native engine', () => {
    assert.equal(TF.handles(cur(), 'purchInv'), false);
    assert.equal(TF.handles(cur(), 'journal'), false);
  });

  test('keyboard navigation reads b.keyboardNav with the documented defaults', () => {
    assert.deepEqual({ ...TF.navCfg({}) }, { enter: true, arrows: true, lastToSave: false, autoLine: true, newLine: true });
    assert.equal(TF.navCfg({ keyboardNav: { autoLine: false } }).autoLine, false);
    assert.equal(TF.navCfg({ keyboardNav: { lastToSave: true } }).lastToSave, true);
  });
});
