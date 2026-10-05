'use strict';
const { loadConfig, loadEnvFile } = require('../config');
const { openDatabase, migrate, seedJobs, loadSeedJobs } = require('../db');

loadEnvFile();
const config = loadConfig(process.env, { quiet: true, jwtSecret: process.env.JWT_SECRET || 'seed-only' });
const db = openDatabase(config.databasePath);
migrate(db);

const jobs = loadSeedJobs();
const inserted = seedJobs(db, jobs);
const total = db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n;
console.log(`Database: ${config.databasePath}`);
console.log(`Seed complete: ${inserted} new job(s) inserted, ${jobs.length - inserted} already present, ${total} total.`);
db.close();
