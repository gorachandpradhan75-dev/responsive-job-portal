'use strict';

const { Router } = require('./router');
const { ApiError, badRequest, notFound } = require('./utils/errors');
const { createAuthMiddleware } = require('./middleware/auth');
const { createAuthController } = require('./controllers/auth');
const { createJobsController } = require('./controllers/jobs');
const { createApplicationsController } = require('./controllers/applications');
const { createHealthController } = require('./controllers/health');
const { createStaticHandler } = require('./static');

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return resolve({});
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new ApiError(413, 'Request body is too large.', { code: 'PAYLOAD_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(badRequest('Request body contains invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function applyCors(req, res, corsOrigin) {
  if (!corsOrigin) return; // same-origin only
  const allowed = corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (allowed.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    return;
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
}

function buildRouter({ db, config }) {
  const requireAuth = createAuthMiddleware({ db, config });
  const auth = createAuthController({ db, config });
  const jobs = createJobsController({ db });
  const applications = createApplicationsController({ db });
  const health = createHealthController({ db });

  return new Router()
    .get('/api/health', health.check)
    .post('/api/auth/register', auth.register)
    .post('/api/auth/login', auth.login)
    .get('/api/auth/me', requireAuth, auth.me)
    .get('/api/jobs', jobs.list)
    .get('/api/jobs/:id', jobs.get)
    .post('/api/applications', requireAuth, applications.create)
    .get('/api/applications', requireAuth, applications.list)
    .get('/api/applications/:id', requireAuth, applications.get);
}

/** Returns a (req, res) request listener for http.createServer(). */
function createApp({ db, config }) {
  const router = buildRouter({ db, config });
  const serveStatic = config.staticDir ? createStaticHandler(config.staticDir) : null;

  return async function handle(req, res) {
    res.json = (status, body) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
        'Cache-Control': 'no-store',
      });
      res.end(payload);
    };

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    applyCors(req, res, config.corsOrigin);

    try {
      const url = new URL(req.url, 'http://localhost');
      const { pathname } = url;

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      if (!pathname.startsWith('/api')) {
        if (serveStatic && serveStatic(req, res, pathname)) return;
        throw notFound(`Route not found: ${req.method} ${pathname}`);
      }

      const matched = router.match(req.method, pathname);
      if (!matched) throw notFound(`Route not found: ${req.method} ${pathname}`);
      if (matched.methodNotAllowed) {
        throw new ApiError(405, `Method ${req.method} not allowed on ${pathname}`, {
          code: 'METHOD_NOT_ALLOWED',
        });
      }

      req.params = matched.params;
      req.query = Object.fromEntries(url.searchParams);
      req.body = await readJsonBody(req);

      for (const handler of matched.handlers) {
        await handler(req, res);
        if (res.writableEnded) break;
      }
    } catch (err) {
      if (res.headersSent) return res.end();
      if (err instanceof ApiError) {
        return res.json(err.status, {
          success: false,
          message: err.message,
          code: err.code,
          ...(err.errors ? { errors: err.errors } : {}),
        });
      }
      if (!config.quiet) console.error('[error]', err);
      return res.json(500, {
        success: false,
        message: 'Internal server error. Please try again later.',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

module.exports = { createApp };
