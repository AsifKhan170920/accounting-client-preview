/* The Settings screens added for Manager.io parity, and the behaviour they
   drive elsewhere in the app — a tile that saves a value but changes nothing
   is the failure mode worth guarding against. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_harness.mjs';

const ctx = loadApp();
const { App, DB, SIDEBAR, ensureCoa, ensureSettings, ensureAllControls, refreshSummary,
        findAcct, accountMovements, customerBalance, arMovement,
        lateFeeFor, lateFeesTotal, kitComponents, kitCostOf, invItemStats } = ctx;

function makeBiz(extra = {}) {
  const b = Object.assign({
    id: 1, name: 'Test Co', country: 'United Arab Emirates',
    balanceSheet: [
      { title: 'Assets', total: 0, children: [{ name: 'Accounts receivable', amt: 0 }, { name: 'Cash & cash equivalents', amt: 0 }] },
      { title: 'Liabilities', total: 0, children: [{ name: 'Accounts payable', amt: 0 }] },
      { title: 'Equity', total: 0, children: [{ name: 'Retained earnings', amt: 0 }] },
    ],
    profitLoss: [
      { title: 'Income', children: [{ name: 'Sales', amt: 0 }, { name: 'Late payment fees', amt: 0 }] },
      { title: 'Expenses', children: [{ name: 'General expenses', amt: 0 }] },
    ],
    records: {},
  }, extra);
  ensureSettings(b); ensureCoa(b); ensureAllControls(b);
  return b;
}

describe('settings tiles', () => {
  test('every tile has a handler and a description', () => {
    for (const t of App.setTiles()) {
      const [ico, name, key, desc] = t;
      assert.ok(ico, `${name} has no icon`);
      assert.ok(desc && desc.length > 5, `${name} has no description`);
      assert.equal(typeof App['set_' + key], 'function', `${name} has no set_${key}()`);
    }
  });

  test('the tiles Manager.io has that were missing are all present', () => {
    const want = ['projects', 'formDefaults', 'recurring', 'starting', 'customFields', 'customReports',
                  'locations', 'kits', 'claimPayers', 'lateFees', 'bankRules', 'permissions',
                  'attachments', 'obsolete', 'extensions'];
    const have = App.setTiles().map(t => t[2]);
    assert.deepEqual([...want.filter(k => !have.includes(k))], []);
  });

  test('every settings screen renders', () => {
    const b = makeBiz();
    App.openBiz = b.id; App.curBiz = () => b;
    for (const t of App.setTiles()) {
      App.setView = t[2];
      const html = App['set_' + t[2]](b);
      assert.equal(typeof html, 'string');
      assert.ok(html.length > 50, `${t[1]} rendered almost nothing`);
    }
    App.setView = null;
  });
});

describe('form defaults', () => {
  test('a default description and due-days reach a new document', () => {
    const b = makeBiz({ formDefaults: { salesInv: { description: 'Monthly retainer', dueDays: 30 } } });
    const pf = App.applyFormDefaults(b, 'salesInv', null);
    assert.equal(pf.description, 'Monthly retainer');
    assert.equal(pf.dueDays, 30);
    assert.equal(pf.dueType, 'Net');
  });

  test('a value already on the document wins over the default', () => {
    const b = makeBiz({ formDefaults: { salesInv: { description: 'Monthly retainer' } } });
    const pf = App.applyFormDefaults(b, 'salesInv', { description: 'One-off job' });
    assert.equal(pf.description, 'One-off job');
  });

  test('a division default resolves to the division id', () => {
    const b = makeBiz({ divisions: [{ id: 'd1', name: 'North' }], formDefaults: { salesInv: { division: 'North' } } });
    assert.equal(App.applyFormDefaults(b, 'salesInv', null).division, 'd1');
  });

  test('no defaults set changes nothing', () => {
    const b = makeBiz();
    assert.deepEqual([...Object.keys(App.applyFormDefaults(b, 'salesInv', null))], []);
  });
});

describe('bank rules', () => {
  const b = makeBiz({ bankRules: [{ match: 'SHELL', account: 'a-fuel' }, { match: 'rent', account: 'a-rent' }] });

  test('a rule matches anywhere in the line, case-insensitively', () => {
    assert.equal(App.bankRuleAccount(b, 'POS PURCHASE shell station 44'), 'a-fuel');
    assert.equal(App.bankRuleAccount(b, 'MONTHLY RENT DD'), 'a-rent');
  });
  test('an unmatched line is left uncoded', () =>
    assert.equal(App.bankRuleAccount(b, 'ATM WITHDRAWAL'), ''));
  test('the first matching rule wins', () => {
    const b2 = makeBiz({ bankRules: [{ match: 'a', account: 'first' }, { match: 'ab', account: 'second' }] });
    assert.equal(App.bankRuleAccount(b2, 'abc'), 'first');
  });
});

describe('bank statement CSV parsing', () => {
  test('quoted fields containing commas stay in one cell', () => {
    const rows = App._csvRows('date,description,amount\n2026-03-01,"Acme, Ltd",100\n');
    assert.equal(rows.length, 2);
    assert.deepEqual([...rows[1]], ['2026-03-01', 'Acme, Ltd', '100']);
  });
  test('a doubled quote is an escaped quote', () => {
    const rows = App._csvRows('a\n"say ""hi"""\n');
    assert.equal(rows[1][0], 'say "hi"');
  });
  test('blank lines are dropped', () =>
    assert.equal(App._csvRows('a,b\n1,2\n\n\n3,4\n').length, 3));
  test('column headers are found by partial, case-insensitive match', () => {
    const head = ['Txn Date', 'Narrative', 'Debit Amt', 'Credit Amt'];
    assert.equal(App._csvPick(head, ['date']), 0);
    assert.equal(App._csvPick(head, ['description', 'narrative']), 1);
    assert.equal(App._csvPick(head, ['nothing']), -1);
  });
  test('dates come back as ISO whichever way the bank wrote them', () => {
    assert.equal(App._normDate('2026-03-01'), '2026-03-01');
    assert.equal(App._normDate('01/03/2026'), '2026-03-01');
    assert.equal(App._normDate('1-3-26'), '2026-03-01');
    assert.equal(App._normDate(''), '');
  });
});

describe('inventory kits', () => {
  const biz = () => makeBiz({
    inventoryKits: [{ id: 'k1', name: 'Window kit', salesPrice: 500, items: [{ item: 'Glass sheet', qty: 2 }, { item: 'Frame', qty: 1 }] }],
    records: {
      inventory: [{ id: 1, name: 'Glass sheet', qty: 100, openingCost: 1000 },   // 10 each
                  { id: 2, name: 'Frame', qty: 50, openingCost: 1000 }],          // 20 each
      salesInv: [{ id: 3, issueDate: '2026-03-01', customer: 'Acme', total: 1000,
                   lines: [{ item: 'Window kit', qty: 3, price: 500, net: 1500 }] }],
    },
  });

  test('a kit resolves to its components', () => {
    const b = biz();
    assert.equal(kitComponents(b, 'Window kit').length, 2);
    assert.equal(kitComponents(b, 'Glass sheet'), null);
  });

  test('kit cost is the sum of its components at average cost', () =>
    assert.equal(kitCostOf(biz(), 'Window kit'), 40));   // 2×10 + 1×20

  test('selling a kit draws each component down by its quantity', () => {
    const b = biz();
    assert.equal(invItemStats(b, b.records.inventory[0]).qtyOnHand, 94);   // 100 − 3×2
    assert.equal(invItemStats(b, b.records.inventory[1]).qtyOnHand, 47);   // 50 − 3×1
  });
});

describe('late payment fees', () => {
  const invoice = { id: 1, customer: 'Acme', issueDate: '2026-01-01', dueDate: '2026-01-31',
                    total: 1000, balanceDue: 1000, lateFees: true };
  const withCfg = (cfg, inv) => makeBiz({
    lateFees: cfg,
    records: { customers: [{ id: 9, name: 'Acme', balance: 0 }], salesInv: [inv || invoice] },
  });

  test('nothing is charged while the feature is off', () =>
    assert.equal(lateFeeFor(withCfg({ enabled: false, rate: 1.5 }), invoice, '2026-03-02'), 0));

  test('nothing is charged on an invoice that did not opt in', () => {
    const inv = Object.assign({}, invoice, { lateFees: false });
    assert.equal(lateFeeFor(withCfg({ enabled: true, rate: 1.5, period: 'month' }, inv), inv, '2026-03-02'), 0);
  });

  test('nothing is charged before the due date', () =>
    assert.equal(lateFeeFor(withCfg({ enabled: true, rate: 1.5, period: 'month' }), invoice, '2026-01-15'), 0));

  test('a monthly rate accrues per 30 days overdue', () => {
    const b = withCfg({ enabled: true, rate: 1.5, period: 'month' });
    assert.equal(lateFeeFor(b, invoice, '2026-03-02'), 15);       // 30 days × 1.5% of 1000
  });

  test('the grace period pushes the start back', () => {
    const b = withCfg({ enabled: true, rate: 1.5, period: 'month', grace: 30 });
    assert.equal(lateFeeFor(b, invoice, '2026-03-02'), 0);
  });

  test('a one-off charge does not scale with time', () => {
    const b = withCfg({ enabled: true, rate: 5, period: 'once' });
    assert.equal(lateFeeFor(b, invoice, '2026-03-02'), 50);
    assert.equal(lateFeeFor(b, invoice, '2026-12-02'), 50);
  });

  test('a settled invoice stops accruing', () => {
    const inv = Object.assign({}, invoice, { balanceDue: 0 });
    assert.equal(lateFeeFor(withCfg({ enabled: true, rate: 1.5, period: 'month' }, inv), inv, '2026-03-02'), 0);
  });

  test('the fee raises the receivable and the income account it is booked to', () => {
    const b = withCfg({ enabled: true, rate: 5, period: 'once' });
    b.lateFees.account = findAcct(b, 'Late payment fees').id;
    ensureAllControls(b);
    assert.equal(lateFeesTotal(b), 50);
    const mov = accountMovements(b);
    assert.equal(mov[b.lateFees.account], 50);
    /* AR carries the fee too, so the sheet stays in balance. */
    assert.ok(arMovement(b) >= 50);
  });
});

describe('user permissions', () => {
  const users = [{ id: 1, name: 'Admin', user: 'admin' }, { id: 2, name: 'Clerk', user: 'clerk' }];

  test('with no permissions set, nobody is restricted', () => {
    const b = makeBiz();
    App.current = { name: 'Clerk', user: 'clerk' };
    assert.equal(App.myPermissions(b), null);
    assert.equal(App.isReadOnly(b), false);
    assert.equal(App.isHidden(b, 'Sales Invoices'), false);
  });

  test('a restricted user loses the tabs that were unticked', () => {
    const b = makeBiz({ permissions: { clerk: { role: 'Restricted', hidden: ['Sales Invoices', 'Journal Entries'] } } });
    App.current = { name: 'Clerk', user: 'clerk' };
    assert.equal(App.isHidden(b, 'Sales Invoices'), true);
    assert.equal(App.isHidden(b, 'Receipts'), false);
    assert.equal(App.isHidden(b, 'Summary'), false, 'Summary is never hidden');
  });

  test('another user is unaffected by someone else’s restriction', () => {
    const b = makeBiz({ permissions: { clerk: { role: 'Restricted', hidden: ['Sales Invoices'] } } });
    App.current = { name: 'Admin', user: 'admin' };
    assert.equal(App.isHidden(b, 'Sales Invoices'), false);
  });

  test('read only blocks writing but not viewing', () => {
    const b = makeBiz({ permissions: { clerk: { role: 'Read only' } } });
    App.current = { name: 'Clerk', user: 'clerk' };
    assert.equal(App.isReadOnly(b), true);
    assert.equal(App.guardWrite(b), false);
    assert.equal(App.isHidden(b, 'Sales Invoices'), false);
    App.current = { name: 'Admin', user: 'admin' };
    assert.equal(App.guardWrite(b), true);
  });
});

describe('recurring transactions', () => {
  test('the next due date rolls forward by the chosen interval', () => {
    assert.equal(App._recurAdvance('2026-03-01', 'Weekly'), '2026-03-08');
    assert.equal(App._recurAdvance('2026-03-01', 'Fortnightly'), '2026-03-15');
    assert.equal(App._recurAdvance('2026-03-01', 'Monthly'), '2026-04-01');
    assert.equal(App._recurAdvance('2026-03-01', 'Quarterly'), '2026-06-01');
    assert.equal(App._recurAdvance('2026-03-01', 'Yearly'), '2027-03-01');
  });
  test('an empty date stays empty', () => assert.equal(App._recurAdvance('', 'Monthly'), ''));
});

describe('date arithmetic', () => {
  /* These run through toISOString(), so parsing a 'YYYY-MM-DD' string as local
     time silently loses a day anywhere east of Greenwich. The harness runs in
     whatever zone the machine is set to, so this is a real regression guard. */
  test('the day before a date is the day before it, in any timezone', () => {
    assert.equal(App._dayBefore('2026-01-01'), '2025-12-31');
    assert.equal(App._dayBefore('2026-03-01'), '2026-02-28');
    assert.equal(App._dayBefore('2024-03-01'), '2024-02-29', 'leap year');
    assert.equal(App._dayBefore(''), null);
  });

  test('_isoShift moves by days, months and years without drifting', () => {
    assert.equal(App._isoShift('2026-01-31', 1), '2026-02-01');
    assert.equal(App._isoShift('2026-12-31', 0, 1), '2027-01-31');
    assert.equal(App._isoShift('2026-02-28', 0, 0, 1), '2027-02-28');
    assert.equal(App._isoShift('not a date', 1), '');
  });

  test('ageing counts whole days between two dates', () => {
    assert.equal(App._ageDays('2026-03-31', '2026-03-01'), 30);
    assert.equal(App._ageDays('2026-03-01', '2026-03-01'), 0);
    assert.equal(App._ageDays('2026-03-01', '2026-03-31'), -30);
  });
});
