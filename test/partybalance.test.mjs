/* The party balance badge on the Receipt / Payment form (js/party-balance.js).

   The badge does no accounting of its own — it calls the engine's existing
   balance functions. What is pinned here is that it calls the right one for the
   party type, agrees with them to the cent, and shows nothing when there is no
   party. The DOM half is driven against a real document elsewhere. */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadApp } from './_harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let ctx, App, PB, b;

function seed(ctx) {
  const biz = {
    id: 1, name: 'PB Co', baseCurrency: 'AED',
    records: {
      bankCash: [{ id: 300, name: 'ADCB', balance: 0 }],
      customers: [{ id: 100, name: 'ABC Customer', balance: 0 }],
      suppliers: [{ id: 200, name: 'ABC Supplier', balance: 0 }],
      employees: [{ id: 400, name: 'Jane Smith' }],
      capital: [{ id: 500, name: 'Partner A', balance: 40000 }],
      salesInv: [{ id: 11, uuid: 'iv-1', reference: 'INV-001', issueDate: '2026-09-01',
        customer: 'ABC Customer', subtotal: 125000, tax: 0, total: 125000, balanceDue: 125000, lines: [] }],
      purchInv: [{ id: 21, uuid: 'bl-1', reference: 'BILL-1', issueDate: '2026-09-01',
        supplier: 'ABC Supplier', subtotal: 75000, tax: 0, total: 75000, balanceDue: 75000, lines: [] }],
      receipts: [], payments: [], payslips: [],
    },
  };
  ctx.ensureSettings(biz);
  ctx.ensureCoa(biz);
  ctx.ensureControl(biz, 'Accounts receivable', 'assets');
  ctx.ensureControl(biz, 'Accounts payable', 'liabilities');
  ctx.ensureAllControls(biz);
  ctx.refreshSummary(biz);
  return biz;
}

const acct = (name) => b.coa.find((n) => new RegExp('^' + name + '$', 'i').test(n.name || '')).id;

/** Post a receipt or payment with one AR/AP line. */
function cash(kind, control, party, amount) {
  b.records[kind].push({ id: Date.now() + Math.floor(Math.random() * 1e6), uuid: 'doc' + b.records[kind].length,
    date: '2026-09-10', amount, lines: [{ account: acct(control), sub: party, amount }] });
  ctx.refreshSummary(b);
}

beforeEach(() => {
  ctx = loadApp();
  App = ctx.App;
  b = seed(ctx);
  App.openBiz = b.id;
  App.curBiz = () => b;
  vm.runInContext(readFileSync(join(ROOT, 'js/party-balance.js'), 'utf8'), ctx, { filename: 'party-balance.js' });
  PB = ctx.PartyBalance;
});

describe('it reuses the engine, it does not recalculate', () => {
  test('a customer reads customerBalance()', () => {
    assert.equal(PB.balanceOf('customer', 'ABC Customer').amount, ctx.customerBalance(b, 'ABC Customer'));
    assert.equal(PB.balanceOf('customer', 'ABC Customer').amount, 125000);
  });

  test('a supplier reads supplierBalance()', () => {
    assert.equal(PB.balanceOf('supplier', 'ABC Supplier').amount, ctx.supplierBalance(b, 'ABC Supplier'));
    assert.equal(PB.balanceOf('supplier', 'ABC Supplier').amount, 75000);
  });

  test('employees and capital accounts read their own ledgers', () => {
    assert.equal(PB.balanceOf('employee', 'Jane Smith').amount, ctx.employeeBalance(b, 'Jane Smith'));
    assert.equal(PB.balanceOf('capital', 'Partner A').amount, ctx.capitalBalance(b, 'Partner A'));
  });

  test('it never invents a party type it does not have a ledger for', () => {
    for (const kind of ['other', 'item', 'bank', '', null, undefined]) {
      assert.equal(PB.supports(kind), false, String(kind));
      assert.equal(PB.balanceOf(kind, 'ABC Customer'), null, String(kind));
    }
  });
});

describe('the wording follows the party type and the sign', () => {
  test('a customer owes: Outstanding', () => {
    assert.equal(PB.balanceOf('customer', 'ABC Customer').label, 'Outstanding');
  });

  test('a supplier is owed: Payable', () => {
    assert.equal(PB.balanceOf('supplier', 'ABC Supplier').label, 'Payable');
  });

  test('an overpaid customer reads Credit, not a negative Outstanding', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 150000);
    const bal = PB.balanceOf('customer', 'ABC Customer');
    assert.equal(bal.amount, -25000);
    assert.equal(bal.label, 'Credit');
  });

  test('a supplier paid in advance reads Prepaid', () => {
    cash('payments', 'Accounts payable', 'ABC Supplier', 90000);
    assert.equal(PB.balanceOf('supplier', 'ABC Supplier').label, 'Prepaid');
  });
});

describe('nothing selected, nothing shown', () => {
  test('a blank or whitespace name has no balance', () => {
    assert.equal(PB.balanceOf('customer', ''), null);
    assert.equal(PB.balanceOf('customer', '   '), null);
    assert.equal(PB.balanceOf('customer', null), null);
  });

  test('a party that does not exist reads zero rather than throwing', () => {
    const bal = PB.balanceOf('customer', 'Nobody Ltd');
    assert.equal(bal.amount, 0);
  });
});

describe('it tracks the ledger as documents are posted', () => {
  test('a receipt drops what the customer owes', () => {
    assert.equal(PB.balanceOf('customer', 'ABC Customer').amount, 125000);
    cash('receipts', 'Accounts receivable', 'ABC Customer', 25000);
    assert.equal(PB.balanceOf('customer', 'ABC Customer').amount, 100000);
  });

  test('a payment drops what is owed to the supplier', () => {
    cash('payments', 'Accounts payable', 'ABC Supplier', 30000);
    assert.equal(PB.balanceOf('supplier', 'ABC Supplier').amount, 45000);
  });

  test('allocating a receipt to invoices does not move the party total', () => {
    cash('receipts', 'Accounts receivable', 'ABC Customer', 25000);
    const before = PB.balanceOf('customer', 'ABC Customer').amount;
    b.records.receipts[0].allocations = [{ key: 'salesInv', uid: 'iv-1', party: 'ABC Customer', amount: 25000 }];
    ctx.refreshSummary(b);
    assert.equal(PB.balanceOf('customer', 'ABC Customer').amount, before,
      'allocation moves money between invoices inside the same total');
    assert.equal(b.records.salesInv[0].balanceDue, 100000, 'the invoice balance does move');
  });

  test('one party\'s document leaves another party alone', () => {
    b.records.customers.push({ id: 101, name: 'Zenith Glass', balance: 0 });
    cash('receipts', 'Accounts receivable', 'ABC Customer', 25000);
    assert.equal(PB.balanceOf('customer', 'Zenith Glass').amount, 0);
  });
});
