'use strict';
/**
 * Small RFC 7519 / RFC 7515 compliant HS256 JWT implementation using node:crypto.
 */
const crypto = require('node:crypto');

class JwtError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'JwtError';
    this.code = code; // 'malformed' | 'unsupported_alg' | 'invalid_signature' | 'expired' | 'not_active'
  }
}

const b64url = (input) => Buffer.from(input).toString('base64url');
const hmac = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest();

function sign(payload, secret, { expiresIn = 3600, now = Date.now() } = {}) {
  if (!secret) throw new Error('JWT secret is required');
  const iat = Math.floor(now / 1000);
  const body = { ...payload, iat, exp: iat + expiresIn };
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${head}.${b64url(JSON.stringify(body))}`;
  return `${data}.${b64url(hmac(data, secret))}`;
}

function parseJson(segment) {
  try {
    const value = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    /* fall through */
  }
  throw new JwtError('malformed', 'Malformed token');
}

function verify(token, secret, { now = Date.now() } = {}) {
  if (typeof token !== 'string') throw new JwtError('malformed', 'Malformed token');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) {
    throw new JwtError('malformed', 'Malformed token');
  }
  const [head, body, sig] = parts;
  const header = parseJson(head);
  // Strict algorithm check: blocks "none" and algorithm-confusion attacks.
  if (header.alg !== 'HS256') throw new JwtError('unsupported_alg', 'Unsupported algorithm');

  const expected = hmac(`${head}.${body}`, secret);
  const actual = Buffer.from(sig, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new JwtError('invalid_signature', 'Invalid token signature');
  }

  const payload = parseJson(body);
  const nowSec = Math.floor(now / 1000);
  if (typeof payload.exp !== 'number' || nowSec >= payload.exp) {
    throw new JwtError('expired', 'Token has expired');
  }
  if (typeof payload.nbf === 'number' && nowSec < payload.nbf) {
    throw new JwtError('not_active', 'Token is not active yet');
  }
  return payload;
}

module.exports = { sign, verify, JwtError };
