'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

const PLACEHOLDER_SECRETS = new Set(['change_this_secret', 'changeme', 'secret']);

/** Minimal .env loader (no dotenv dependency). Existing process.env values win. */
function loadEnvFile(file = path.join(PROJECT_ROOT, '.env')) {
  if (!fs.existsSync(file)) return false;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

/** "3600" | "30m" | "12h" | "7d" -> seconds */
function parseDuration(input, fallbackSeconds) {
  if (input === undefined || input === null || input === '') return fallbackSeconds;
  const match = /^(\d+)\s*([smhd]?)$/i.exec(String(input).trim());
  if (!match) throw new Error(`Invalid JWT_EXPIRES_IN value: "${input}"`);
  const n = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
}

function loadConfig(env = process.env, overrides = {}) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  let jwtSecret = overrides.jwtSecret ?? env.JWT_SECRET;
  if (isProduction && (!jwtSecret || jwtSecret.length < 16 || PLACEHOLDER_SECRETS.has(jwtSecret))) {
    throw new Error(
      'JWT_SECRET must be set to a strong random value (16+ chars) when NODE_ENV=production.'
    );
  }
  if (!jwtSecret || PLACEHOLDER_SECRETS.has(jwtSecret)) {
    // Development convenience: an ephemeral secret (tokens stop working after a restart).
    jwtSecret = require('node:crypto').randomBytes(32).toString('hex');
    if (!overrides.quiet) {
      console.warn(
        '[config] JWT_SECRET is not set - using a temporary random secret. ' +
          'Copy .env.example to .env and set JWT_SECRET so logins survive restarts.'
      );
    }
  }

  const rawDb = overrides.databasePath ?? env.DATABASE_PATH ?? './database/jobportal.db';
  const databasePath =
    rawDb === ':memory:' ? rawDb : path.resolve(BACKEND_ROOT, rawDb);

  const distDir = path.join(PROJECT_ROOT, 'dist');
  let staticDir = null;
  if (overrides.staticDir !== undefined) staticDir = overrides.staticDir;
  else if (env.SERVE_FRONTEND !== 'false' && fs.existsSync(path.join(distDir, 'index.html'))) {
    staticDir = distDir;
  }

  return {
    nodeEnv,
    isProduction,
    port: Number(overrides.port ?? env.PORT ?? 5000),
    jwtSecret,
    jwtExpiresIn: parseDuration(overrides.jwtExpiresIn ?? env.JWT_EXPIRES_IN, 3600),
    databasePath,
    // "*" in development, nothing (same-origin only) in production unless CORS_ORIGIN is set
    corsOrigin: overrides.corsOrigin ?? env.CORS_ORIGIN ?? (isProduction ? '' : '*'),
    staticDir,
    quiet: Boolean(overrides.quiet),
  };
}

module.exports = { loadConfig, loadEnvFile, parseDuration, BACKEND_ROOT, PROJECT_ROOT };
