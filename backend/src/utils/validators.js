'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9]{10}$/;
const JOB_TYPES = ['Full Time', 'Part Time', 'Internship'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validateRegistration(body) {
  const errors = {};
  if (!isObject(body)) return { errors: { body: 'Request body must be a JSON object.' } };

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) errors.name = 'Full name is required.';
  else if (name.length > 100) errors.name = 'Full name must be 100 characters or fewer.';

  if (!email) errors.email = 'Email is required.';
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
  else if (password.length > 128) errors.password = 'Password must be 128 characters or fewer.';

  if (!phone) errors.phone = 'Phone number is required.';
  else if (!PHONE_RE.test(phone)) errors.phone = 'Enter a valid 10-digit phone number.';

  return { errors, value: { name, email, phone, password } };
}

function validateLogin(body) {
  const errors = {};
  if (!isObject(body)) return { errors: { body: 'Request body must be a JSON object.' } };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  else if (password.length > 128) errors.password = 'Password must be 128 characters or fewer.';
  return { errors, value: { email, password } };
}

/** Accepts positive integers or numeric strings. Returns null when invalid. */
function parseId(raw) {
  if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0) return raw;
  if (typeof raw === 'string' && /^[1-9][0-9]{0,15}$/.test(raw)) return Number(raw);
  return null;
}

module.exports = { validateRegistration, validateLogin, parseId, JOB_TYPES };
