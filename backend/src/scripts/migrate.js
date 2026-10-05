'use strict';
const { loadConfig, loadEnvFile } = require('../config');
const { openDatabase, migrate } = require('../db');

loadEnvFile();
const config = loadConfig(process.env, { quiet: true, jwtSecret: process.env.JWT_SECRET || 'migrate-only' });
const db = openDatabase(config.databasePath);
migrate(db);
console.log(`Database schema is up to date: ${config.databasePath}`);
db.close();
