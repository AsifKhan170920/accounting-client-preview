/* Every report in the catalogue must render. The renderers are dispatched by a
   string key, so a typo or a missing method is otherwise only visible by
   clicking through the UI — this walks the whole list instead.

   reportViewHtml catches its own errors and renders them into the page, so a
   thrown error shows up as "could not be generated" rather than a rejection;
   the assertions below look for that text. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_harness.mjs';

const ctx = loadApp();
const { App, ensureCoa, ensureSettings, ensureAllControls, refreshSummary } = ctx;

/** A business carrying at least one record of every type a report can read. */
function fullBiz() {
  const b = {
    id: 1, name: 'Test Co', country: 'United Arab Emirates',
    divisions: [{ name: 'North' }, { name: 'South' }],
    balanceSheet: [
      { title: 'Assets', total: 0, children: [{ name: 'Accounts receivable', amt: 0 }, { name: 'Cash & cash equivalents', amt: 0 }] },
      { title: 'Liabilities', total: 0, children: [{ name: 'Accounts payable', amt: 0 }, { name: 'Output VAT', amt: 0 }, { name: 'Input VAT', amt: 0 }] },
      { title: 'Equity', total: 0, children: [{ name: 'Retained earnings', amt: 0 }] },
    ],
    profitLoss: [
      { title: 'Income', children: [{ name: 'Sales', amt: 0 }] },
      { title: 'Expenses', children: [{ name: 'General expenses', amt: 0 }] },
    ],
    records: {
      bankCash: [{ id: 1, name: 'ADCB', balance: 10000 }],
      customers: [{ id: 2, name: 'Acme', balance: 0 }],
      suppliers: [{ id: 3, name: 'Gulf Supply', balance: 0 }],
      employees: [{ id: 4, name: 'Sara' }],
      capital: [{ id: 5, name: 'Owner', balance: 1000 }],
      inventory: [{ id: 6, name: 'Glass sheet', code: 'G6', unit: 'pcs', qty: 100, openingCost: 1000, purchasePrice: 10, salesPrice: 18 },
                  { id: 7, name: 'Tempered panel', qty: 0, openingCost: 0 }],
      nonInvItems: [{ id: 8, name: 'Installation', code: 'SVC', salesPrice: 200, purchasePrice: 120 }],
      salesInv: [{ id: 9, issueDate: '2026-03-01', dueDate: '2026-03-15', reference: 'SI-1', customer: 'Acme',
                   division: 'North', subtotal: 1000, tax: 50, total: 1050,
                   lines: [{ item: 'Glass sheet', qty: 10, price: 100, net: 1000, taxAmt: 50, taxRate: 5, tax: 'VAT 5%' }] }],
      purchInv: [{ id: 10, issueDate: '2026-02-01', reference: 'PI-1', supplier: 'Gulf Supply',
                   subtotal: 500, tax: 25, total: 525,
                   lines: [{ item: 'Glass sheet', qty: 50, price: 10, net: 500, taxAmt: 25, taxRate: 5, tax: 'VAT 5%' }] }],
      creditNotes: [{ id: 11, issueDate: '2026-03-10', reference: 'CN-1', customer: 'Acme', subtotal: 100, tax: 5, total: 105, lines: [{ net: 100 }] }],
      debitNotes: [{ id: 12, issueDate: '2026-03-11', reference: 'DN-1', supplier: 'Gulf Supply', subtotal: 50, tax: 2.5, total: 52.5, lines: [{ net: 50 }] }],
      receipts: [{ id: 13, date: '2026-03-05', reference: 'R-1', receivedIn: 'ADCB', amount: 400, lines: [{ amount: 400 }] }],
      payments: [{ id: 14, date: '2026-03-06', reference: 'P-1', paidFrom: 'ADCB', amount: 200, lines: [{ amount: 200 }] }],
      journal: [{ id: 15, date: '2026-03-07', reference: 'J-1', lines: [{ debit: 100 }, { credit: 100 }] }],
      payslips: [{ id: 16, date: '2026-03-25', employee: 'Sara', netPay: 3000, lines: [{ ptype: 'Earning', desc: 'Basic', amount: 3000 }] }],
      fixedAssets: [{ id: 17, name: 'Van', acqDate: '2026-01-05', cost: 40000, accumDep: 0 }],
      depreciation: [{ id: 18, date: '2026-03-31', lines: [{ asset: 'Van', amount: 800 }] }],
      intangibles: [{ id: 19, name: 'Trademark', acqDate: '2026-01-01', cost: 12000, accumAmort: 0 }],
      amortization: [{ id: 20, date: '2026-03-31', lines: [{ asset: 'Trademark', amount: 1000 }] }],
      investments: [{ id: 21, name: 'Fund A', symbol: 'FDA', qty: 100, cost: 5000, marketPrice: 60 }],
      expenseClaims: [{ id: 22, date: '2026-03-02', payer: 'Sara', lines: [{ amount: 250 }] }],
      billableTime: [{ id: 23, date: '2026-03-03', employee: 'Sara', customer: 'Acme', hours: 10, rate: 100, status: 'Uninvoiced' }],
      whtReceipts: [{ id: 24, date: '2026-03-04', reference: 'W-1', customer: 'Acme', amount: 50 }],
      invTransfers: [{ id: 25, date: '2026-03-08', fromLocation: 'Main', toLocation: 'Site A', lines: [{ item: 'Glass sheet', qty: 5 }] }],
      invWriteOffs: [{ id: 26, date: '2026-03-09', lines: [{ item: 'Glass sheet', qty: 2 }] }],
      production: [{ id: 27, date: '2026-03-12', item: 'Tempered panel', qty: 4, extraCost: 40, lines: [{ item: 'Glass sheet', qty: 4 }] }],
      iat: [], bankRec: [], salesQuotes: [], salesOrders: [], deliveryNotes: [],
      purchQuotes: [], purchOrders: [], goodsRec: [], special: [],
    },
  };
  ensureSettings(b); ensureCoa(b); ensureAllControls(b); refreshSummary(b);
  return b;
}

const biz = fullBiz();
const inst = { id: 'r1', title: 'Test', from: '2026-01-01', to: '2026-12-31', method: 'Accrual basis' };

/* App renders against a stub DOM; point it at this business. */
App.openBiz = biz.id;
App.curBiz = () => biz;

const keys = Object.keys(App._REPDEF);

describe('report catalogue', () => {
  test('the catalogue is not empty', () => assert.ok(keys.length >= 40));

  test('every report listed in the Reports page has a _REPDEF entry', () => {
    /* reportsHtml builds the groups inline, so read the keys back out of it. */
    const html = App.reportsHtml(biz);
    const linked = [...html.matchAll(/App\.openReport\('([a-z]+)'\)/g)].map(m => m[1]);
    const orphans = linked.filter(k => !App._REPDEF[k]);
    assert.deepEqual([...orphans], []);
  });

  test('every _REPDEF entry is reachable from the Reports page', () => {
    App.repView = null;
    const html = App.reportsHtml(biz);
    const missing = keys.filter(k => html.indexOf("App.openReport('" + k + "')") < 0);
    assert.deepEqual([...missing], []);
  });
});

describe('report rendering', () => {
  for (const key of keys) {
    test(`${App._REPDEF[key].name} renders`, () => {
      biz.reports = { [key]: [inst] };
      App.repView = key; App.repMode = 'view'; App.repInst = inst.id;
      const html = App.reportViewHtml(biz, key, inst.id);
      assert.equal(typeof html, 'string');
      assert.ok(html.length > 0, 'produced no output');
      assert.ok(html.indexOf('could not be generated') < 0, 'renderer threw: ' + html.slice(0, 400));
      assert.ok(html.indexOf('isn’t built yet') < 0, 'still a placeholder');
    });
  }
});

describe('report figures', () => {
  const render = (key) => {
    biz.reports = { [key]: [inst] };
    App.repView = key; App.repMode = 'view'; App.repInst = inst.id;
    return App.reportViewHtml(biz, key, inst.id);
  };

  test('aged receivables shows the customer and an outstanding amount', () => {
    const html = render('agedar');
    assert.ok(html.includes('Acme'));
    assert.ok(html.includes('Over 90 days'));
  });

  test('sales invoice totals by item names the item that was sold', () => {
    assert.ok(render('siti').includes('Glass sheet'));
  });

  test('the inventory price list carries the item code', () => {
    assert.ok(render('invpl').includes('G6'));
  });

  test('tax reconciliation compares documents against the tax control accounts', () => {
    const html = render('taxrec');
    assert.ok(html.includes('Tax payable per this report'));
    assert.ok(html.includes('Tax payable per the ledger'));
  });

  test('the depreciation schedule lists the asset', () => {
    assert.ok(render('fadep').includes('Van'));
  });

  test('the amortization schedule lists the intangible', () => {
    assert.ok(render('iaam').includes('Trademark'));
  });

  test('billable time summary separates uninvoiced from invoiced', () => {
    const html = render('btsum');
    assert.ok(html.includes('Uninvoiced'));
    assert.ok(html.includes('Written off'));
  });

  test('the investment summary shows the unrealised gain', () => {
    assert.ok(render('invest').includes('Unrealised gain'));
  });

  test('expense claims summary groups by payer and by account', () => {
    const html = render('expc');
    assert.ok(html.includes('By payer'));
    assert.ok(html.includes('By account'));
  });

  test('transactions by division picks up the tagged invoice', () => {
    assert.ok(render('divsum').includes('North'));
  });
});
