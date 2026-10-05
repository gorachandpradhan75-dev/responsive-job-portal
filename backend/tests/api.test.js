'use strict';
/**
 * API integration tests: real HTTP server on an ephemeral port + in-memory SQLite.
 * Uses only Node built-ins (node:test, node:assert, global fetch).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { createServer } = require('../src/server');
const { sign } = require('../src/utils/jwt');

const SECRET = 'integration-test-secret-0123456789';
let ctx;
let base;

test.before(async () => {
  ctx = createServer({ databasePath: ':memory:', jwtSecret: SECRET, quiet: true, staticDir: null });
  await new Promise((resolve) => ctx.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${ctx.server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => ctx.server.close(resolve));
});

async function call(method, url, { body, token, headers = {}, raw } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, headers: res.headers, text };
}

const alice = { name: 'Alice Tester', email: 'alice@example.com', password: 'password123', phone: '9876543210' };
const bob = { name: 'Bob Tester', email: 'bob@example.com', password: 'password456', phone: '9123456780' };

async function registerAndLogin(user) {
  await call('POST', '/api/auth/register', { body: user });
  const res = await call('POST', '/api/auth/login', { body: { email: user.email, password: user.password } });
  return res.json.token;
}

// ---------------------------------------------------------------- health
test('GET /api/health returns ok', async () => {
  const res = await call('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.status, 'ok');
  assert.equal(res.json.database, 'connected');
  assert.ok(res.json.timestamp);
});

// ---------------------------------------------------------------- registration
test('register: success returns 201, safe user, no password data', async () => {
  const res = await call('POST', '/api/auth/register', { body: alice });
  assert.equal(res.status, 201);
  assert.equal(res.json.user.email, alice.email);
  assert.equal(res.json.user.name, alice.name);
  assert.equal(res.json.user.phone, alice.phone);
  assert.ok(res.json.user.id);
  assert.ok(!('password' in res.json.user));
  assert.ok(!('password_hash' in res.json.user));
  assert.ok(!res.text.includes(alice.password));
});

test('register: password is stored hashed (scrypt), never plain text', () => {
  const row = ctx.db.prepare('SELECT password_hash FROM users WHERE email = ?').get(alice.email);
  assert.ok(row.password_hash.startsWith('scrypt$'));
  assert.ok(!row.password_hash.includes(alice.password));
});

test('register: duplicate email -> 409 (case-insensitive)', async () => {
  let res = await call('POST', '/api/auth/register', { body: alice });
  assert.equal(res.status, 409);
  assert.equal(res.json.success, false);
  assert.ok(res.json.errors.email);

  res = await call('POST', '/api/auth/register', { body: { ...alice, email: 'ALICE@Example.com' } });
  assert.equal(res.status, 409);
});

test('register: validation failures -> 400 with field errors', async () => {
  const cases = [
    [{}, ['name', 'email', 'password', 'phone']],
    [{ ...bob, email: 'not-an-email' }, ['email']],
    [{ ...bob, password: '123' }, ['password']],
    [{ ...bob, phone: '12345' }, ['phone']],
    [{ ...bob, name: '   ' }, ['name']],
    [{ ...bob, password: 12345678 }, ['password']],
  ];
  for (const [body, fields] of cases) {
    const res = await call('POST', '/api/auth/register', { body });
    assert.equal(res.status, 400, JSON.stringify(body));
    for (const f of fields) assert.ok(res.json.errors[f], `expected error for ${f}`);
  }
});

test('invalid JSON body -> 400; non-object JSON -> 400', async () => {
  let res = await call('POST', '/api/auth/register', { raw: '{bad json' });
  assert.equal(res.status, 400);
  res = await call('POST', '/api/auth/register', { raw: '[1,2,3]' });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------- login + JWT
test('login: success returns JWT + safe user', async () => {
  const res = await call('POST', '/api/auth/login', { body: { email: alice.email, password: alice.password } });
  assert.equal(res.status, 200);
  assert.match(res.json.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal(res.json.tokenType, 'Bearer');
  assert.equal(res.json.user.email, alice.email);
  assert.ok(!res.text.includes('password_hash'));
  assert.ok(!res.text.includes(alice.password));
  const payload = JSON.parse(Buffer.from(res.json.token.split('.')[1], 'base64url'));
  assert.equal(payload.sub, String(res.json.user.id));
  assert.ok(payload.exp > payload.iat);
});

test('login: email is case-insensitive', async () => {
  const res = await call('POST', '/api/auth/login', { body: { email: 'Alice@EXAMPLE.com', password: alice.password } });
  assert.equal(res.status, 200);
});

test('login: wrong password and unknown email -> 401 with identical message', async () => {
  const wrong = await call('POST', '/api/auth/login', { body: { email: alice.email, password: 'wrongpass' } });
  const unknown = await call('POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: 'whatever1' } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.json.message, unknown.json.message);
  assert.equal(wrong.json.code, 'INVALID_CREDENTIALS');
  assert.ok(!wrong.json.token);
});

test('login: missing fields -> 400', async () => {
  const res = await call('POST', '/api/auth/login', { body: { email: alice.email } });
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.password);
});

test('JWT validation on protected route: missing / malformed / wrong secret / tampered / expired', async () => {
  const good = (await call('POST', '/api/auth/login', { body: { email: alice.email, password: alice.password } })).json;

  let res = await call('GET', '/api/auth/me');
  assert.equal(res.status, 401);
  assert.equal(res.json.code, 'TOKEN_MISSING');

  res = await call('GET', '/api/auth/me', { headers: { Authorization: 'Basic abc' } });
  assert.equal(res.status, 401);

  res = await call('GET', '/api/auth/me', { token: 'not.a.jwt' });
  assert.equal(res.status, 401);
  assert.equal(res.json.code, 'TOKEN_INVALID');

  const wrongSecret = sign({ sub: String(good.user.id) }, 'a-different-secret-entirely');
  res = await call('GET', '/api/auth/me', { token: wrongSecret });
  assert.equal(res.status, 401);
  assert.equal(res.json.code, 'TOKEN_INVALID');

  const [h, , s] = good.token.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: '1', exp: 9999999999 })).toString('base64url');
  res = await call('GET', '/api/auth/me', { token: `${h}.${forged}.${s}` });
  assert.equal(res.status, 401);

  const expired = sign({ sub: String(good.user.id) }, SECRET, { expiresIn: 5, now: Date.now() - 120_000 });
  res = await call('GET', '/api/auth/me', { token: expired });
  assert.equal(res.status, 401);
  assert.equal(res.json.code, 'TOKEN_EXPIRED');

  const orphan = sign({ sub: '99999' }, SECRET);
  res = await call('GET', '/api/auth/me', { token: orphan });
  assert.equal(res.status, 401, 'valid signature but deleted/unknown user must be rejected');
});

test('protected route with valid token returns the profile (no password data)', async () => {
  const token = await registerAndLogin(alice);
  const res = await call('GET', '/api/auth/me', { token });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.email, alice.email);
  assert.equal(res.json.user.phone, alice.phone);
  assert.ok(!res.text.includes('password'));
});

// ---------------------------------------------------------------- jobs
test('GET /api/jobs lists all seeded jobs (public)', async () => {
  const res = await call('GET', '/api/jobs');
  assert.equal(res.status, 200);
  assert.equal(res.json.count, 8);
  assert.equal(res.json.jobs.length, 8);
  const j = res.json.jobs[0];
  for (const k of ['id', 'title', 'company', 'location', 'type', 'description']) assert.ok(k in j);
});

test('seeded jobs match src/data/jobs.js (no existing jobs lost)', async () => {
  const file = path.resolve(__dirname, '../../src/data/jobs.js');
  if (!fs.existsSync(file)) return; // backend deployed on its own
  const { default: original } = await import(pathToFileURL(file).href);
  const res = await call('GET', '/api/jobs');
  assert.equal(res.json.count, original.length);
  for (const o of original) {
    const got = res.json.jobs.find((j) => j.id === o.id);
    assert.ok(got, `job ${o.id} missing`);
    for (const k of ['title', 'company', 'location', 'type', 'description']) assert.equal(got[k], o[k]);
  }
});

test('GET /api/jobs search & filter', async () => {
  let res = await call('GET', '/api/jobs?search=developer');
  assert.ok(res.json.count >= 3);
  assert.ok(res.json.jobs.every((j) => /developer/i.test(j.title + j.company + j.location)));

  res = await call('GET', '/api/jobs?type=Internship');
  assert.equal(res.json.count, 2);
  assert.ok(res.json.jobs.every((j) => j.type === 'Internship'));

  res = await call('GET', '/api/jobs?search=bangalore&type=Full%20Time');
  assert.equal(res.json.count, 1);
  assert.equal(res.json.jobs[0].title, 'Frontend Developer');

  res = await call('GET', '/api/jobs?location=Remote');
  assert.equal(res.json.count, 1);

  res = await call('GET', '/api/jobs?type=All');
  assert.equal(res.json.count, 8);

  res = await call('GET', '/api/jobs?search=zzzz-no-match');
  assert.equal(res.status, 200);
  assert.equal(res.json.count, 0);

  res = await call('GET', '/api/jobs?search=%25');
  assert.equal(res.json.count, 0, '% must be treated literally, not as a wildcard');

  res = await call('GET', "/api/jobs?search=' OR 1=1 --");
  assert.equal(res.json.count, 0, 'SQL injection attempt must not match anything');

  res = await call('GET', '/api/jobs?type=Bogus');
  assert.equal(res.status, 400);
});

test('GET /api/jobs/:id returns details, 404 and 400 as appropriate', async () => {
  let res = await call('GET', '/api/jobs/1');
  assert.equal(res.status, 200);
  assert.equal(res.json.job.id, 1);
  assert.equal(res.json.job.title, 'Frontend Developer');

  res = await call('GET', '/api/jobs/9999');
  assert.equal(res.status, 404);
  assert.equal(res.json.success, false);

  res = await call('GET', '/api/jobs/abc');
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------- applications
test('applications: unauthenticated access -> 401', async () => {
  assert.equal((await call('POST', '/api/applications', { body: { jobId: 1 } })).status, 401);
  assert.equal((await call('GET', '/api/applications')).status, 401);
});

test('applications: apply succeeds (201) and stores user_id/job_id/status/timestamp', async () => {
  const token = await registerAndLogin(alice);
  const res = await call('POST', '/api/applications', { token, body: { jobId: 1 } });
  assert.equal(res.status, 201);
  assert.equal(res.json.application.jobId, 1);
  assert.equal(res.json.application.status, 'Applied');
  assert.ok(res.json.application.appliedAt);
  assert.equal(res.json.application.job.title, 'Frontend Developer');

  const row = ctx.db.prepare('SELECT * FROM applications WHERE id = ?').get(res.json.application.id);
  assert.equal(row.job_id, 1);
  assert.equal(row.status, 'Applied');
  assert.ok(row.user_id);
  assert.ok(row.applied_at);
});

test('applications: duplicate application -> 409', async () => {
  const token = await registerAndLogin(alice);
  const res = await call('POST', '/api/applications', { token, body: { jobId: 1 } });
  assert.equal(res.status, 409);
  assert.equal(res.json.success, false);
  const count = ctx.db.prepare('SELECT COUNT(*) AS n FROM applications WHERE job_id = 1').get().n;
  assert.equal(count, 1);
});

test('applications: DB-level unique constraint also blocks duplicates', () => {
  const uid = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(alice.email).id;
  assert.throws(() => ctx.db.prepare('INSERT INTO applications (user_id, job_id) VALUES (?, 1)').run(uid), /UNIQUE/);
});

test('applications: invalid / unknown jobId -> 400 / 404', async () => {
  const token = await registerAndLogin(alice);
  for (const body of [{}, { jobId: 'abc' }, { jobId: -1 }, { jobId: 1.5 }, { jobId: null }]) {
    const res = await call('POST', '/api/applications', { token, body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const res = await call('POST', '/api/applications', { token, body: { jobId: 9999 } });
  assert.equal(res.status, 404);
});

test('applications: history is per-user and ordered newest first', async () => {
  const aliceToken = await registerAndLogin(alice);
  await call('POST', '/api/applications', { token: aliceToken, body: { jobId: 3 } });

  let res = await call('GET', '/api/applications', { token: aliceToken });
  assert.equal(res.status, 200);
  assert.equal(res.json.count, 2);
  assert.deepEqual(res.json.applications.map((a) => a.jobId).sort(), [1, 3]);
  assert.ok(res.json.applications.every((a) => a.job.title && a.status && a.appliedAt));

  const bobToken = await registerAndLogin(bob);
  res = await call('GET', '/api/applications', { token: bobToken });
  assert.equal(res.json.count, 0, "Bob must not see Alice's applications");

  // a different user CAN apply to the same job
  res = await call('POST', '/api/applications', { token: bobToken, body: { jobId: 1 } });
  assert.equal(res.status, 201);
});

test("applications: GET /:id returns own (200), someone else's (403), missing (404), bad id (400)", async () => {
  const aliceToken = await registerAndLogin(alice);
  const bobToken = await registerAndLogin(bob);
  const aliceApp = (await call('GET', '/api/applications', { token: aliceToken })).json.applications[0];

  assert.equal((await call('GET', `/api/applications/${aliceApp.id}`, { token: aliceToken })).status, 200);
  const forbidden = await call('GET', `/api/applications/${aliceApp.id}`, { token: bobToken });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.json.code, 'FORBIDDEN');
  assert.equal((await call('GET', '/api/applications/99999', { token: aliceToken })).status, 404);
  assert.equal((await call('GET', '/api/applications/xyz', { token: aliceToken })).status, 400);
});

// ---------------------------------------------------------------- misc / errors
test('unknown route -> 404 JSON; wrong method -> 405', async () => {
  let res = await call('GET', '/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.json.success, false);

  res = await call('DELETE', '/api/jobs');
  assert.equal(res.status, 405);
});

test('CORS: preflight returns 204 with allow headers', async () => {
  const res = await call('OPTIONS', '/api/auth/login', {
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.match(res.headers.get('access-control-allow-headers'), /Authorization/);
});

test('500: unexpected errors are hidden behind a generic JSON message', async () => {
  const broken = createServer({ databasePath: ':memory:', jwtSecret: SECRET, quiet: true, staticDir: null });
  await new Promise((r) => broken.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${broken.server.address().port}`;
  broken.db.exec('DROP TABLE jobs'); // force a SQL failure on the next request
  const res = await fetch(`${url}/api/jobs`);
  const json = await res.json();
  assert.equal(res.status, 500);
  assert.equal(json.code, 'INTERNAL_ERROR');
  assert.ok(!/no such table|sqlite/i.test(JSON.stringify(json)), 'internal details must not leak');
  await new Promise((r) => broken.server.close(r));
});

test('security headers are set', async () => {
  const res = await call('GET', '/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
