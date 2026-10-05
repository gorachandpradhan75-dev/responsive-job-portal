'use strict';

const { verify, JwtError } = require('../utils/jwt');
const { unauthorized } = require('../utils/errors');
const { publicUser } = require('../utils/serializers');

/** JWT middleware: requires "Authorization: Bearer <token>" and loads req.user. */
function createAuthMiddleware({ db, config }) {
  const findUser = db.prepare(
    'SELECT id, name, email, phone, created_at FROM users WHERE id = ?'
  );

  return function requireAuth(req) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (!header || scheme.toLowerCase() !== 'bearer' || !token) {
      throw unauthorized('Authentication required. Please log in.', 'TOKEN_MISSING');
    }

    let payload;
    try {
      payload = verify(token, config.jwtSecret);
    } catch (err) {
      if (err instanceof JwtError && err.code === 'expired') {
        throw unauthorized('Your session has expired. Please log in again.', 'TOKEN_EXPIRED');
      }
      throw unauthorized('Invalid authentication token. Please log in again.', 'TOKEN_INVALID');
    }

    const row = findUser.get(Number(payload.sub));
    if (!row) {
      throw unauthorized('Invalid authentication token. Please log in again.', 'TOKEN_INVALID');
    }
    req.user = publicUser(row);
  };
}

module.exports = { createAuthMiddleware };
