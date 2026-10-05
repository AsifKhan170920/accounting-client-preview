/* Users & access (js/users.js): password hashing, migration of the old
   plain-text accounts, login lockout, MFA, user validation, business
   assignment and the per-tab View / Create / Update / Delete permission levels. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadApp } from './_harness.mjs';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** A fresh app with two businesses (one with two bank accounts and receipts). */
function fresh(storage = {}) {
  const ctx = loadApp({ storage });
  const mk = (id, name) => {
    const b = ctx.demoBusiness(); b.id = id; b.name = name;
    ctx.ensureSettings(b); ctx.ensureCoa(b); return b;
  };
  if (!storage.mgr_businesses) {
    const a = mk(1001, 'Alpha LLC'), z = mk(2002, 'Zeta FZE');
    a.records = {
      bankCash: [{ id: 11, name: 'Main bank' }, { id: 12, name: 'Petty cash' }],
      receipts: [
        { id: 1, date: '2026-01-02', receivedIn: 'Main bank', amount: 10 },
        { id: 2, date: '2026-01-03', receivedIn: 'Petty cash', amount: 20 },
      ],
    };
    ctx.DB.set(ctx.DB.k.biz, [a, z]);
  }
  return { ctx, App: ctx.App, UA: ctx.UsersAccess, DB: ctx.DB };
}

async function addUser(UA, o) {
  const r = await UA.saveUser(Object.assign({ name: o.username, email: '', newpw: 'secret1', role: 'Administrator', businesses: [], mfa: false, perm: {} }, o), { me: null });
  assert.ok(r.ok, r.error);
  return r.user;
}

describe('password hashing', () => {
  test('is salted SHA-256 of salt:password', async () => {
    const { UA } = fresh();
    assert.equal(await UA.hashPw('admin', 'NaCl'), sha256('NaCl:admin'));
    assert.notEqual(await UA.hashPw('admin', 'a'), await UA.hashPw('admin', 'b'));
  });

  test('no plain-text password is stored for a new user', async () => {
    const { UA, DB } = fresh();
    await addUser(UA, { username: 'boss', newpw: 'TopSecret9' });
    const raw = DB.get(DB.k.users, []);
    assert.ok(raw[0].hash && raw[0].salt);
    assert.ok(!JSON.stringify(raw).includes('TopSecret9'));
  });
});

describe('TOTP', () => {
  /* RFC 6238 appendix B, SHA-1 secret "12345678901234567890", last 6 digits */
  const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  test('matches the RFC 6238 test vectors', async () => {
    const { UA } = fresh();
    assert.equal(await UA.totp(SECRET, 59 * 1000), '287082');
    assert.equal(await UA.totp(SECRET, 1111111109 * 1000), '081804');
    assert.equal(await UA.totp(SECRET, 1234567890 * 1000), '005924');
  });
  test('accepts one step of clock drift, not more', async () => {
    const { UA } = fresh();
    const t = 1234567890 * 1000, code = await UA.totp(SECRET, t);
    assert.equal(await UA.totpOk(SECRET, code, t + 30000), true);
    assert.equal(await UA.totpOk(SECRET, code, t + 95000), false);
    assert.equal(await UA.totpOk(SECRET, 'abc', t), false);
  });
  test('generated secrets are base32 and round-trip', () => {
    const { UA } = fresh();
    const s = UA.b32gen();
    assert.match(s, /^[A-Z2-7]{32}$/);
    assert.equal(UA.b32dec(s).length, 20);
  });
});

describe('migration from the old plain-text accounts', () => {
  const OLD = {
    mgr_accounts: JSON.stringify([{ name: 'Administrator', user: 'Administrator', pass: 'admin' },
      { name: 'Clerk', user: 'clerk', pass: 'pw' }]),
    mgr_users: JSON.stringify([{ id: 1, name: 'Administrator', user: 'Administrator', role: 'Administrator' },
      { id: 2, name: 'Clerk', user: 'clerk', role: 'Restricted user' }]),
  };

  test('hashes the old passwords, removes mgr_accounts, and the old passwords still log in', async () => {
    const { UA, DB } = fresh(OLD);
    DB.set(DB.k.biz, [{ id: 1001, name: 'Alpha', records: {} }, { id: 2002, name: 'Zeta', records: {} }]);
    const list = await UA.migrateUsers();
    assert.equal(list.length, 2);
    assert.equal(DB.get(DB.k.accounts, null), null, 'plain-text list is gone');
    const stored = JSON.stringify(DB.get(DB.k.users, []));
    assert.ok(!stored.includes('"pass"'));
    const admin = list.find((u) => u.username === 'Administrator');
    assert.equal(admin.role, 'Administrator');
    assert.equal(admin.hash, sha256(admin.salt + ':admin'));
    /* restricted users could open every business before — they still can */
    const clerk = list.find((u) => u.username === 'clerk');
    assert.deepEqual([...clerk.businesses], [1001, 2002]);
    assert.equal((await UA.login('administrator', 'admin')).ok, true, 'username is case-insensitive');
    assert.equal((await UA.login('clerk', 'pw')).ok, true, 'short legacy password still works');
    /* running it again changes nothing */
    const again = await UA.migrateUsers();
    assert.equal(again[0].hash, list[0].hash);
  });

  test('an account with no users row becomes an administrator', async () => {
    const { UA } = fresh({ mgr_accounts: JSON.stringify([{ name: 'Jane', user: 'jane', pass: 'pw123456' }]) });
    const list = await UA.migrateUsers();
    assert.equal(list.length, 1);
    assert.equal(list[0].role, 'Administrator');
  });

  test('old b.permissions {role,hidden} move to b.userPermissions[userId]', async () => {
    const { UA, DB } = fresh(OLD);
    DB.set(DB.k.biz, [{ id: 1001, name: 'Alpha', records: {}, permissions: { clerk: { role: 'Restricted', hidden: ['Sales Invoices'] }, ghost: { role: 'Read only' } } }]);
    await UA.migrateUsers();
    UA.migratePermissions();
    const b = DB.get(DB.k.biz, [])[0];
    const clerk = UA.users().find((u) => u.username === 'clerk');
    const p = b.userPermissions[clerk.id];
    assert.equal(p.access, 'Custom access');
    assert.equal(p.perms['Sales Invoices'], undefined);
    assert.equal(p.perms.Receipts, 'View, Create, Update, Delete');
    assert.equal(p.perms.Summary, 'View, Create, Update, Delete');
    assert.ok(b.permissions.ghost, 'an entry whose user is unknown is left alone');
    assert.equal(b.permissions.clerk, undefined);
  });

  test('a signed-in session from before the change survives the upgrade', async () => {
    const { App, UA, DB } = fresh(Object.assign({ mgr_session: JSON.stringify({ name: 'Administrator', user: 'Administrator' }) }, OLD));
    await App.authBoot();
    assert.equal(UA.sessionValid(), true);
    assert.equal(App.currentUser().username, 'Administrator');
    assert.equal(App.currentUser().role, 'Administrator');
    assert.ok(DB.get(DB.k.session).sid);
  });

  test('a fresh install has no default admin/admin: it asks for an administrator', async () => {
    const { App, UA, ctx } = fresh();
    await App.authBoot();
    assert.equal(UA.users().length, 0);
    assert.match(ctx.htmlOf('authBody'), /Create administrator/);
  });
});

describe('first-run setup', () => {
  test('validates, creates the administrator and signs in', async () => {
    const { UA } = fresh();
    assert.match((await UA.createFirstAdmin({ username: 'boss', password: '123', confirm: '123' })).error, /at least 6/);
    assert.match((await UA.createFirstAdmin({ username: 'boss', password: '123456', confirm: '1234567' })).error, /do not match/);
    assert.match((await UA.createFirstAdmin({ username: '', password: '123456', confirm: '123456' })).error, /required/);
    const r = await UA.createFirstAdmin({ name: 'Boss', username: 'boss', password: '123456', confirm: '123456' });
    assert.equal(r.ok, true);
    assert.equal(UA.currentUser().role, 'Administrator');
    assert.equal((await UA.createFirstAdmin({ username: 'x', password: '123456', confirm: '123456' })).ok, false, 'only once');
  });
});

describe('login', () => {
  test('locks for 5 minutes after 5 failed attempts', async () => {
    const { UA } = fresh();
    await addUser(UA, { username: 'boss', newpw: 'right-pw' });
    const t0 = Date.UTC(2026, 0, 1);
    for (let i = 1; i <= 4; i++) assert.equal((await UA.login('boss', 'wrong', { now: t0 })).error, 'Invalid username or password.');
    const fifth = await UA.login('boss', 'wrong', { now: t0 });
    assert.equal(fifth.locked, true);
    const blocked = await UA.login('boss', 'right-pw', { now: t0 + 60000 });
    assert.equal(blocked.ok, false, 'even the right password is refused while locked');
    assert.match(blocked.error, /Try again in 4 minute/);
    const later = await UA.login('boss', 'right-pw', { now: t0 + 5 * 60000 + 1 });
    assert.equal(later.ok, true);
  });

  test('a successful login resets the counter and records the device', async () => {
    const { UA, DB } = fresh();
    await addUser(UA, { username: 'boss', newpw: 'right-pw' });
    await UA.login('boss', 'bad');
    const r = await UA.login('boss', 'right-pw');
    assert.equal(r.ok, true);
    assert.deepEqual(Object.keys(DB.get(DB.k.loginFail, {})), []);
    assert.ok(r.session.device.length > 3);
    assert.equal(DB.get(DB.k.session).role, 'Administrator', 'the header can show the real role');
  });

  test('unknown users get the same message as a wrong password', async () => {
    const { UA } = fresh();
    await addUser(UA, { username: 'boss' });
    assert.equal((await UA.login('nobody', 'secret1')).error, 'Invalid username or password.');
  });
});

describe('multi-factor authentication', () => {
  test('first login sets up the authenticator, later logins ask for a code', async () => {
    const { UA } = fresh();
    const u = await addUser(UA, { username: 'boss', mfa: true });
    const first = await UA.login('boss', 'secret1');
    assert.equal(first.ok, false);
    assert.equal(first.mfa, true);
    assert.equal(first.pending.setup, true);
    assert.match(UA.otpauthUri('boss', first.pending.secret), /^otpauth:\/\/totp\/Manager%3Aboss\?secret=[A-Z2-7]+&issuer=Manager$/);
    assert.equal((await UA.completeMfa(first.pending, '000000')).ok, false);
    const code = await UA.totp(first.pending.secret);
    assert.equal((await UA.completeMfa(first.pending, code)).ok, true);
    assert.equal(UA.users().find((x) => x.id === u.id).totpSecret, first.pending.secret);
    const second = await UA.login('boss', 'secret1');
    assert.equal(second.mfa, true);
    assert.equal(second.pending.setup, undefined);
  });
});

describe('managing users', () => {
  test('validations: unique username, email, password length', async () => {
    const { UA } = fresh();
    await addUser(UA, { username: 'boss' });
    assert.match((await UA.saveUser({ username: 'BOSS', newpw: 'secret1', role: 'Administrator' }, { me: null })).error, /already taken/);
    assert.match((await UA.saveUser({ username: 'x', email: 'nope', newpw: 'secret1', role: 'Administrator' }, { me: null })).error, /Email/);
    assert.match((await UA.saveUser({ username: 'x', newpw: '12', role: 'Administrator' }, { me: null })).error, /6 characters/);
  });

  test('at least one administrator, no self-demotion, no self-delete', async () => {
    const { UA } = fresh();
    const boss = await addUser(UA, { username: 'boss' });
    const d = UA.draftFor(boss);
    d.role = 'Restricted user';
    assert.match((await UA.saveUser(d, { me: null })).error, /At least one administrator/);
    const two = await addUser(UA, { username: 'two' });
    assert.match((await UA.saveUser(d, { me: boss })).error, /your own administrator role/);
    assert.match(UA.deleteUser(boss.id, { me: boss }).error, /your own account/);
    assert.equal(UA.deleteUser(two.id, { me: boss }).ok, true);
    assert.match(UA.deleteUser(boss.id, { me: null }).error, /At least one administrator/);
  });

  test('changing a password logs the user out everywhere else', async () => {
    const { UA, DB } = fresh();
    const boss = await addUser(UA, { username: 'boss' });
    await UA.login('boss', 'secret1');            // "another device"
    await UA.login('boss', 'secret1');            // this browser
    assert.equal(UA.sessions().length, 2);
    const d = UA.draftFor(UA.users().find((u) => u.id === boss.id)); d.newpw = 'brand-new';
    assert.equal((await UA.saveUser(d)).ok, true);
    assert.equal(UA.sessions().length, 1);
    assert.equal(UA.sessions()[0].id, DB.get(DB.k.session).sid, 'this session is kept');
    assert.equal((await UA.login('boss', 'brand-new')).ok, true);
  });

  test('profile: current password required; new password ends other sessions', async () => {
    const { UA } = fresh();
    await addUser(UA, { username: 'boss' });
    await UA.login('boss', 'secret1'); await UA.login('boss', 'secret1');
    assert.match((await UA.changeProfile({ username: 'boss', current: 'nope', password: 'abcdef' })).error, /Current password/);
    const r = await UA.changeProfile({ username: 'chief', current: 'secret1', password: 'abcdef' });
    assert.equal(r.ok, true);
    assert.equal(UA.sessions().length, 1);
    assert.equal(UA.currentUser().username, 'chief');
  });

  test('restricted user: businesses and per-business permissions are saved', async () => {
    const { UA, DB } = fresh();
    const clerk = await addUser(UA, {
      username: 'clerk', role: 'Restricted user', businesses: [1001],
      perm: { 1001: { access: 'Custom access', perms: { Receipts: 'View' } } },
    });
    const b = DB.get(DB.k.biz, []).find((x) => x.id === 1001);
    assert.equal(b.userPermissions[clerk.id].perms.Receipts, 'View');
    assert.equal(b.userPermissions[clerk.id].username, 'clerk');
    /* an empty custom record is rejected */
    const bad = await UA.saveUser({ username: 'c2', newpw: 'secret1', role: 'Restricted user', businesses: [1001], perm: { 1001: { access: 'Custom access', perms: {} } } }, { me: null });
    assert.match(bad.error, /Alpha LLC: Tick at least one tab/);
    /* back to Full access removes the record */
    const d = UA.draftFor(UA.users().find((u) => u.id === clerk.id));
    d.perm['1001'].access = 'Full access';
    assert.equal((await UA.saveUser(d, { me: null })).ok, true);
    assert.equal(DB.get(DB.k.biz, []).find((x) => x.id === 1001).userPermissions[clerk.id], undefined);
  });
});

describe('business assignment', () => {
  test('restricted users only see and open their businesses; admins see all', async () => {
    const { App, UA, ctx } = fresh();
    const boss = await addUser(UA, { username: 'boss' });
    await addUser(UA, { username: 'clerk', role: 'Restricted user', businesses: [2002] });
    await UA.login('clerk', 'secret1');
    assert.deepEqual(App.visibleBusinesses().map((b) => b.name), ['Zeta FZE']);
    assert.equal(App.canOpenBusiness(1001), false);
    App.openBiz = null;
    App.openBusiness(1001);
    assert.equal(App.openBiz, null, 'blocked');
    assert.match(ctx.alerts.at(-1), /do not have access to this business/);
    App.renderBusinesses();
    assert.ok(!ctx.htmlOf('bizListWrap').includes('Alpha LLC'));
    await UA.login('boss', 'secret1');
    assert.equal(App.visibleBusinesses().length, 2);
    void boss;
  });

  test('admin can impersonate a restricted user and stop', async () => {
    const { App, UA } = fresh();
    await addUser(UA, { username: 'boss' });
    const clerk = await addUser(UA, { username: 'clerk', role: 'Restricted user', businesses: [2002] });
    await UA.login('boss', 'secret1');
    App.impersonate(clerk.id);
    assert.equal(App.currentUser().username, 'clerk');
    assert.equal(App.realUser().username, 'boss');
    assert.equal(App.visibleBusinesses().length, 1);
    App.stopImpersonate();
    assert.equal(App.currentUser().username, 'boss');
  });
});

describe('permission levels', () => {
  async function restricted(perm) {
    const env = fresh();
    await addUser(env.UA, { username: 'boss' });
    await addUser(env.UA, { username: 'clerk', role: 'Restricted user', businesses: [1001], perm: { 1001: perm } });
    await env.UA.login('clerk', 'secret1');
    env.App.openBiz = 1001;
    return Object.assign(env, { b: env.App.curBiz() });
  }
  const CUSTOM = {
    access: 'Custom access',
    perms: { Summary: 'View', Receipts: 'View', Payments: 'View, Create, Update, Delete', 'Sales Invoices': 'View, Create, Update',
      Customers: 'View, Create', 'Bank and Cash Accounts': 'View', Reports: 'View', Settings: 'View' },
    reports: { pl: 'View' }, settings: { tax: 'View', business: 'View, Create, Update' }, banks: ['11'],
  };

  test('levels 0-4 and the contract helpers', async () => {
    const { App, b } = await restricted(CUSTOM);
    assert.equal(App.permLevel(b, 'Journal Entries'), 0);
    assert.equal(App.permLevel(b, 'Receipts'), 1);
    assert.equal(App.permLevel(b, 'Customers'), 2);
    assert.equal(App.permLevel(b, 'Sales Invoices'), 3);
    assert.equal(App.permLevel(b, 'Payments'), 4);
    assert.equal(App.canCreate(b, 'Receipts'), false);
    assert.equal(App.canCreate(b, 'Customers'), true);
    assert.equal(App.canEdit(b, 'Customers'), false);
    assert.equal(App.canEdit(b, 'Sales Invoices'), true);
    assert.equal(App.canDelete(b, 'Sales Invoices'), false);
    assert.equal(App.canDelete(b, 'Payments'), true);
    assert.equal(App.isHidden(b, 'Journal Entries'), true);
    assert.equal(App.isHidden(b, 'Receipts'), false);
    assert.equal(App.currentUser().role, 'Restricted user');
  });

  test('settings pages and reports have their own levels', async () => {
    const { App, b } = await restricted(CUSTOM);
    assert.equal(App.settingLevel(b, 'tax'), 1);
    assert.equal(App.settingLevel(b, 'coa'), 0);
    assert.equal(App.canSetting(b, 'business', 3), true);
    assert.equal(App.settingLevel(b, 'logo'), 3, 'tile-less screens follow their parent tile');
    assert.deepEqual([...App.setTiles().map((t) => t[2])].sort(), ['business', 'tax']);
    assert.equal(App.reportLevel(b, 'pl'), 1);
    assert.equal(App.reportLevel(b, 'bs'), 0);
    App.repView = null;
    const idx = App.reportsHtml(b);
    assert.ok(idx.includes("App.openReport('pl')"));
    assert.ok(!idx.includes("App.openReport('bs')"));
    App.setView = 'tax';
    const html = App.settingsHtml(b);
    assert.match(html, /perm-ro/, 'view-only settings page is read only');
    App.setView = 'coa';
    assert.match(App.settingsHtml(b), /do not have access/);
    App.setView = null;
  });

  test('admins and users without a record have full access', async () => {
    const { App, UA, b } = await restricted({ access: 'Full access' });
    assert.equal(App.permLevel(b, 'Journal Entries'), 4);
    await UA.login('boss', 'secret1');
    assert.equal(App.permLevel(b, 'Journal Entries'), 4);
    assert.equal(App.settingLevel(b, 'coa'), 4);
  });

  test('buttons are removed below the level they need', async () => {
    const { App, b, ctx } = await restricted(CUSTOM);
    App.wsSection = 'Receipts'; App.wsMode = 'list';
    const list = App.listHtml(b);
    assert.ok(!list.includes('App.newRecord()'), 'no New at View');
    assert.ok(!list.includes('App.editRecord('), 'no Edit at View');
    assert.ok(list.includes('App.viewRecord('), 'View stays');
    App.newRecord();
    assert.match(ctx.alerts.at(-1), /do not allow creating Receipts/);
    App.wsSection = 'Payments';
    assert.ok(App.listHtml(b).includes('App.newRecord()'));
    const strip = ctx.UsersAccess.stripForLevel;
    const btns = '<button onclick="App.newRecord()">N</button><button class="x" onclick="App.editRecord(3)">E</button><button onclick="App.deleteRecord(3)">D</button><button onclick="App.printView()">P</button>';
    assert.equal(strip(btns, 3), '<button onclick="App.newRecord()">N</button><button class="x" onclick="App.editRecord(3)">E</button><button onclick="App.printView()">P</button>');
    assert.equal(strip(btns, 1), '<button onclick="App.printView()">P</button>');
    assert.equal(strip(btns, 4), btns);
  });

  test('guardWrite and selectSection respect the levels', async () => {
    const { App, b, ctx } = await restricted(CUSTOM);
    App.wsSection = 'Customers'; App.editingId = null;
    assert.equal(App.guardWrite(b), true, 'create allowed');
    App.editingId = 5;
    assert.equal(App.guardWrite(b), false, 'update needs level 3');
    App.editingId = null;
    App.selectSection('Journal Entries');
    assert.notEqual(App.wsSection, 'Journal Entries');
    assert.match(ctx.alerts.at(-1), /do not have access to Journal Entries/);
    assert.equal(App.createEntityRecord('suppliers', { name: 'X' }).ok, false);
  });

  test('bank and cash accounts limit which rows are listed', async () => {
    const { App, b } = await restricted(CUSTOM);
    App.wsSection = 'Receipts';
    assert.deepEqual(App.sortedRecords(b).map((r) => r.receivedIn), ['Main bank']);
    App.wsSection = 'Bank and Cash Accounts';
    assert.deepEqual(App.sortedRecords(b).map((r) => r.name), ['Main bank']);
  });
});

describe('screens', () => {
  test('Users page lists admins first with an Impersonate button for restricted users', async () => {
    const { App, UA, ctx } = fresh();
    await addUser(UA, { username: 'boss', name: 'Big Boss' });
    await addUser(UA, { username: 'clerk', role: 'Restricted user', businesses: [1001] });
    await UA.login('boss', 'secret1');
    App.renderUsers();
    const html = ctx.htmlOf('usersBody');
    assert.ok(html.indexOf('Big Boss') < html.indexOf('clerk'));
    assert.match(html, /Administrator/);
    assert.match(html, /App\.impersonate\(/);
    assert.match(html, /Alpha LLC/, 'assigned businesses are shown as a tree');
    assert.match(html, /New User/);
  });

  test('user form: restricted role shows businesses and a permission editor per business', async () => {
    const { App, UA, ctx } = fresh();
    const clerk = await addUser(UA, { username: 'clerk', role: 'Restricted user', businesses: [1001] });
    App.editUser(clerk.id);
    let html = ctx.htmlOf('userFormBody');
    assert.match(html, /Add business/);
    assert.match(html, /<legend>Alpha LLC<\/legend>/);
    assert.match(html, /Access type/);
    assert.match(html, /Enforce multi-factor authentication/);
    App.permEd('1001', 'access', 'Custom access');
    App.permEd('1001', 'tab', 'Bank and Cash Accounts', true);
    html = ctx.htmlOf('userFormBody');
    assert.match(html, /perm-bankbox/);
    assert.match(html, /Petty cash/);
    App.permEd('1001', 'tab', 'Reports', true);
    assert.match(ctx.htmlOf('userFormBody'), /Profit and Loss Statement/);
  });

  test('Settings > User Permissions edits a record for this business', async () => {
    const { App, UA, DB } = fresh();
    await addUser(UA, { username: 'boss' });
    const clerk = await addUser(UA, { username: 'clerk', role: 'Restricted user', businesses: [1001] });
    await UA.login('boss', 'secret1');
    App.openBiz = 1001;
    const b = App.curBiz();
    assert.match(App.set_permissions(b), /clerk/);
    App.permEdit(clerk.id);
    assert.match(App.set_permissions(App.curBiz()), /Access type/);
    App.permEd('pf', 'tab', 'Receipts', true);
    App.permEd('pf', 'level', 'perms', 'Receipts', 'View, Create');
    App.permSave();
    const saved = DB.get(DB.k.biz, []).find((x) => x.id === 1001).userPermissions[clerk.id];
    assert.equal(saved.perms.Receipts, 'View, Create');
    assert.equal(App._permDraft, null);
  });

  test('profile lists where you are logged in', async () => {
    const { App, UA, ctx } = fresh();
    await addUser(UA, { username: 'boss' });
    await UA.login('boss', 'secret1'); await UA.login('boss', 'secret1');
    App.renderProfile();
    const html = ctx.htmlOf('profileBody');
    assert.match(html, /Where You Are Logged In/);
    assert.match(html, /This Computer/);
    assert.match(html, /Logout all other devices/);
  });
});
