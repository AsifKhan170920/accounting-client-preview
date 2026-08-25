/* Covers the record types added to reach parity with Manager.io:
   expense claims, billable time, withholding tax, inventory transfers /
   write-offs / production orders, intangibles + amortization, investments.
   Each block checks two things: the derived figure the register column shows,
   and that the posting keeps the balance sheet in balance. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp } from './_harness.mjs';

const ctx = loadApp();
const { ensureCoa, ensureSettings, ensureAllControls, refreshSummary, summaryFromCoa,
        findAcct, accountMovements, liveBalance,
        claimTotal, claimPayerBalance, billableAmount, billableByStatus, billableCustomer,
        whtTotal, whtForCustomer, customerBalance,
        lineQtyTotal, writeOffValue, productionCost, invQtyByLocation,
        invItemStats, iaCost, iaAccumAmort, iaBookValue,
        investCost, investMarketValue, investGain, REG, SIDEBAR } = ctx;

/** A minimal business with a usable chart of accounts. */
function makeBiz(records = {}) {
  const b = {
    id: 1, name: 'Test Co', country: 'United Arab Emirates',
    balanceSheet: [
      { title: 'Assets', total: 0, children: [{ name: 'Accounts receivable', amt: 0 }, { name: 'Cash & cash equivalents', amt: 0 }] },
      { title: 'Liabilities', total: 0, children: [{ name: 'Accounts payable', amt: 0 }] },
      { title: 'Equity', total: 0, children: [{ name: 'Retained earnings', amt: 0 }] },
    ],
    profitLoss: [
      { title: 'Income', children: [{ name: 'Sales', amt: 0 }] },
      { title: 'Expenses', children: [{ name: 'General expenses', amt: 0 }] },
    ],
    records,
  };
  ensureSettings(b); ensureCoa(b); ensureAllControls(b);
  return b;
}

/** Assets − Liabilities − Equity, which a correct set of postings drives to zero. */
function bsDrift(b) {
  refreshSummary(b);
  const s = summaryFromCoa(b);
  const [a, l, e] = s.balanceSheet;
  const plNet = (s.profitLoss || []).reduce((t, sec) => t + ((sec.plkind === 'expense' ? -1 : 1) * (sec.total || 0)), 0);
  return Math.round(((a.total || 0) - (l.total || 0) - (e.total || 0)) * 100) / 100;
}

describe('register wiring', () => {
  test('every sidebar entry that names a register has one', () => {
    const missing = SIDEBAR.filter(([, , k]) => k && !REG[k]).map(([, l]) => l);
    assert.deepEqual([...missing], []);
  });
  test('the Manager.io tabs that were missing are all present', () => {
    const want = ['expenseClaims', 'billableTime', 'whtReceipts', 'invTransfers', 'invWriteOffs',
                  'production', 'nonInvItems', 'intangibles', 'amortization', 'investments'];
    const have = SIDEBAR.map(([, , k]) => k).filter(Boolean);
    assert.deepEqual([...want.filter(k => !have.includes(k))], []);
  });
});

describe('expense claims', () => {
  const claim = { id: 1, date: '2026-03-01', payer: 'Wasif', lines: [{ amount: 250 }, { amount: 100 }] };

  test('claimTotal sums the lines', () => assert.equal(claimTotal(claim), 350));
  test('claimTotal falls back to the header amount when there are no lines', () =>
    assert.equal(claimTotal({ amount: 90 }), 90));

  test('the claim is a liability to the payer until it is reimbursed', () => {
    const b = makeBiz({ expenseClaims: [claim] });
    assert.equal(claimPayerBalance(b, 'Wasif'), 350);
    assert.equal(claimPayerBalance(b, 'Someone else'), 0);
  });

  test('posting debits the expense and credits Expense claims, leaving the sheet in balance', () => {
    const b = makeBiz({});
    const exp = findAcct(b, 'General expenses');
    b.records.expenseClaims = [{ id: 1, date: '2026-03-01', payer: 'Wasif', lines: [{ account: exp.id, amount: 250 }] }];
    ensureAllControls(b);
    const mov = accountMovements(b);
    assert.equal(mov[exp.id], 250);
    assert.equal(mov[findAcct(b, 'Expense claims').id], 250);
    assert.equal(bsDrift(b), 0);
  });
});

describe('billable time', () => {
  test('amount is hours × rate unless one was stored', () => {
    assert.equal(billableAmount({ hours: 10, rate: 100 }), 1000);
    assert.equal(billableAmount({ hours: 10, rate: 100, amount: 900 }), 900);
  });

  test('uninvoiced time is an asset with matching income', () => {
    const b = makeBiz({ billableTime: [{ id: 1, customer: 'Acme', hours: 10, rate: 100, status: 'Uninvoiced' }] });
    ensureAllControls(b);
    const mov = accountMovements(b);
    assert.equal(mov[findAcct(b, 'Billable time').id], 1000);
    assert.equal(mov[findAcct(b, 'Billable time - movement').id], 1000);
    assert.equal(bsDrift(b), 0);
  });

  test('written-off time hits the write-off expense, not the asset', () => {
    const b = makeBiz({ billableTime: [{ id: 1, customer: 'Acme', hours: 5, rate: 100, status: 'Written off' }] });
    ensureAllControls(b);
    const mov = accountMovements(b);
    assert.equal(mov[findAcct(b, 'Billable time').id] || 0, 0);
    assert.equal(mov[findAcct(b, 'Billable time - write-offs').id], 500);
    assert.equal(bsDrift(b), 0);
  });

  test('invoiced time posts nothing — the sales invoice carries it', () => {
    const b = makeBiz({ billableTime: [{ id: 1, customer: 'Acme', hours: 5, rate: 100, status: 'Invoiced' }] });
    ensureAllControls(b);
    const mov = accountMovements(b);
    assert.equal(mov[findAcct(b, 'Billable time').id] || 0, 0);
  });

  test('totals split by status and by customer', () => {
    const b = makeBiz({ billableTime: [
      { id: 1, customer: 'Acme', hours: 10, rate: 100, status: 'Uninvoiced' },
      { id: 2, customer: 'Acme', hours: 2, rate: 100, status: 'Invoiced' },
      { id: 3, customer: 'Beta', hours: 1, rate: 100, status: 'Uninvoiced' },
    ] });
    assert.equal(billableByStatus(b, 'Uninvoiced'), 1100);
    assert.equal(billableCustomer(b, 'Acme'), 1200);
    assert.equal(billableCustomer(b, 'Acme', 'Uninvoiced'), 1000);
  });
});

describe('withholding tax receipts', () => {
  test('a receipt reduces what the customer still owes', () => {
    const b = makeBiz({
      customers: [{ id: 1, name: 'Acme', balance: 0 }],
      salesInv: [{ id: 1, customer: 'Acme', total: 5000 }],
      whtReceipts: [{ id: 1, date: '2026-03-01', customer: 'Acme', amount: 500 }],
    });
    assert.equal(whtTotal(b), 500);
    assert.equal(whtForCustomer(b, 'Acme'), 500);
    assert.equal(customerBalance(b, 'Acme'), 4500);
  });

  test('the withheld amount becomes a receivable from the tax authority', () => {
    const b = makeBiz({
      customers: [{ id: 1, name: 'Acme', balance: 0 }],
      salesInv: [{ id: 1, customer: 'Acme', total: 5000, lines: [{ account: null, net: 5000 }] }],
      whtReceipts: [{ id: 1, date: '2026-03-01', customer: 'Acme', amount: 500 }],
    });
    ensureAllControls(b);
    const mov = accountMovements(b);
    assert.equal(mov[findAcct(b, 'Withholding tax receivable').id], 500);
  });
});

describe('inventory transfers', () => {
  const b = () => makeBiz({
    inventory: [{ id: 1, name: 'Glass 6mm', qty: 100, purchasePrice: 10 }],
    invTransfers: [{ id: 1, date: '2026-03-01', fromLocation: 'Main', toLocation: 'Site A',
                     lines: [{ item: 'Glass 6mm', qty: 30 }] }],
  });

  test('lineQtyTotal adds the transferred quantities', () =>
    assert.equal(lineQtyTotal({ lines: [{ qty: 30 }, { qty: 12 }] }), 42));

  test('quantity moves between locations', () => {
    const biz = b();
    assert.equal(invQtyByLocation(biz, 'Site A')['Glass 6mm'], 30);
    assert.equal(invQtyByLocation(biz, 'Main')['Glass 6mm'], -30);
  });

  test('a transfer changes no ledger balance — it is a location move only', () => {
    const biz = b();
    assert.equal(invItemStats(biz, biz.records.inventory[0]).qtyOnHand, 100);
    assert.equal(bsDrift(biz), 0);
  });
});

describe('inventory write-offs', () => {
  test('value is quantity × weighted-average cost', () => {
    const b = makeBiz({
      inventory: [{ id: 1, name: 'Glass 6mm', qty: 100, openingCost: 1000 }],
      invWriteOffs: [{ id: 1, date: '2026-03-01', lines: [{ item: 'Glass 6mm', qty: 5 }] }],
    });
    assert.equal(writeOffValue(b, b.records.invWriteOffs[0]), 50);
  });

  test('an explicit unit cost on the line wins', () => {
    const b = makeBiz({ inventory: [{ id: 1, name: 'Glass 6mm', qty: 100, openingCost: 1000 }] });
    assert.equal(writeOffValue(b, { lines: [{ item: 'Glass 6mm', qty: 5, unitCost: 4 }] }), 20);
  });

  test('stock goes down and the write-off account goes up, in balance', () => {
    const b = makeBiz({
      inventory: [{ id: 1, name: 'Glass 6mm', qty: 100, openingCost: 1000 }],
      invWriteOffs: [{ id: 1, date: '2026-03-01', lines: [{ item: 'Glass 6mm', qty: 5 }] }],
    });
    ensureAllControls(b);
    assert.equal(invItemStats(b, b.records.inventory[0]).qtyOnHand, 95);
    const mov = accountMovements(b);
    assert.equal(mov[findAcct(b, 'Inventory write-offs').id], 50);
    assert.equal(bsDrift(b), 0);
  });
});

describe('production orders', () => {
  const biz = () => makeBiz({
    inventory: [
      { id: 1, name: 'Glass sheet', qty: 100, openingCost: 1000 },   // 10 each
      { id: 2, name: 'Tempered panel', qty: 0, openingCost: 0 },
    ],
    production: [{ id: 1, date: '2026-03-01', item: 'Tempered panel', qty: 4, extraCost: 40,
                   lines: [{ item: 'Glass sheet', qty: 4 }] }],
  });

  test('cost is the bill of materials plus the non-inventory cost', () => {
    const b = biz();
    assert.equal(productionCost(b, b.records.production[0]), 80);   // 4 × 10 + 40
  });

  test('materials are consumed and finished goods are created at that cost', () => {
    const b = biz();
    assert.equal(invItemStats(b, b.records.inventory[0]).qtyOnHand, 96);
    const fin = invItemStats(b, b.records.inventory[1]);
    assert.equal(fin.qtyOnHand, 4);
    assert.equal(fin.totalCost, 80);
    assert.equal(fin.avgCost, 20);
  });

  test('capitalising the extra cost keeps the sheet in balance', () => {
    const b = biz();
    ensureAllControls(b);
    assert.equal(bsDrift(b), 0);
  });
});

describe('intangible assets and amortization', () => {
  const biz = () => makeBiz({
    intangibles: [{ id: 1, name: 'Trademark', acqDate: '2026-01-01', cost: 12000, accumAmort: 0 }],
    amortization: [{ id: 2, date: '2026-03-31', lines: [{ asset: 'Trademark', amount: 1000 }] }],
  });

  test('book value is cost less accumulated amortization', () => {
    const b = biz();
    const a = b.records.intangibles[0];
    assert.equal(iaCost(b, a), 12000);
    assert.equal(iaAccumAmort(b, a), 1000);
    assert.equal(iaBookValue(b, a), 11000);
  });

  test('an opening accumulated amount is included', () => {
    const b = biz();
    b.records.intangibles[0].accumAmort = 500;
    assert.equal(iaAccumAmort(b, b.records.intangibles[0]), 1500);
  });

  test('amortization is an expense against accumulated amortization', () => {
    const b = biz();
    ensureAllControls(b);
    const mov = accountMovements(b);
    assert.equal(mov[findAcct(b, 'Amortization').id], 1000);
    /* Accumulated amortization sits under Assets as a contra account, so a
       credit shows as a negative movement — same as accumulated depreciation. */
    assert.equal(mov[findAcct(b, 'Intangible assets, accumulated amortization').id], -1000);
    assert.equal(mov[findAcct(b, 'Intangible assets, at cost').id], 12000);
    assert.equal(bsDrift(b), 0);
  });
});

describe('investments', () => {
  const rec = { id: 1, name: 'Fund A', qty: 100, cost: 5000, marketPrice: 60 };

  test('market value is quantity × market price', () => assert.equal(investMarketValue(rec), 6000));
  test('an explicit market value wins', () =>
    assert.equal(investMarketValue({ qty: 100, marketPrice: 60, marketValue: 5500 }), 5500));

  test('the gain is market value less cost', () => {
    const b = makeBiz({ investments: [rec] });
    assert.equal(investCost(b, rec), 5000);
    assert.equal(investGain(b, rec), 1000);
  });

  test('with no market price there is no revaluation', () => {
    const b = makeBiz({ investments: [{ id: 1, name: 'Fund A', qty: 100, cost: 5000 }] });
    assert.equal(investGain(b, b.records.investments[0]), 0);
  });

  test('cost and revaluation both post, and the sheet stays in balance', () => {
    const b = makeBiz({ investments: [rec] });
    ensureAllControls(b);
    const mov = accountMovements(b);
    assert.equal(mov[findAcct(b, 'Investments').id], 6000);              // 5000 cost + 1000 gain
    assert.equal(mov[findAcct(b, 'Investment gains (losses)').id], 1000);
    assert.equal(bsDrift(b), 0);
  });
});

describe('all of it together', () => {
  test('one business carrying every new record type still balances', () => {
    const b = makeBiz({
      customers: [{ id: 1, name: 'Acme', balance: 0 }],
      inventory: [{ id: 2, name: 'Glass sheet', qty: 100, openingCost: 1000 },
                  { id: 3, name: 'Tempered panel', qty: 0, openingCost: 0 }],
      salesInv: [{ id: 4, customer: 'Acme', total: 5000, lines: [{ net: 5000 }] }],
      whtReceipts: [{ id: 5, date: '2026-03-01', customer: 'Acme', amount: 500 }],
      billableTime: [{ id: 6, customer: 'Acme', hours: 10, rate: 100, status: 'Uninvoiced' }],
      invWriteOffs: [{ id: 7, date: '2026-03-02', lines: [{ item: 'Glass sheet', qty: 5 }] }],
      production: [{ id: 8, date: '2026-03-03', item: 'Tempered panel', qty: 4, extraCost: 40,
                     lines: [{ item: 'Glass sheet', qty: 4 }] }],
      invTransfers: [{ id: 9, date: '2026-03-04', fromLocation: 'Main', toLocation: 'Site A',
                       lines: [{ item: 'Glass sheet', qty: 10 }] }],
      intangibles: [{ id: 10, name: 'Trademark', cost: 12000, accumAmort: 0 }],
      amortization: [{ id: 11, date: '2026-03-31', lines: [{ asset: 'Trademark', amount: 1000 }] }],
      investments: [{ id: 12, name: 'Fund A', qty: 100, cost: 5000, marketPrice: 60 }],
    });
    const exp = findAcct(b, 'General expenses');
    b.records.expenseClaims = [{ id: 13, date: '2026-03-05', payer: 'Wasif', lines: [{ account: exp.id, amount: 250 }] }];
    ensureAllControls(b);
    assert.equal(bsDrift(b), 0);
  });
});

describe('entry forms', () => {
  /* Every register's data-entry form is generated from FED.starter(key). A key
     with no STARTERS entry falls back to the empty 'custom' starter and the
     user gets a form with no fields on it — which is what Bank Reconciliations
     and Special Accounts used to do. */
  const src = readFileSync(new URL('../js/form-editor-embedded.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('const STARTERS'), src.indexOf('\n};', src.indexOf('const STARTERS')));
  const starters = [...block.matchAll(/^\s{2}([A-Za-z]+):\s*\{/gm)].map(m => m[1]);

  test('every register has a starter form', () => {
    const missing = Object.keys(REG).filter(k => !starters.includes(k));
    assert.deepEqual([...missing], []);
  });

  test('the standalone editor carries the same starters', () => {
    const other = readFileSync(new URL('../js/form-editor.js', import.meta.url), 'utf8');
    const ob = other.slice(other.indexOf('const STARTERS'), other.indexOf('\n};', other.indexOf('const STARTERS')));
    const oks = [...ob.matchAll(/^\s{2}([A-Za-z]+):\s*\{/gm)].map(m => m[1]);
    assert.deepEqual([...starters.filter(k => !oks.includes(k))], []);
  });

  test('every register is offered in the form designer’s document list', () => {
    const docs = [...src.matchAll(/\{k:'([A-Za-z]+)',l:'/g)].map(m => m[1]);
    const missing = Object.keys(REG).filter(k => !docs.includes(k));
    assert.deepEqual([...missing], []);
  });
});
