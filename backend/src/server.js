'use strict';

const http = require('node:http');
const { loadConfig, loadEnvFile } = require('./config');
const { openDatabase, migrate, seedJobs, loadSeedJobs } = require('./db');
const { createApp } = require('./app');

/**
 * Builds (but does not start) a server. Used by index start-up and by the tests.
 * Options override environment config, e.g. { databasePath: ':memory:', jwtSecret: 'x' }.
 */
function createServer(overrides = {}) {
  const config = loadConfig(process.env, overrides);
  const db = openDatabase(config.databasePath);
  migrate(db);

  const count = db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n;
  if (count === 0 && overrides.seed !== false) seedJobs(db, loadSeedJobs());

  const server = http.createServer(createApp({ db, config }));
  server.on('close', () => {
    try {
      db.close();
    } catch {
      /* already closed */
    }
  });
  return { server, db, config };
}

if (require.main === module) {
  loadEnvFile();
  const { server, config } = createServer();
  server.listen(config.port, () => {
    console.log(`Job Portal API running on http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(`Database: ${config.databasePath}`);
    if (config.staticDir) console.log(`Serving frontend from ${config.staticDir}`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { createServer };
