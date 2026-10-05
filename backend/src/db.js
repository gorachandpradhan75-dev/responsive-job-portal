'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  company     TEXT NOT NULL,
  location    TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('Full Time', 'Part Time', 'Internship')),
  description TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     INTEGER NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'Applied'
             CHECK (status IN ('Applied', 'Under Review', 'Shortlisted', 'Rejected', 'Accepted')),
  applied_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_type            ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id  ON applications(job_id);
`;

function openDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (databasePath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

function migrate(db) {
  db.exec(SCHEMA);
}

function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Idempotent: existing job ids are left untouched. Returns number of rows inserted. */
function seedJobs(db, jobs) {
  const insert = db.prepare(
    `INSERT INTO jobs (id, title, company, location, type, description)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`
  );
  return transaction(db, () => {
    let inserted = 0;
    for (const j of jobs) {
      inserted += Number(
        insert.run(j.id, j.title, j.company, j.location, j.type, j.description).changes
      );
    }
    return inserted;
  });
}

function loadSeedJobs() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'jobs.seed.json'), 'utf8')
  );
}

module.exports = { openDatabase, migrate, seedJobs, loadSeedJobs, transaction };
