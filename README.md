# Responsive Job Portal — Full Stack (Experiment 6)

**Full Stack Job Portal with Authentication, Testing and Deployment**

A React + Bootstrap job portal backed by a REST API and a SQLite database, with
JWT authentication, protected routes, job search/filter/details, persistent job
applications, automated API tests, Git configuration and deployment files.

## Table of contents
1. [Overview & architecture](#1-overview--architecture)
2. [Technologies](#2-technologies)
3. [Folder structure](#3-folder-structure)
4. [Installation & setup](#4-installation--setup)
5. [Environment variables](#5-environment-variables)
6. [Database setup & seed](#6-database-setup--seed)
7. [Running (development)](#7-running-development)
8. [Authentication & JWT flow](#8-authentication--jwt-flow)
9. [API documentation](#9-api-documentation)
10. [Testing](#10-testing)
11. [Git / GitHub](#11-git--github)
12. [Production build & deployment](#12-production-build--deployment)
13. [Experiment 6 checklist](#13-experiment-6-checklist)
14. [Troubleshooting & notes](#14-troubleshooting--notes)

---

## 1. Overview & architecture

```
┌────────────────────────┐   HTTP/JSON    ┌──────────────────────────────┐   node:sqlite   ┌──────────────┐
│ React + Vite + Bootstrap│ ─────────────▶ │ Node.js REST API (backend/)  │ ──────────────▶ │ SQLite file  │
│  src/                   │ ◀───────────── │ router → middleware → ctrl   │ ◀────────────── │ users, jobs, │
│  JWT in localStorage    │  Bearer <JWT>  │ JWT (HS256) + scrypt hashing │                 │ applications │
└────────────────────────┘                └──────────────────────────────┘                 └──────────────┘
```

* **Frontend** – the original React UI (Navbar, Login, Registration, Dashboard, Job cards,
  Search/Filter, Applications, Profile) is unchanged in look and layout. Only the logic was
  connected to the API. A small hash router (`#/login`, `#/dashboard`, `#/jobs/3`, …) and an
  `AuthProvider` implement protected routes.
* **Backend** – a layered REST API: `router → middleware (CORS, JSON body, JWT) → controllers → SQLite`.
  Central error handling converts errors into consistent JSON responses.
* **Database** – SQLite via Node's built-in `node:sqlite` module.

> **Design decision – zero npm dependencies in the backend.** The sandbox this project was
> finished in had no access to the npm registry, so the backend uses only Node.js built-ins:
> `http` (Express-style router in `backend/src/router.js`), `node:sqlite`, `crypto.scrypt`
> (password hashing), `crypto` HMAC (HS256 JWT) and `node:test` (tests). This also means
> `backend/` needs **no `npm install`**. Requires **Node.js ≥ 22.13**.

## 2. Technologies

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Bootstrap 5, hash-based routing, Context API |
| Backend | Node.js (built-in `http`), REST, CORS + JSON middleware |
| Database | SQLite (`node:sqlite`) |
| Auth | JWT (HS256, `crypto`), passwords hashed with **scrypt** + per-user salt |
| Testing | `node:test` + `node:assert` + `fetch` (32 offline tests – see §10) |
| Deployment | Single-service Node host (Render blueprint), Dockerfile |

## 3. Folder structure

```
responsive-job-portal/
├── backend/
│   ├── package.json              # scripts: start, dev, migrate, seed, test
│   ├── data/jobs.seed.json       # the 8 jobs from src/data/jobs.js (seed source)
│   ├── database/                 # SQLite file is created here (git-ignored)
│   ├── src/
│   │   ├── server.js             # entry point (createServer + listen)
│   │   ├── app.js                # request pipeline: CORS, body parsing, routing, error handling
│   │   ├── router.js             # tiny Express-style router
│   │   ├── config.js             # env loading/validation (.env parser, JWT secret guard)
│   │   ├── db.js                 # schema, migrate, seed helpers
│   │   ├── static.js             # serves built frontend (dist/) in production
│   │   ├── middleware/auth.js    # JWT verification middleware
│   │   ├── controllers/          # auth, jobs, applications, health
│   │   ├── utils/                # jwt.js, password.js, validators.js, serializers.js, errors.js
│   │   └── scripts/              # migrate.js, seed.js
│   └── tests/                    # api.test.js, utils.test.js
├── src/                          # React app
│   ├── api/client.js             # fetch wrapper, ApiError, token storage
│   ├── context/                  # AuthProvider / useAuth
│   ├── router/hashRouter.js      # protected-route helpers
│   ├── components/               # Navbar, LoginForm, RegistrationForm, JobListings, JobCard,
│   │                             #   JobDetails (new), Applications, Profile
│   ├── pages/                    # Login, Register, Dashboard
│   └── data/jobs.js              # original static data (kept; now only the seed reference)
├── .env.example   .gitignore   Dockerfile   render.yaml   vite.config.js   package.json
```

## 4. Installation & setup

Requirements: **Node.js 22.13+** (`node -v`) and npm.

```bash
# from the project root
npm install          # installs the frontend (React, Vite, Bootstrap) – the backend needs nothing
cp .env.example .env # Windows (cmd):  copy .env.example .env
# edit .env and set JWT_SECRET (see §5)
```

## 5. Environment variables

Copy `.env.example` → `.env` (never commit `.env`).

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *(required in production)* | Secret used to sign JWTs. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `1h` | Token lifetime (`3600`, `30m`, `12h`, `7d`) |
| `PORT` | `5000` | API port |
| `DATABASE_PATH` | `./database/jobportal.db` | SQLite file (relative to `backend/`) |
| `NODE_ENV` | `development` | `production` enforces a strong `JWT_SECRET` |
| `CORS_ORIGIN` | `*` (dev) / none (prod) | Allowed origins, comma-separated |
| `SERVE_FRONTEND` | `true` | Serve `dist/` from the API if it exists |
| `VITE_API_URL` | *(empty)* | Build-time API base URL when frontend is hosted separately |

If `JWT_SECRET` is missing in development, a random temporary secret is used (logins are
lost on restart). In production the server **refuses to start** without a strong secret.

## 6. Database setup & seed

Tables are created automatically on server start, or explicitly with:

```bash
npm run migrate      # create tables (idempotent)
npm run seed         # create tables + insert the 8 jobs (idempotent – safe to run repeatedly)
```

Schema (`backend/src/db.js`):

* **users** – `id` PK, `name`, `email` UNIQUE (case-insensitive), `phone`, `password_hash`, `created_at`, `updated_at`
* **jobs** – `id` PK, `title`, `company`, `location`, `type` CHECK(Full Time/Part Time/Internship), `description`, `created_at`
* **applications** – `id` PK, `user_id` FK→users, `job_id` FK→jobs (both `ON DELETE CASCADE`), `status`
  CHECK(Applied/Under Review/Shortlisted/Rejected/Accepted) default `Applied`, `applied_at`,
  **UNIQUE(user_id, job_id)** (no double applications, enforced at DB level too)

Passwords are **never** stored in plain text (scrypt, N=16384, r=8, p=1, random 16-byte salt).

## 7. Running (development)

Open two terminals in the project root:

```bash
# Terminal 1 – backend  →  http://localhost:5000
npm run server            # or: npm run server:dev   (auto-restart on change)

# Terminal 2 – frontend →  http://localhost:5173
npm run dev
```

Vite proxies `/api/*` to the backend, so no CORS setup is needed in development.
Open **http://localhost:5173**, register, log in, browse and apply.

## 8. Authentication & JWT flow

```
Register  : React form → POST /api/auth/register → validate → scrypt hash → INSERT users → 201
Login     : React form → POST /api/auth/login    → find user → verify scrypt → sign JWT (HS256) → { token, user }
Storage   : token saved in localStorage["jobportal_token"], user kept in AuthProvider state
Requests  : every protected call sends  Authorization: Bearer <token>
Verify    : middleware checks format → HS256 signature (timing-safe) → exp → user still exists → req.user
Startup   : if a token is stored, GET /api/auth/me validates it before any protected page is shown
Failure   : 401 (missing / invalid / expired) → token cleared → redirect to #/login with a message
Logout    : token removed from storage, user state cleared, redirect to #/login
```

JWT payload: `{ sub: "<user id>", email, iat, exp }`. Security details: algorithm is pinned to
HS256 (blocks `alg: none`), signature compared with `crypto.timingSafeEqual`, login errors are
identical for unknown email / wrong password and a dummy hash is computed to even out timing,
all SQL uses prepared statements, `LIKE` wildcards in search input are escaped, request bodies
are limited to 1 MB, and no endpoint ever returns `password_hash`.

## 9. API documentation

Base URL: `http://localhost:5000/api`. Errors always look like
`{ "success": false, "message": "...", "code": "...", "errors": { "field": "..." } }`.

| Method | Endpoint | Auth | Description | Success | Errors |
|---|---|---|---|---|---|
| GET | `/health` | – | Service + DB status | 200 | 503 |
| POST | `/auth/register` | – | `{name,email,password,phone}` → create user | 201 | 400, 409 |
| POST | `/auth/login` | – | `{email,password}` → `{token,tokenType,expiresIn,user}` | 200 | 400, 401 |
| GET | `/auth/me` | JWT | Current user's profile | 200 | 401 |
| GET | `/jobs` | – | List jobs. Query: `search`, `type` (`Full Time`/`Part Time`/`Internship`/`All`), `location` | 200 | 400 |
| GET | `/jobs/:id` | – | Job details | 200 | 400, 404 |
| POST | `/applications` | JWT | `{jobId}` → apply | 201 | 400, 401, 404, 409 |
| GET | `/applications` | JWT | Current user's applications (with job info) | 200 | 401 |
| GET | `/applications/:id` | JWT | One application (only your own) | 200 | 400, 401, 403, 404 |

Other statuses: `405` wrong method, `413` body too large, `500` generic internal error (details never leaked).

```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"secret123","phone":"9876543210"}'
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"secret123"}'
curl http://localhost:5000/api/jobs?search=developer&type=Full%20Time
curl -X POST http://localhost:5000/api/applications -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{"jobId":1}'
```

## 10. Testing

```bash
npm test                 # from the project root (runs the backend suite)
# or
cd backend && npm test
```

No packages are needed: tests use `node:test`, `node:assert` and the global `fetch` against a
real HTTP server on an ephemeral port with an in-memory SQLite database (no files touched).

Covered: health · registration (success, validation, duplicate incl. case-insensitive, hashed storage) ·
login (success, wrong password, unknown email, missing fields) · JWT (missing, malformed, wrong secret,
tampered, expired, `alg:none`, deleted user) · protected route with/without token · job list, search,
filter, SQL-injection/wildcard handling · seeded jobs equal `src/data/jobs.js` · job details (200/404/400) ·
apply · duplicate apply (API + DB constraint) · invalid/unknown job · per-user application history ·
403 on another user's application · 404/405/CORS/500 handling.

The frontend has no unit tests; verify it with `npm run build` and by walking the workflow in §7 (register → login → browse → search → details → apply → applications → logout).

## 11. Git / GitHub

`.gitignore` already excludes `node_modules/`, `.env*` (except `.env.example`), `dist/`, and SQLite
files (`*.db`, `*.db-wal`, `*.db-shm`).

```bash
git init
git add .
git status                                  # confirm .env, node_modules and *.db are NOT listed
git commit -m "Experiment 6: full-stack job portal with auth, tests and deployment config"
git branch -M main
git remote add origin https://github.com/<your-username>/responsive-job-portal.git
git push -u origin main
```

Optional feature-branch workflow:

```bash
git checkout -b feature/my-change
git add . && git commit -m "Describe change"
git push -u origin feature/my-change        # then open a Pull Request on GitHub
```

Never commit real secrets. If a secret is ever committed, rotate it.

## 12. Production build & deployment

### Build & run locally in production mode
```bash
npm install
npm run build                                # → dist/
# set a strong JWT_SECRET and NODE_ENV=production (in .env or your shell), then:
npm start                                    # API + built frontend on http://localhost:5000
```
When `dist/` exists the backend serves it, so one process hosts everything (same origin, no CORS).

### Option A – Render (single service, included `render.yaml`)
1. Push the repo to GitHub.
2. Render → **New → Blueprint** → select the repo (uses `render.yaml`: build `npm install && npm run build`, start `npm start`, health check `/api/health`, auto-generated `JWT_SECRET`, 1 GB disk at `/var/data` for SQLite).
3. Open the service URL. Seed runs automatically on first start (jobs table empty).
> SQLite needs a persistent disk; free tiers without a disk lose data on redeploy.

### Option B – Docker
```bash
docker build -t job-portal .
docker run -p 5000:5000 -e JWT_SECRET=<long-random-string> -v jobportal-data:/data job-portal
```

### Option C – Split hosting (static frontend + API)
* **Backend** on any Node 22.13+ host (Railway, Render, VPS): start command `npm start`,
  env `NODE_ENV=production`, `JWT_SECRET`, `DATABASE_PATH` (on a persistent volume),
  `CORS_ORIGIN=https://<your-frontend-domain>`.
* **Frontend** on Netlify/Vercel/GitHub Pages: build `npm run build`, publish `dist/`, and set
  `VITE_API_URL=https://<your-api-domain>` **before building**. Hash routing needs no rewrite rules.

## 13. Experiment 6 checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Backend (Node.js REST API, CORS, JSON, error handling, `/api/health`) | ✅ `backend/src/` |
| 2 | SQLite with users / jobs / applications, PK/FK/timestamps/constraints, seeded jobs | ✅ `db.js`, `npm run seed` |
| 3 | `POST /api/auth/register` with validation, duplicate check, hashing | ✅ scrypt |
| 4 | `POST /api/auth/login`, JWT, middleware, `JWT_SECRET` env, `.env.example` | ✅ HS256 |
| 5 | Frontend register/login connected to API (no fake auth) | ✅ `AuthProvider` |
| 6 | Protected routes + redirect/message on missing/invalid/expired JWT | ✅ `App.jsx` guard |
| 7 | `GET /api/jobs`, `GET /api/jobs/:id`, search/filter | ✅ |
| 8 | `POST/GET /api/applications`, no duplicates, status + timestamp | ✅ |
| 9 | Profile from authenticated data, no password data | ✅ `/auth/me` |
| 10 | Logout clears token/state, redirects | ✅ |
| 11 | 400/401/403/404/409/500 + network failure handled with friendly UI | ✅ |
| 12 | Loading states | ✅ spinners on jobs, details, applications, forms, apply |
| 13 | Automated tests + `npm test` | ✅ `node:test` |
| 14 | Workflow verification | ✅ see §10 / project report |
| 15 | Git: `.gitignore`, README Git commands | ✅ §11 |
| 16 | Deployment preparation | ✅ §12, `render.yaml`, `Dockerfile` |
| 17 | `.env.example` | ✅ |
| 18 | Documentation | ✅ this file |
| 19 | Existing UI preserved | ✅ markup/classes unchanged; additions: *Details* button, *Applied On* column, spinners |

## 14. Troubleshooting & notes

* `Cannot find module 'node:sqlite'` / `ExperimentalWarning` – upgrade to Node ≥ 22.13 (`node -v`). The warning is suppressed by the npm scripts.
* `401` right after a server restart in development – set `JWT_SECRET` in `.env` (otherwise a new random secret is generated every start).
* Port in use – change `PORT` in `.env` (the Vite proxy follows it).
* `src/data/jobs.js` is no longer imported by the UI; it is kept as the original data reference and is checked by a test against the database seed.
* There is no password-reset, email verification or rate limiting – appropriate for a coursework project; add them before real-world use.
