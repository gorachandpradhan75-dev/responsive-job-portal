'use strict';

const { validateRegistration, validateLogin } = require('../utils/validators');
const { hashPassword, verifyPassword, getDummyHash } = require('../utils/password');
const { sign } = require('../utils/jwt');
const { badRequest, unauthorized, conflict } = require('../utils/errors');
const { publicUser } = require('../utils/serializers');

const isUniqueViolation = (err) => /UNIQUE constraint failed/i.test(err?.message || '');

function createAuthController({ db, config }) {
  const findByEmail = db.prepare('SELECT id FROM users WHERE email = ?');
  const findForLogin = db.prepare('SELECT * FROM users WHERE email = ?');
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)'
  );
  const findById = db.prepare(
    'SELECT id, name, email, phone, created_at FROM users WHERE id = ?'
  );

  return {
    /** POST /api/auth/register */
    async register(req, res) {
      const { errors, value } = validateRegistration(req.body);
      if (Object.keys(errors).length) throw badRequest('Validation failed', errors);

      if (findByEmail.get(value.email)) {
        throw conflict('An account with this email already exists.', {
          email: 'An account with this email already exists.',
        });
      }

      const passwordHash = await hashPassword(value.password);
      let id;
      try {
        id = Number(insertUser.run(value.name, value.email, value.phone, passwordHash).lastInsertRowid);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw conflict('An account with this email already exists.', {
            email: 'An account with this email already exists.',
          });
        }
        throw err;
      }

      res.json(201, {
        message: 'Registration successful. You can now log in.',
        user: publicUser(findById.get(id)),
      });
    },

    /** POST /api/auth/login */
    async login(req, res) {
      const { errors, value } = validateLogin(req.body);
      if (Object.keys(errors).length) throw badRequest('Validation failed', errors);

      const user = findForLogin.get(value.email);
      // Always run a hash comparison so response time doesn't reveal whether the email exists.
      const ok = await verifyPassword(value.password, user ? user.password_hash : await getDummyHash());
      if (!user || !ok) throw unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');

      const token = sign({ sub: String(user.id), email: user.email }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
      });

      res.json(200, {
        message: 'Login successful.',
        token,
        tokenType: 'Bearer',
        expiresIn: config.jwtExpiresIn,
        user: publicUser(user),
      });
    },

    /** GET /api/auth/me (protected) */
    me(req, res) {
      res.json(200, { user: req.user });
    },
  };
}

module.exports = { createAuthController };
