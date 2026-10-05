/* The Settings framework (js/settings-pages.js): every page renders, list and
   single-record pages save and read back, and the pages that sit on data the
   rest of the app already reads (tax codes, currencies, lock date, chart of
   accounts, bank rules, form defaults, email templates) keep that data in the
   shape its readers expect. */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadAppWithDemo } from './_harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let ctx, App, SP;
beforeEach(() => {
  ({ ctx } = loadAppWithDemo());
  App = ctx.App;
  vm.runInContext(readFileSync(join(ROOT, 'js/settings-pages.js'), 'utf8'), ctx, { filename: 'settings-pages.js' });
  SP = ctx.SettingsPages;
  ctx.confirm = () => true;
});
/* App.curBiz() re-reads storage, so always go through it. */
const cur = () => App.curBiz();
const render = (key, sub = '', action = null, id = null) => {
  App.setView = key; App.spRoute = { key, sub, action, id: id == null ? null : String(id) };
  return App['set_' + key](cur());
};
const save = (path, v, id) => { const r = SP.save(path, v, id); assert.ok(r.ok, r.error); return r.record; };

describe('rendering', () => {
  test('every page, sub-page and new-record form renders', () => {
    const paths = SP.paths();
    assert.ok(paths.length > 60, 'the whole tree is registered');
    for (const p of paths) {
      if (p.kind === 'link') continue;
      const html = render(p.key, p.sub);
      assert.equal(typeof html, 'string', `${p.key}/${p.sub}`);
      assert.ok(html.length > 50, `${p.key}/${p.sub} rendered almost nothing`);
      assert.ok(html.indexOf('has no editor registered') < 0, `${p.key}/${p.sub} fell through`);
      if (p.kind === 'list') {
        const nw = render(p.key, p.sub, 'new');
        assert.ok(nw.indexOf('SettingsPages.submit(\'create\')') > 0, `${p.key}/${p.sub} has no Create button`);
      }
    }
  });

  test('every tile key the index links to is drawn by the framework or a kept handler', () => {
    const own = Object.keys(SP.PAGES);
    const kept = ['coa', 'permissions', 'customReports', 'attachments'];
    for (const t of App.setTiles()) assert.ok(own.includes(t[2]) || kept.includes(t[2]), t[2]);
  });

  test('a list shows its search box, record count, Edit columns and Copy to clipboard', () => {
    save('divisions', { name: 'North', code: 'N' });
    const html = render('divisions');
    for (const bit of ['id="spQ"', 'sp-count', 'Edit columns', 'Copy to clipboard', 'New Division', '>North<'])
      assert.ok(html.indexOf(bit) > 0, bit);
  });

  test('the breadcrumb walks Settings > page > sub-page > Edit', () => {
    const html = render('currencies', 'foreign', 'new');
    const crumb = html.slice(0, html.indexOf('</div></div>'));
    assert.ok(/Settings.*Currencies.*Foreign Currencies.*New/.test(crumb.replace(/<[^>]+>/g, '')));
  });

  test('conditional fields start hidden when their condition is false', () => {
    const html = render('tax', '', 'new');
    /* a new code defaults to Custom % / Single rate: the components table is hidden */
    const comp = html.slice(html.indexOf('data-lines="components"') - 400, html.indexOf('data-lines="components"'));
    assert.ok(comp.indexOf('display:none') > 0);
  });

  test('pages the user may not open are left off the index', () => {
    App.setView = null;
    App.canSetting = (b, key) => key !== 'tax' && key !== 'lock';
    const html = App.settingsHtml(cur());
    delete App.canSetting;
    assert.ok(html.indexOf('>Tax Codes<') < 0);
    assert.ok(html.indexOf('>Lock Date<') < 0);
    assert.ok(html.indexOf('>Divisions<') > 0);
  });
});

describe('saving', () => {
  test('a list record is created, read back, updated and deleted', () => {
    const r = save('divisions', { name: 'North', code: 'N' });
    assert.ok(r.id);
    let d = cur().divisions.find(x => x.id === r.id);
    assert.equal(d.name, 'North');
    save('divisions', { name: 'North branch', code: 'NB' }, r.id);
    d = cur().divisions.find(x => x.id === r.id);
    assert.equal(d.name, 'North branch');
    assert.equal(d.code, 'NB');
    assert.ok(render('divisions', '', 'edit', r.id).indexOf('value="North branch"') > 0);
    assert.equal(SP.del('divisions', r.id), true);
    assert.equal(cur().divisions.some(x => x.id === r.id), false);
  });

  test('a required field is enforced', () => {
    const r = SP.save('divisions', { name: '', code: 'X' });
    assert.equal(r.ok, false);
    assert.match(r.error, /Name is required/);
  });

  test('Keyboard Navigation starts on its defaults and saves to b.keyboardNav', () => {
    assert.deepEqual({ ...SP.form('keyboardNav') }, { enter: true, arrows: true, lastToSave: false, autoLine: true, newLine: true });
    save('keyboardNav', { enter: false, arrows: true, lastToSave: true, autoLine: false, newLine: true });
    assert.deepEqual({ ...cur().keyboardNav }, { enter: false, arrows: true, lastToSave: true, autoLine: false, newLine: true });
  });

  test('a new page keeps its data on the business', () => {
    const t = save('accessTokens', { name: 'Reporting tool' });
    assert.match(t.token, /^mgr_[0-9a-f]{48}$/);
    assert.equal(cur().accessTokens[0].name, 'Reporting tool');
    save('withholdingTax', { receivable: true, payable: false });
    assert.equal(cur().withholdingTax.receivable, true);
    save('cashFlowGroups/operating', { name: 'Working capital' });
    assert.equal(cur().cashFlowGroups.operating[0].name, 'Working capital');
  });

  test('seeded lists are seeded once', () => {
    assert.equal(SP.rows('capitalSub').length, 3);
    save('capitalSub', { name: 'Loans from partners' });
    assert.equal(cur().capitalSubaccounts.length, 4);
    assert.equal(SP.rows('payslipItems/earnings').length, 4);
  });

  test('numbers are stored as numbers', () => {
    save('lateFees', { enabled: true, rate: App.parseNum('2.5'), period: 'month', grace: App.parseNum('10'), account: '' });
    const lf = cur().lateFees;
    assert.equal(lf.rate, 2.5);
    assert.equal(lf.grace, 10);
  });
});

describe('data compatibility', () => {
  test('tax codes stay {name, rate} with rate the effective percentage', () => {
    const before = cur().taxCodes.map(t => t.name);
    const rows = SP.rows('tax');
    assert.deepEqual(rows.map(t => t.name), before, 'existing codes listed unchanged');
    const vat = rows.find(t => t.name === 'VAT 5%');
    /* a legacy code opens as Custom % / Single rate */
    assert.ok(render('tax', '', 'edit', vat.id).indexOf('<option value="Custom %" selected>') > 0);

    save('tax', { name: 'GST+PST', label: 'GP', taxRate: 'Custom %', type: 'Multiple rates', rate: '',
      components: [{ name: 'GST', rate: 5, account: '' }, { name: 'PST', rate: 7, account: '' }], account: '', reverse: false });
    save('tax', { name: 'Pass', taxRate: 'Pass-through (100%)', type: 'Single rate', rate: 5 });
    save('tax', { name: 'Zero', taxRate: 'Zero (0%)', type: 'Single rate', rate: 9 });
    const codes = cur().taxCodes;
    assert.equal(codes.find(t => t.name === 'GST+PST').rate, 12);
    assert.equal(codes.find(t => t.name === 'Pass').rate, 100);
    assert.equal(codes.find(t => t.name === 'Zero').rate, 0);
    assert.equal(codes.find(t => t.name === 'VAT 5%').rate, 5);
    /* what the invoice lines read */
    assert.equal(App.taxRate('GST+PST'), 12);
    assert.equal(App.taxRate('VAT 5%'), 5);
  });

  test('editing the single rate of a code changes the rate the app uses', () => {
    const vat = SP.rows('tax').find(t => t.name === 'VAT 5%');
    save('tax', { name: 'VAT 5%', taxRate: 'Custom %', type: 'Single rate', rate: 15 }, vat.id);
    assert.equal(App.taxRate('VAT 5%'), 15);
  });

  test('currencies keep b.baseCurrency, b.currencies[{code,name}] and b.exchangeRates[{code,date,rate}]', () => {
    save('currencies/foreign', { code: 'usd', name: 'US Dollar', prefix: '$', suffix: '', decimals: 2 });
    const c = cur().currencies.find(x => x.code === 'USD');
    assert.ok(c, 'code upper-cased');
    assert.equal(c.name, 'US Dollar');
    save('currencies/exchange-rates', { date: '2026-03-01', code: 'USD', rate: App.parseNum('0.2723') });
    const r = cur().exchangeRates[0];
    assert.equal(r.code, 'USD');
    assert.equal(r.date, '2026-03-01');
    assert.equal(r.rate, 0.2723);
    save('currencies/base', { code: 'SAR', name: 'Saudi Riyal', prefix: '', suffix: '', decimals: 2 });
    assert.equal(cur().baseCurrency, 'SAR');
  });

  test('lock date stays a plain b.lockDate string', () => {
    assert.equal(SP.form('lock').lock, false);
    save('lock', { lock: true, lockDate: '2026-01-31' });
    assert.equal(cur().lockDate, '2026-01-31');
    assert.equal(SP.form('lock').lock, true);
    save('lock', { lock: false, lockDate: '2026-01-31' });
    assert.equal(cur().lockDate, '');
  });

  test('date & number format writes the b.fmt keys money() reads', () => {
    save('format', { date: 'DD/MM/YYYY', sep: 'dot-comma', decimals: 3, time: '09:40:07', week: 'Sunday' });
    const f = cur().fmt;
    assert.equal(f.date, 'DD/MM/YYYY');
    assert.equal(f.sep, 'dot-comma');
    assert.equal(f.decimals, 3);
    assert.equal(App.money(1234.5), '1.234,500');
  });

  test('chart of accounts: control accounts and starting balances write b.coa nodes', () => {
    const before = cur().coa.length;
    const ca = save('control/special', { name: 'Director loans', code: 'DL', parent: 'liabilities' });
    const b = cur();
    assert.equal(b.coa.length, before + 1);
    const n = b.coa.find(x => x.id === ca.id);
    assert.equal(n.type, 'account');
    assert.equal(n.control, 1);
    assert.equal(n.custCtrl, 1);
    assert.equal(n.madeOf, 'Special accounts');
    assert.equal(n.parent, 'liabilities');
    /* the chart of accounts screen is unchanged and still lists it */
    assert.ok(render('coa').indexOf('Director loans') > 0);

    const acct = b.coa.find(x => x.type === 'account' && !x.control);
    save('starting/balance-sheet', { account: acct.id, amount: 1500 });
    assert.equal(cur().coa.find(x => x.id === acct.id).balance, 1500);
    ctx.accountMovements(cur());     // the ledger still reads the chart
  });

  test('bank rules keep {match, account} and their order', () => {
    const a = save('bankRules/payment-rules', { bank: '', amountIs: 'Any amount', match: 'SHELL', payeeType: 'Other', payee: '', account: 'a-fuel', description: '', taxCode: '' });
    save('bankRules/receipt-rules', { bank: '', amountIs: 'Any amount', match: 'REFUND', payeeType: 'Other', payee: '', account: 'a-ref', description: '', taxCode: '' });
    save('bankRules/payment-rules', { match: 'SHELL OIL' }, a.id);
    const rules = cur().bankRules;
    assert.deepEqual(rules.map(r => r.match), ['SHELL OIL', 'REFUND']);
    assert.equal(App.bankRuleAccount(cur(), 'pos shell oil 4'), 'a-fuel');
    assert.equal(SP.rows('bankRules/payment-rules').length, 1);
  });

  test('form defaults reach a new document', () => {
    save('formDefaults/salesInv', { description: 'Monthly retainer', dueDays: 30, taxCode: '', division: '' });
    const pf = App.applyFormDefaults(cur(), 'salesInv', null);
    assert.equal(pf.description, 'Monthly retainer');
    assert.equal(pf.dueDays, 30);
  });

  test('email templates stay a map keyed by document type', () => {
    save('email/templates', { type: 'salesInv', subject: 'Invoice {ref}', body: 'Hello {party}' });
    assert.equal(cur().emailTemplates.salesInv.subject, 'Invoice {ref}');
    assert.equal(App.emailTplFor(cur(), 'salesInv').body, 'Hello {party}');
    save('email/smtp', { mode: 'relay', relayUrl: 'https://relay.test/send', reply: false, replyTo: 'x@y.z', bcc: false, bccTo: '' });
    const e = cur().details.email;
    assert.equal(e.mode, 'relay');
    assert.equal(e.replyTo, '', 'unticked reply-to is cleared');
    assert.equal('reply' in e, false);
  });

  test('inventory kits keep {name, salesPrice, items[{item, qty}]}', () => {
    const k = save('kits', { code: '', name: 'Window kit', unit: '', items: [{ item: 'Glass', qty: 2 }], afPrice: true, salesPrice: 500 });
    const kit = cur().inventoryKits.find(x => x.id === k.id);
    assert.equal(kit.salesPrice, 500);
    assert.equal(kit.items[0].item, 'Glass');
    assert.equal(ctx.kitComponents(cur(), 'Window kit').length, 1);
  });

  test('non-inventory items are the same records the register lists', () => {
    const n = save('nonInvItems', { code: 'SV1', name: 'Consulting hour', unit: 'hour', afSalePrice: true, salesPrice: 300 });
    const rec = cur().records.nonInvItems.find(x => x.id === n.id);
    assert.equal(typeof rec.id, 'number');
    assert.equal(rec.salesPrice, 300);
    assert.ok(rec.uuid);
    const dup = SP.save('nonInvItems', { name: 'consulting hour' });
    assert.equal(dup.ok, false);
  });

  test('records without an id get one, once', () => {
    const b = cur(); b.taxCodes = [{ name: 'Legacy', rate: 3 }]; App.saveBiz(b);
    const id = SP.rows('tax')[0].id;
    assert.ok(id);
    assert.equal(SP.rows('tax')[0].id, id, 'the id is persisted');
    assert.equal(cur().taxCodes[0].rate, 3);
  });
});
