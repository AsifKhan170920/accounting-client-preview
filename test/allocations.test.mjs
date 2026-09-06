/* Payment / invoice allocation (settlementIndex + syncInvoiceBalances in
   js/accounting.js, App.invStatus in js/app.js).

   The panel that collects the allocations is DOM work and is driven against a
   real document elsewhere; what is pinned here is the arithmetic underneath —
   which invoice a payment settles, what stays an unallocated credit, and the
   promise that none of it disturbs the double entry. */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_harness.mjs';

let ctx, App, b;

/** A business with one customer, one supplier and their open documents. */
function seed(ctx) {
  const biz = {
    id: 1, name: 'Alloc Co',
    records: {
      bankCash: [{ id: 300, name: 'ADCB', balance: 0 }],
      customers: [{ id: 100, name: 'ABC Customer', balance: 0 }],
      suppliers: [{ id: 200, name: 'Supplier ABC', balance: 0 }],
      salesInv: [
        { id: 11, uuid: 'iv-1', reference: 'INV-001', issueDate: '2026-09-01', dueDate: '2026-09-15',
          customer: 'ABC Customer', subtotal: 50000, tax: 0, total: 50000, balanceDue: 50000, lines: [] },
        { id: 12, uuid: 'iv-2', reference: 'INV-002', issueDate: '2026-09-03', dueDate: '2026-09-20',
          customer: 'ABC Customer', subtotal: 25000, tax: 0, total: 25000, balanceDue: 25000, lines: [] },
        { id: 13, uuid: 'iv-3', reference: 'INV-003', issueDate: '2026-09-05', dueDate: '2026-09-25',
          customer: 'Other Customer', subtotal: 15000, tax: 0, total: 15000, balanceDue: 15000, lines: [] },
      ],
      purchInv: [
        { id: 21, uuid: 'bl-1', reference: 'BILL-001', issueDate: '2026-09-01',
          supplier: 'Supplier ABC', subtotal: 80000, tax: 0, total: 80000, balanceDue: 80000, lines: [] },
        { id: 22, uuid: 'bl-2', reference: 'BILL-002', issueDate: '2026-09-04',
          supplier: 'Supplier ABC', subtotal: 30000, tax: 0, total: 30000, balanceDue: 30000, lines: [] },
      ],
      receipts: [], payments: [],
    },
  };
  ctx.ensureSettings(biz);
  ctx.ensureCoa(biz);
  ctx.ensureControl(biz, 'Accounts receivable', 'assets');
  ctx.ensureControl(biz, 'Accounts payable', 'liabilities');
  ctx.ensureAllControls(biz);
  return biz;
}

const acct = (name) => b.coa.find((n) => new RegExp('^' + name + '$', 'i').test(n.name || '')).id;

/** Post a receipt or payment with one AR/AP line, optionally allocated. */
function cash(kind, control, party, amount, allocations) {
  const doc = {
    id: Date.now() + Math.floor(Math.random() * 1e6), uuid: 'doc-' + (b.records[kind].length + 1),
    date: '2026-09-10', reference: kind.toUpperCase() + '-' + (b.records[kind].length + 1),
    amount, lines: [{ account: acct(control), sub: party, amount }],
  };
  if (allocations) doc.allocations = allocations;
  b.records[kind].push(doc);
  ctx.refreshSummary(b);
  return doc;
}

const alloc = (uid, party, amount, key = 'salesInv') => ({ key, uid, party, amount });
const inv = (uuid) => b.records.salesInv.concat(b.records.purchInv).find((i) => i.uuid === uuid);
const idx = (side, opts) => ctx.settlementIndex(b, side, opts);
const openInvoicesFor = (side, party) => ctx.openInvoicesFor(b, side, party);

beforeEach(() => {
  ctx = loadApp();
  App = ctx.App;
  b = seed(ctx);
  App.openBiz = b.id;
  App.curBiz = () => b;
});

describe('nothing allocated: the old oldest-first behaviour is untouched', () => {
  test('an unallocated receipt settles the oldest invoice first', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 60000);
    const ix = idx('cust');
    assert.equal(ix.byUid['iv-1'].outstanding, 0);
    assert.equal(ix.byUid['iv-2'].outstanding, 15000);
    assert.equal(ix.byUid['iv-1'].implicit, 50000);
    assert.equal(ix.byUid['iv-1'].allocated, 0, 'nothing was pinned to an invoice');
  });

  test('anything over the total owed shows up as a credit', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 100000);
    assert.equal(idx('cust').byParty['ABC Customer'].credit, 25000);
  });

  test('an opening balance settles before any invoice', () => {
    b.records.customers[0].balance = 10000;
    cash('receipts', 'Accounts receivable', 'ABC Customer', 10000);
    assert.equal(idx('cust').byUid['iv-1'].outstanding, 50000, 'the receipt cleared the opening balance');
  });
});

describe('explicit allocation', () => {
  test('a partial payment leaves the rest of the invoice outstanding', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 40000, [alloc('iv-1', 'ABC Customer', 40000)]);
    const row = idx('cust').byUid['iv-1'];
    assert.equal(row.allocated, 40000);
    assert.equal(row.paid, 40000);
    assert.equal(row.outstanding, 10000);
  });

  test('the unapplied remainder is held as a credit, not pushed onto the next invoice', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 50000, [alloc('iv-1', 'ABC Customer', 20000)]);
    const ix = idx('cust');
    assert.equal(ix.byUid['iv-1'].outstanding, 30000, 'INV-001 keeps its balance');
    assert.equal(ix.byUid['iv-1'].implicit, 0, 'the remainder did not silently settle it');
    assert.equal(ix.byUid['iv-2'].outstanding, 25000, 'nor the next invoice');
    assert.equal(ix.byParty['ABC Customer'].credit, 30000);
  });

  test('one payment spread over several invoices', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 75000, [
      alloc('iv-1', 'ABC Customer', 50000), alloc('iv-2', 'ABC Customer', 25000)]);
    const ix = idx('cust');
    assert.equal(ix.byUid['iv-1'].outstanding, 0);
    assert.equal(ix.byUid['iv-2'].outstanding, 0);
    assert.equal(ix.byParty['ABC Customer'].credit, 0);
  });

  test('several payments against one invoice accumulate', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 20000, [alloc('iv-1', 'ABC Customer', 20000)]);
    cash('receipts', 'Accounts receivable', 'ABC Customer', 15000, [alloc('iv-1', 'ABC Customer', 15000)]);
    const row = idx('cust').byUid['iv-1'];
    assert.equal(row.paid, 35000);
    assert.equal(row.outstanding, 15000);
  });

  test('allocation never credits an invoice beyond its own total', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 80000, [alloc('iv-1', 'ABC Customer', 80000)]);
    assert.equal(idx('cust').byUid['iv-1'].outstanding, 0);
    assert.equal(idx('cust').byUid['iv-1'].allocated, 50000, 'clamped to the invoice total');
  });

  test('one party\'s allocation does not touch another party\'s invoice', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 50000, [alloc('iv-1', 'ABC Customer', 50000)]);
    assert.equal(idx('cust').byUid['iv-3'].outstanding, 15000);
  });
});

describe('one payment across several invoices', () => {
  test('each invoice keeps its own applied amount', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 60000, [
      alloc('iv-1', 'ABC Customer', 45000), alloc('iv-2', 'ABC Customer', 15000)]);
    const ix = idx('cust');
    assert.equal(ix.byUid['iv-1'].allocated, 45000);
    assert.equal(ix.byUid['iv-2'].allocated, 15000);
    assert.equal(ix.byUid['iv-1'].outstanding, 5000, 'partial');
    assert.equal(ix.byUid['iv-2'].outstanding, 10000, 'partial');
  });

  test('a mix of full and partial settlement in one payment', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 60000, [
      alloc('iv-1', 'ABC Customer', 50000), alloc('iv-2', 'ABC Customer', 10000)]);
    assert.equal(App.invStatus(inv('iv-1')), 'Paid');
    assert.equal(App.invStatus(inv('iv-2')), 'Partially paid');
  });

  test('what is not applied is reported as the unallocated balance', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 60000, [
      alloc('iv-1', 'ABC Customer', 20000), alloc('iv-2', 'ABC Customer', 5000)]);
    assert.equal(idx('cust').byParty['ABC Customer'].credit, 35000, '60000 - 25000 applied');
  });
});

describe('the invoice list is filtered to one party', () => {
  test('a customer only ever sees their own invoices', () => {
    const mine = openInvoicesFor('cust', 'ABC Customer').map((r) => r.invoice.reference);
    assert.deepEqual([...mine], ['INV-001', 'INV-002']);
    assert.ok(!mine.includes('INV-003'), 'INV-003 belongs to Other Customer');
  });

  test('switching party swaps the list outright', () => {
    const other = openInvoicesFor('cust', 'Other Customer').map((r) => r.invoice.reference);
    assert.deepEqual([...other], ['INV-003']);
  });

  test('a supplier sees bills, never sales invoices', () => {
    const bills = openInvoicesFor('sup', 'Supplier ABC').map((r) => r.invoice.reference);
    assert.deepEqual([...bills], ['BILL-001', 'BILL-002']);
  });

  test('a partly paid invoice stays on the list at its remaining balance', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 20000, [alloc('iv-1', 'ABC Customer', 20000)]);
    const open = openInvoicesFor('cust', 'ABC Customer');
    const one = open.find((r) => r.invoice.reference === 'INV-001');
    assert.ok(one, 'a partially paid invoice must still be selectable');
    assert.equal(one.outstanding, 30000);
    assert.equal(one.paid, 20000);
  });

  test('a settled invoice drops off the list', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 50000, [alloc('iv-1', 'ABC Customer', 50000)]);
    const refs = openInvoicesFor('cust', 'ABC Customer').map((r) => r.invoice.reference);
    assert.ok(!refs.includes('INV-001'));
    assert.ok(refs.includes('INV-002'));
  });

  test('a party with nothing open returns an empty list, not everyone else\'s', () => {
    assert.deepEqual([...openInvoicesFor('cust', 'Nobody Ltd')], []);
  });
});

describe('supplier bills', () => {
  test('a payment allocated across two bills', () => {
    cash('payments', 'Accounts payable', 'Supplier ABC', 100000, [
      alloc('bl-1', 'Supplier ABC', 80000, 'purchInv'), alloc('bl-2', 'Supplier ABC', 20000, 'purchInv')]);
    const ix = idx('sup');
    assert.equal(ix.byUid['bl-1'].outstanding, 0);
    assert.equal(ix.byUid['bl-2'].outstanding, 10000);
    assert.equal(ix.byUid['bl-2'].paid, 20000);
  });

  test('an unallocated supplier payment still ages oldest-first', () => {
    cash('payments', 'Accounts payable', 'Supplier ABC', 90000);
    assert.equal(idx('sup').byUid['bl-1'].outstanding, 0);
    assert.equal(idx('sup').byUid['bl-2'].outstanding, 20000);
  });
});

describe('refunds run the other way', () => {
  test('a payment on Accounts receivable re-opens the balance', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 50000, [alloc('iv-1', 'ABC Customer', 50000)]);
    assert.equal(idx('cust').byUid['iv-1'].outstanding, 0);
    cash('payments', 'Accounts receivable', 'ABC Customer', 20000);
    assert.equal(idx('cust').byUid['iv-1'].outstanding, 0, 'the settled invoice stays settled');
    assert.equal(idx('cust').byParty['ABC Customer'].credit, 0);
    assert.equal(ctx.customerBalance(b, 'ABC Customer'), 45000, 'the refund is owed again: 75000 - 50000 + 20000');
  });
});

describe('syncInvoiceBalances keeps the stored balance honest', () => {
  test('balanceDue and amountPaid follow the ledger', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 20000, [alloc('iv-1', 'ABC Customer', 20000)]);
    assert.equal(inv('iv-1').amountPaid, 20000);
    assert.equal(inv('iv-1').balanceDue, 30000);
    assert.equal(inv('iv-2').balanceDue, 25000);
  });

  test('deleting the payment puts the invoice back', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 50000, [alloc('iv-1', 'ABC Customer', 50000)]);
    assert.equal(inv('iv-1').balanceDue, 0);
    b.records.receipts = [];
    ctx.refreshSummary(b);
    assert.equal(inv('iv-1').balanceDue, 50000);
    assert.equal(inv('iv-1').amountPaid, 0);
  });
});

describe('invoice status', () => {
  test('unpaid, partially paid and paid', () => {
    assert.equal(App.invStatus(inv('iv-2')), 'Unpaid');
    cash('receipts', 'Accounts receivable', 'ABC Customer', 10000, [alloc('iv-2', 'ABC Customer', 10000)]);
    assert.equal(App.invStatus(inv('iv-2')), 'Partially paid');
    cash('receipts', 'Accounts receivable', 'ABC Customer', 15000, [alloc('iv-2', 'ABC Customer', 15000)]);
    assert.equal(App.invStatus(inv('iv-2')), 'Paid');
  });

  test('a past-due invoice still reads Overdue, so the ageing reports keep working', () => {
    const past = { id: 30, uuid: 'iv-old', reference: 'INV-OLD', issueDate: '2020-01-01', dueDate: '2020-02-01',
      customer: 'ABC Customer', subtotal: 1000, tax: 0, total: 1000, balanceDue: 1000, lines: [] };
    b.records.salesInv.push(past);
    ctx.refreshSummary(b);
    assert.equal(App.invStatus(inv('iv-old')), 'Overdue');
    cash('receipts', 'Accounts receivable', 'ABC Customer', 400, [alloc('iv-old', 'ABC Customer', 400)]);
    assert.equal(App.invStatus(inv('iv-old')), 'Overdue', 'past due wins over partly paid');
    assert.equal(inv('iv-old').balanceDue, 600);
  });

  test('a manual status override still wins', () => {
    inv('iv-1').statusOverride = 'Draft';
    assert.equal(App.invStatus(inv('iv-1')), 'Draft');
  });

  test('the dashboard donut has a bucket for every status invStatus can return', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 10000, [alloc('iv-1', 'ABC Customer', 10000)]);
    const counts = App._dashInvoiceStatus(b);
    let n = 0;
    for (const i of b.records.salesInv) { assert.ok(counts[App.invStatus(i)] != null, App.invStatus(i)); n++; }
    assert.equal(Object.values(counts).reduce((a, v) => a + v, 0), n);
  });
});

describe('the ageing report and the form read the same numbers', () => {
  test('_openInvoices matches settlementIndex', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 30000, [alloc('iv-1', 'ABC Customer', 30000)]);
    const open = App._openInvoices(b, 'cust');
    const abc = open.filter((o) => o.party === 'ABC Customer');
    const byRef = Object.fromEntries(abc.map((o) => [o.ref, o.due]));
    assert.equal(byRef['INV-001'], idx('cust').byUid['iv-1'].outstanding);
    assert.equal(byRef['INV-002'], 25000);
  });

  test('a fully settled invoice drops out of the ageing report', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 50000, [alloc('iv-1', 'ABC Customer', 50000)]);
    assert.ok(!App._openInvoices(b, 'cust').some((o) => o.ref === 'INV-001'));
  });

  test('an "as at" date ignores later payments', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 50000, [alloc('iv-1', 'ABC Customer', 50000)]);
    assert.equal(idx('cust', { to: '2026-09-05' }).byUid['iv-1'].outstanding, 50000);
    assert.equal(idx('cust', { to: '2026-09-30' }).byUid['iv-1'].outstanding, 0);
  });
});

describe('the form editing a payment excludes that payment', () => {
  test('skipDoc shows the invoice as it stood before this receipt', () => {
    const doc = cash('receipts', 'Accounts receivable', 'ABC Customer', 20000, [alloc('iv-1', 'ABC Customer', 20000)]);
    assert.equal(idx('cust').byUid['iv-1'].outstanding, 30000);
    assert.equal(idx('cust', { skipDoc: ctx.invUid(doc) }).byUid['iv-1'].outstanding, 50000);
  });
});

describe('allocation never disturbs the double entry', () => {
  test('the customer balance is the same whether or not the receipt is allocated', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 40000);
    const loose = ctx.customerBalance(b, 'ABC Customer');
    b.records.receipts[0].allocations = [alloc('iv-1', 'ABC Customer', 40000)];
    ctx.refreshSummary(b);
    assert.equal(ctx.customerBalance(b, 'ABC Customer'), loose);
  });

  test('the Accounts receivable movement is unchanged by allocations', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 40000);
    const before = ctx.arMovement(b);
    b.records.receipts[0].allocations = [alloc('iv-1', 'ABC Customer', 40000)];
    ctx.refreshSummary(b);
    assert.equal(ctx.arMovement(b), before);
  });

  test('the balance sheet still balances', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 40000, [alloc('iv-1', 'ABC Customer', 40000)]);
    const bs = b.balanceSheet;
    const get = (t) => (bs.find((s) => /assets/i.test(s.title)) && bs) && bs;
    assert.ok(Array.isArray(bs) && bs.length === 3, 'assets / liabilities / equity');
    const [assets, liabilities, equity] = bs.map((s) => s.total);
    assert.ok(Math.abs(assets - (liabilities + equity)) < 0.01,
      `assets ${assets} vs liabilities+equity ${liabilities + equity}`);
    assert.ok(get);
  });
});

describe('allocations survive a round trip through the record', () => {
  test('a document with no allocations behaves exactly as before the feature', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 60000);
    delete b.records.receipts[0].allocations;
    ctx.refreshSummary(b);
    assert.equal(inv('iv-1').balanceDue, 0);
    assert.equal(inv('iv-2').balanceDue, 15000);
  });

  test('an allocation pointing at a deleted invoice is simply ignored', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 20000, [alloc('iv-gone', 'ABC Customer', 20000)]);
    assert.doesNotThrow(() => ctx.refreshSummary(b));
    assert.equal(inv('iv-1').balanceDue, 50000, 'and the money is not applied anywhere else');
  });
});
