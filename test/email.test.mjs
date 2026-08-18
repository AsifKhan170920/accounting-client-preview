import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppWithDemo } from './_harness.mjs';

let ctx, App, biz;
beforeEach(() => {
  ({ ctx, biz } = loadAppWithDemo());
  App = ctx.App;
});

describe('_emFill', () => {
  test('substitutes known placeholders', () => {
    assert.equal(App._emFill('Hi {party}, re {ref}', { party: 'Acme', ref: 'INV-1' }), 'Hi Acme, re INV-1');
  });

  test('leaves an unknown placeholder untouched rather than printing undefined', () => {
    assert.equal(App._emFill('X {nope} Y', {}), 'X {nope} Y');
  });

  test('leaves a placeholder whose value is empty alone', () => {
    assert.equal(App._emFill('{ref}', { ref: '' }), '{ref}');
  });

  test('replaces every occurrence', () => {
    assert.equal(App._emFill('{a}-{a}', { a: '1' }), '1-1');
  });

  test('handles a null or missing template', () => {
    assert.equal(App._emFill(null, {}), '');
    assert.equal(App._emFill(undefined, {}), '');
  });
});

describe('_mailtoHref', () => {
  test('builds a mailto with encoded subject and body', () => {
    const h = App._mailtoHref({}, { to: 'a@b.com', subject: 'Q1 & Q2', body: 'L1\nL2' });
    assert.ok(h.startsWith('mailto:a%40b.com?'));
    assert.ok(h.includes('subject=Q1%20%26%20Q2'), 'ampersand must be encoded, not treated as a separator');
    assert.ok(h.includes('body=L1%0AL2'), 'newlines must be encoded');
  });

  test('includes reply-to only when configured', () => {
    assert.ok(App._mailtoHref({ replyTo: 'r@x.com' }, { to: 'a@b.com' }).includes('reply-to=r%40x.com'));
    assert.ok(!App._mailtoHref({}, { to: 'a@b.com' }).includes('reply-to'));
  });

  test('tolerates a message with no subject or body', () => {
    const h = App._mailtoHref({}, { to: 'a@b.com' });
    assert.ok(h.includes('subject=&') || h.includes('subject='));
    assert.ok(!h.includes('undefined'));
  });
});

describe('emailVars', () => {
  test('derives the fields the templates reference', () => {
    const v = App.emailVars(biz, 'receipts', { reference: '43856', amount: 660, date: '2025-05-31' });
    assert.equal(v.business, 'Abbass Tempering Industry LLC');
    assert.equal(v.ref, '43856');
    assert.equal(v.document, 'Receipt');
    assert.ok(v.amount.includes('660'));
  });

  test('falls back to a neutral salutation when there is no party', () => {
    assert.equal(App.emailVars(biz, 'receipts', {}).party, 'Sir/Madam');
  });

  test('picks up a customer, supplier or employee name', () => {
    assert.equal(App.emailVars(biz, 'salesInv', { customer: 'Acme' }).party, 'Acme');
    assert.equal(App.emailVars(biz, 'purchInv', { supplier: 'Gulf' }).party, 'Gulf');
  });

  test('an empty record produces no "undefined" text', () => {
    const v = App.emailVars(biz, 'salesInv', {});
    for (const [k, val] of Object.entries(v)) {
      assert.ok(!String(val).includes('undefined'), `${k} leaked undefined`);
    }
  });
});

describe('emailTplFor', () => {
  test('returns the built-in default when nothing is customised', () => {
    const t = App.emailTplFor(biz, 'salesInv');
    assert.ok(t.subject.includes('{ref}'));
    assert.ok(t.body.includes('{party}'));
  });

  test('a saved template overrides the default', () => {
    biz.emailTemplates = { salesInv: { subject: 'Custom {ref}', body: 'Body' } };
    assert.equal(App.emailTplFor(biz, 'salesInv').subject, 'Custom {ref}');
  });

  test('an empty saved subject falls back rather than sending a blank one', () => {
    biz.emailTemplates = { salesInv: { subject: '', body: '' } };
    const t = App.emailTplFor(biz, 'salesInv');
    assert.ok(t.subject.length > 0);
    assert.ok(t.body.length > 0);
  });
});

describe('_partyEmail', () => {
  test('finds a customer address by name', () => {
    assert.equal(App._partyEmail(biz, 'customers', 'MIRDIF ALUMINIUM & GLASS'), 'accounts@mirdifglass.ae');
  });

  test('matching ignores case and surrounding whitespace', () => {
    assert.equal(App._partyEmail(biz, 'customers', '  mirdif aluminium & glass '), 'accounts@mirdifglass.ae');
  });

  test('returns empty for an unknown or blank name', () => {
    assert.equal(App._partyEmail(biz, 'customers', 'Nobody Ltd'), '');
    assert.equal(App._partyEmail(biz, 'customers', ''), '');
  });
});

describe('emailMode', () => {
  test('defaults to the mail client, which always works', () => {
    assert.equal(App.emailMode(biz), 'mailto');
  });

  test('reflects a configured mode', () => {
    biz.details.email = { mode: 'relay' };
    assert.equal(App.emailMode(biz), 'relay');
  });
});

describe('_emailLog', () => {
  test('records a send, newest first', () => {
    App._emailLog(biz, { to: 'a@b.com', subject: 'One', body: 'x', status: 'Sent', mode: 'relay' });
    App._emailLog(biz, { to: 'c@d.com', subject: 'Two', body: 'y', status: 'Failed', mode: 'relay' });
    const log = biz.records.emails;
    assert.equal(log.length, 2);
    assert.equal(log[0].subject, 'Two', 'newest entry first');
    assert.equal(log[0].status, 'Failed');
  });

  test('every entry gets an id and timestamp', () => {
    App._emailLog(biz, { to: 'a@b.com', subject: 'S', body: 'x', status: 'Sent', mode: 'mailto' });
    const e = biz.records.emails[0];
    assert.ok(e.id);
    assert.ok(!Number.isNaN(Date.parse(e.ts)));
  });

  test('failures record the reason', () => {
    App._emailLog(biz, { to: 'a@b.com', subject: 'S', body: '', status: 'Failed', mode: 'relay', error: 'boom' });
    assert.equal(biz.records.emails[0].error, 'boom');
  });

  test('the log is capped so it cannot grow without bound', () => {
    for (let i = 0; i < 520; i++) {
      App._emailLog(biz, { to: 'a@b.com', subject: 'S' + i, body: '', status: 'Sent', mode: 'mailto' });
    }
    assert.equal(biz.records.emails.length, 500);
  });

  test('the send is persisted, not just held in memory', () => {
    App._emailLog(biz, { to: 'a@b.com', subject: 'Persisted', body: '', status: 'Sent', mode: 'mailto' });
    const stored = ctx.DB.get(ctx.DB.k.biz, []).find((x) => x.id === biz.id);
    assert.equal(stored.records.emails[0].subject, 'Persisted');
  });
});

describe('emailSend validation', () => {
  const compose = (to) => {
    ctx.clearEls();
    ctx.stubEl('em_to', to);
    ctx.stubEl('em_subj', 'S');
    ctx.stubEl('em_body', 'B');
  };

  test('refuses an empty recipient', () => {
    compose('');
    App.emailSend();
    assert.equal((biz.records.emails || []).length, 0, 'nothing should be logged');
    assert.match(ctx.alerts.at(-1), /recipient/i);
  });

  test('refuses a malformed address', () => {
    compose('not-an-email');
    App.emailSend();
    assert.equal((biz.records.emails || []).length, 0);
    assert.match(ctx.alerts.at(-1), /not a valid email/i);
  });

  test('refuses relay mode with no endpoint configured', () => {
    biz.details.email = { mode: 'relay', relayUrl: '' };
    App.saveBiz(biz);
    compose('a@b.com');
    App.emailSend();
    assert.equal((biz.records.emails || []).length, 0);
    assert.match(ctx.alerts.at(-1), /relay URL/i);
  });
});
