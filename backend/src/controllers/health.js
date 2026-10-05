'use strict';

function createHealthController({ db }) {
  return {
    /** GET /api/health */
    check(req, res) {
      let database = 'connected';
      try {
        db.prepare('SELECT 1').get();
      } catch {
        database = 'unavailable';
      }
      res.json(database === 'connected' ? 200 : 503, {
        status: database === 'connected' ? 'ok' : 'degraded',
        database,
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    },
  };
}

module.exports = { createHealthController };
