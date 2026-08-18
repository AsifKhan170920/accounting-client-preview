import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mapRecordToInvoiceData, resolvePlaceholder, sampleInvoiceData, placeholderLabel } from '../src/tokens';

const biz = {
  name: 'Abbass Tempering Industry LLC',
  currency: 'AED',
  details: {
    legalName: 'Abbass Tempering Industry LLC',
    address: 'Industrial 12\nSharjah, UAE',
    taxNumber: '100311223300003',
  },
  records: {
    customers: [{ name: 'MIRDIF ALUMINIUM & GLASS', address: 'Warehouse 7, Dubai', trn: 'C-TRN-1' }],
    suppliers: [{ name: 'Gulf Glass Suppliers LLC', address: 'Jebel Ali, Dubai', trn: 'S-TRN-1' }],
  },
};

describe('resolvePlaceholder', () => {
  const data = sampleInvoiceData();

  test('returns the mapped value', () => {
    assert.equal(resolvePlaceholder('company_name', data), 'Acme Trading LLC');
  });

  test('returns empty string for an unknown key', () => {
    assert.equal(resolvePlaceholder('no_such_token', data), '');
  });

  test('items_table resolves to empty - it is rendered as a table, not text', () => {
    assert.equal(resolvePlaceholder('items_table', data), '');
  });

  test('never leaks an object into the page', () => {
    assert.equal(resolvePlaceholder('items', data), '');
  });
});

describe('placeholderLabel', () => {
  test('wraps the key in the mustache form shown in the UI', () => {
    assert.equal(placeholderLabel('invoice_number'), '{{invoice_number}}');
  });
});

describe('mapRecordToInvoiceData', () => {
  test('maps a sales record against the customer list', () => {
    const d = mapRecordToInvoiceData(biz, {
      customer: 'MIRDIF ALUMINIUM & GLASS',
      reference: 'SINV-0007',
      issueDate: '2026-03-15',
      total: 1050,
    });
    assert.equal(d.customer_name, 'MIRDIF ALUMINIUM & GLASS');
    assert.equal(d.customer_address, 'Warehouse 7, Dubai', 'address pulled from the customer record');
    assert.equal(d.customer_trn, 'C-TRN-1');
    assert.equal(d.invoice_number, 'SINV-0007');
    assert.equal(d.company_name, 'Abbass Tempering Industry LLC');
  });

  test('isPurchase looks the party up in suppliers instead', () => {
    const d = mapRecordToInvoiceData(
      biz,
      { supplier: 'Gulf Glass Suppliers LLC', reference: 'PINV-1', total: 500 },
      { isPurchase: true }
    );
    assert.equal(d.customer_name, 'Gulf Glass Suppliers LLC');
    assert.equal(d.customer_trn, 'S-TRN-1', 'supplier TRN, not a customer one');
  });

  test('a record-level billing address wins over the party record', () => {
    const d = mapRecordToInvoiceData(biz, {
      customer: 'MIRDIF ALUMINIUM & GLASS',
      billingAddress: 'Override Street 1',
    });
    assert.equal(d.customer_address, 'Override Street 1');
  });

  test('formats ISO dates as MM/DD/YYYY', () => {
    const d = mapRecordToInvoiceData(biz, { issueDate: '2026-03-15', dueDate: '2026-04-14' });
    assert.equal(d.invoice_date, '03/15/2026');
    assert.equal(d.due_date, '04/14/2026');
  });

  test('falls back to `date` when there is no issueDate', () => {
    assert.equal(mapRecordToInvoiceData(biz, { date: '2025-05-31' }).invoice_date, '05/31/2025');
  });

  test('formats money to two decimals', () => {
    const d = mapRecordToInvoiceData(biz, { total: 7770, subtotal: 7400, tax: 370 });
    assert.equal(d.grand_total, '7,770.00');
    assert.equal(d.subtotal, '7,400.00');
    assert.equal(d.tax, '370.00');
  });

  test('maps line items, tolerating missing fields', () => {
    const d = mapRecordToInvoiceData(biz, {
      lines: [{ item: 'Glass panel', qty: 2, price: 100, amount: 200 }, {}],
    });
    assert.equal(d.items.length, 2);
    assert.equal(d.items[0].item, 'Glass panel');
    assert.equal(d.items[1].item, '', 'an empty line must not produce "undefined"');
  });

  test('an unknown party still renders, just without looked-up details', () => {
    const d = mapRecordToInvoiceData(biz, { customer: 'Nobody Ltd' });
    assert.equal(d.customer_name, 'Nobody Ltd');
    assert.equal(d.customer_address, '');
    assert.equal(d.customer_trn, '');
  });

  test('an empty record produces no "undefined" strings anywhere', () => {
    const d = mapRecordToInvoiceData({}, {});
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === 'string') assert.ok(!v.includes('undefined'), `${k} leaked "undefined"`);
    }
  });

  test('uses the supplied amountInWords hook', () => {
    const d = mapRecordToInvoiceData(biz, { total: 42 }, { amountInWords: (n, cur) => `${n} ${cur} only` });
    assert.equal(d.amount_in_words, '42 AED only');
  });
});
