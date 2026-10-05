'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { sign, verify, JwtError } = require('../src/utils/jwt');
const { hashPassword, verifyPassword } = require('../src/utils/password');
const { parseDuration } = require('../src/config');

const SECRET = 'unit-test-secret-value';

test('JWT: sign/verify round trip with HS256 header', () => {
  const token = sign({ sub: '1' }, SECRET, { expiresIn: 60 });
  const [h] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'HS256', typ: 'JWT' });
  const payload = verify(token, SECRET);
  assert.equal(payload.sub, '1');
  assert.ok(payload.exp > payload.iat);
});

test('JWT: matches an independently computed HMAC-SHA256 signature', () => {
  const token = sign({ sub: '7' }, SECRET);
  const [h, b, s] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  assert.equal(s, expected);
});

test('JWT: rejects wrong secret, tampering, expiry, alg=none and garbage', () => {
  const token = sign({ sub: '1' }, SECRET, { expiresIn: 60 });
  assert.throws(() => verify(token, 'other-secret'), { code: 'invalid_signature' });

  const [h, , s] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: '999', exp: 9999999999 })).toString('base64url');
  assert.throws(() => verify(`${h}.${forged}.${s}`, SECRET), { code: 'invalid_signature' });

  const expired = sign({ sub: '1' }, SECRET, { expiresIn: 10, now: Date.now() - 60_000 });
  assert.throws(() => verify(expired, SECRET), { code: 'expired' });

  const none = [
    Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'),
    Buffer.from('{"sub":"1","exp":9999999999}').toString('base64url'),
    'x',
  ].join('.');
  assert.throws(() => verify(none, SECRET), { code: 'unsupported_alg' });

  for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', undefined, null, 42]) {
    assert.throws(() => verify(bad, SECRET), JwtError);
  }
});

test('Password: scrypt hash is salted, verifiable and never plain text', async () => {
  const h1 = await hashPassword('secret123');
  const h2 = await hashPassword('secret123');
  assert.match(h1, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!h1.includes('secret123'));
  assert.notEqual(h1, h2, 'salts must differ');
  assert.equal(await verifyPassword('secret123', h1), true);
  assert.equal(await verifyPassword('wrong', h1), false);
  assert.equal(await verifyPassword('secret123', 'garbage'), false);
  assert.equal(await verifyPassword('secret123', null), false);
});

test('Config: parseDuration', () => {
  assert.equal(parseDuration('3600'), 3600);
  assert.equal(parseDuration('30m'), 1800);
  assert.equal(parseDuration('2h'), 7200);
  assert.equal(parseDuration('1d'), 86400);
  assert.equal(parseDuration(undefined, 99), 99);
  assert.throws(() => parseDuration('abc'));
});
