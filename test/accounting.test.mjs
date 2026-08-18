import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './_harness.mjs';

const ctx = loadApp();
const { bankMatch, bankActual, cashTotal, currencyForCountry, defaultTaxCodes,
        customerBalance, supplierBalance, acctRoot, acctNature, findAcct,
        ensureCoa, ensureSettings, summaryFromCoa, demoBusiness } = ctx;

/** A business with two bank accounts and nothing else. */
const bizWithBanks = (records = {}) => ({
  id: 1, name: 'Test Co', records: {
    bankCash: [
      { id: 1, name: 'ADCB', balance: 1000 },
      { id: 2, name: 'Cash Account', balance: 500 },
    ],
    ...records,
  },
});

describe('bankMatch', () => {
  const rec = { name: 'ADCB' };
  test('matches an exact name', () => assert.equal(bankMatch('ADCB', rec), true));
  test('matches the "Account - Subaccount" form the forms produce', () =>
    assert.equal(bankMatch('ADCB - ADCB', rec), true));
  test('does not match a different account', () =>
    assert.equal(bankMatch('HBZ - HBZ', rec), false));
  test('is not fooled by a name that merely starts the same', () =>
    assert.equal(bankMatch('ADCB2 - x', rec), false));
  test('an empty reference matches nothing', () =>
    assert.equal(bankMatch('', rec), false));
});

describe('bankActual', () => {
  test('with no transactions it is just the opening balance', () => {
    const b = bizWithBanks();
    assert.equal(bankActual(b, b.records.bankCash[0]), 1000);
  });

  test('receipts increase the balance', () => {
    const b = bizWithBanks({ receipts: [{ receivedIn: 'ADCB - ADCB', amount: 250 }] });
    assert.equal(bankActual(b, b.records.bankCash[0]), 1250);
  });

  test('payments decrease it', () => {
    const b = bizWithBanks({ payments: [{ paidFrom: 'ADCB', amount: 300 }] });
    assert.equal(bankActual(b, b.records.bankCash[0]), 700);
  });

  test('a transfer moves money between two accounts', () => {
    const b = bizWithBanks({ iat: [{ paidFrom: 'ADCB', receivedIn: 'Cash Account', amount: 400 }] });
    assert.equal(bankActual(b, b.records.bankCash[0]), 600);
    assert.equal(bankActual(b, b.records.bankCash[1]), 900);
    assert.equal(cashTotal(b), 1500, 'a transfer must not change the total');
  });

  test('transactions belonging to another account are ignored', () => {
    const b = bizWithBanks({ receipts: [{ receivedIn: 'HBZ', amount: 999 }] });
    assert.equal(bankActual(b, b.records.bankCash[0]), 1000);
  });

  test('non-numeric amounts are treated as zero, not NaN', () => {
    const b = bizWithBanks({ receipts: [{ receivedIn: 'ADCB', amount: '' }, { receivedIn: 'ADCB', amount: null }] });
    assert.equal(bankActual(b, b.records.bankCash[0]), 1000);
  });

  test('negative balances are preserved', () => {
    const b = bizWithBanks();
    b.records.bankCash[0].balance = -250;
    assert.equal(bankActual(b, b.records.bankCash[0]), -250);
  });
});

describe('cashTotal', () => {
  test('sums every bank and cash account', () => {
    assert.equal(cashTotal(bizWithBanks()), 1500);
  });
  test('is zero for a business with no accounts', () => {
    assert.equal(cashTotal({ records: {} }), 0);
  });
  test('tolerates a business with no records at all', () => {
    assert.equal(cashTotal({}), 0);
  });
});

describe('customerBalance / supplierBalance', () => {
  const b = {
    records: {
      customers: [{ name: 'Acme', balance: 100 }],
      suppliers: [{ name: 'Gulf', balance: 50 }],
      salesInv: [{ customer: 'Acme', total: 300 }],
      purchInv: [{ supplier: 'Gulf', total: 200 }],
    },
  };
  test('a sales invoice increases what the customer owes', () => {
    assert.equal(customerBalance(b, 'Acme'), 400);
  });
  test('a purchase invoice increases what is owed to the supplier', () => {
    assert.equal(supplierBalance(b, 'Gulf'), 250);
  });
  test('an unknown party has no balance rather than NaN', () => {
    assert.equal(customerBalance(b, 'Nobody'), 0);
  });
});

describe('currencyForCountry', () => {
  test('maps known countries', () => {
    assert.equal(currencyForCountry('United Arab Emirates'), 'AED');
    assert.equal(currencyForCountry('United Kingdom'), 'GBP');
  });
  test('falls back to AED for anything unknown', () => {
    assert.equal(currencyForCountry('Atlantis'), 'AED');
    assert.equal(currencyForCountry(undefined), 'AED');
  });
});

describe('defaultTaxCodes', () => {
  test('includes a standard-rated and a zero-rated code', () => {
    const codes = defaultTaxCodes();
    assert.ok(codes.some((c) => c.rate === 5));
    assert.ok(codes.some((c) => c.rate === 0));
  });
});

describe('chart of accounts', () => {
  const b = demoBusiness();
  ensureSettings(b);
  ensureCoa(b);

  test('ensureCoa builds a chart', () => {
    assert.ok(Array.isArray(b.coa) && b.coa.length > 0);
  });

  test('acctRoot walks up to a statement section', () => {
    const ar = findAcct(b, 'Accounts receivable');
    assert.ok(ar, 'demo chart should contain Accounts receivable');
    assert.equal(acctRoot(b, ar), 'assets');
  });

  test('assets are debit-natured, liabilities credit-natured', () => {
    assert.equal(acctNature(b, findAcct(b, 'Accounts receivable')), 'D');
    const ap = findAcct(b, 'Accounts payable');
    if (ap) assert.equal(acctNature(b, ap), 'C');
  });

  test('ensureCoa is idempotent', () => {
    const before = b.coa.length;
    ensureCoa(b);
    assert.equal(b.coa.length, before, 'running it twice must not duplicate accounts');
  });

  test('summaryFromCoa returns the three balance-sheet sections', () => {
    const s = summaryFromCoa(b);
    // spread into a host array: values built inside the vm have that realm's
    // Array prototype, which deepStrictEqual treats as a mismatch
    assert.deepEqual([...s.balanceSheet.map((x) => x.title)], ['Assets', 'Liabilities', 'Equity']);
  });

  test('the balance sheet balances: assets = liabilities + equity', () => {
    const s = summaryFromCoa(b);
    const get = (t) => s.balanceSheet.find((x) => x.title === t)?.total ?? 0;
    assert.ok(
      Math.abs(get('Assets') - (get('Liabilities') + get('Equity'))) < 0.01,
      `assets ${get('Assets')} != liabilities ${get('Liabilities')} + equity ${get('Equity')}`
    );
  });
});

describe('ensureSettings', () => {
  test('fills in currency, formats and tax codes', () => {
    const b = { id: 9, name: 'X', country: 'United Kingdom' };
    ensureSettings(b);
    assert.equal(b.baseCurrency, 'GBP');
    assert.ok(b.fmt && b.fmt.date);
    assert.ok(Array.isArray(b.taxCodes) && b.taxCodes.length);
    assert.equal(b.lockDate, '');
  });

  test('does not overwrite values the user already set', () => {
    const b = { id: 9, name: 'X', country: 'United Kingdom', baseCurrency: 'USD', lockDate: '2026-01-01' };
    ensureSettings(b);
    assert.equal(b.baseCurrency, 'USD');
    assert.equal(b.lockDate, '2026-01-01');
  });
});
