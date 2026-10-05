'use strict';

const { parseId, JOB_TYPES } = require('../utils/validators');
const { badRequest, notFound } = require('../utils/errors');
const { publicJob } = require('../utils/serializers');

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function createJobsController({ db }) {
  const findOne = db.prepare('SELECT * FROM jobs WHERE id = ?');

  return {
    /** GET /api/jobs?search=&type=&location= */
    list(req, res) {
      const { search = '', type = '', location = '' } = req.query;
      const where = [];
      const params = [];

      const q = String(search).trim();
      if (q.length > 100) throw badRequest('Search term must be 100 characters or fewer.');
      if (q) {
        const like = `%${escapeLike(q)}%`;
        where.push(
          "(title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\')"
        );
        params.push(like, like, like);
      }

      const t = String(type).trim();
      if (t && t !== 'All') {
        if (!JOB_TYPES.includes(t)) {
          throw badRequest(`Invalid job type. Allowed: ${JOB_TYPES.join(', ')}.`, {
            type: `Must be one of: ${JOB_TYPES.join(', ')}`,
          });
        }
        where.push('type = ?');
        params.push(t);
      }

      const loc = String(location).trim();
      if (loc) {
        where.push("location LIKE ? ESCAPE '\\'");
        params.push(`%${escapeLike(loc)}%`);
      }

      const sql = `SELECT * FROM jobs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id ASC`;
      const jobs = db.prepare(sql).all(...params).map(publicJob);
      res.json(200, { count: jobs.length, jobs });
    },

    /** GET /api/jobs/:id */
    get(req, res) {
      const id = parseId(req.params.id);
      if (id === null) throw badRequest('Job id must be a positive integer.');
      const row = findOne.get(id);
      if (!row) throw notFound('Job not found.');
      res.json(200, { job: publicJob(row) });
    },
  };
}

module.exports = { createJobsController };
