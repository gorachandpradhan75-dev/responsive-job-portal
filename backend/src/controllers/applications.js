'use strict';

const { parseId } = require('../utils/validators');
const { badRequest, notFound, conflict, forbidden } = require('../utils/errors');
const { publicApplication } = require('../utils/serializers');

const isUniqueViolation = (err) => /UNIQUE constraint failed/i.test(err?.message || '');

const SELECT = `
  SELECT a.id, a.user_id, a.job_id, a.status, a.applied_at,
         j.title AS j_title, j.company AS j_company, j.location AS j_location,
         j.type AS j_type, j.description AS j_description
  FROM applications a
  JOIN jobs j ON j.id = a.job_id`;

function createApplicationsController({ db }) {
  const jobExists = db.prepare('SELECT id FROM jobs WHERE id = ?');
  const existing = db.prepare('SELECT id FROM applications WHERE user_id = ? AND job_id = ?');
  const insert = db.prepare('INSERT INTO applications (user_id, job_id) VALUES (?, ?)');
  const byId = db.prepare(`${SELECT} WHERE a.id = ?`);
  const byUser = db.prepare(`${SELECT} WHERE a.user_id = ? ORDER BY a.applied_at DESC, a.id DESC`);

  const duplicate = () =>
    conflict('You have already applied to this job.', { jobId: 'Already applied' });

  return {
    /** POST /api/applications  { jobId } */
    create(req, res) {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const jobId = parseId(body.jobId);
      if (jobId === null) {
        throw badRequest('A valid jobId is required.', { jobId: 'jobId must be a positive integer' });
      }
      if (!jobExists.get(jobId)) throw notFound('Job not found.');
      if (existing.get(req.user.id, jobId)) throw duplicate();

      let id;
      try {
        id = Number(insert.run(req.user.id, jobId).lastInsertRowid);
      } catch (err) {
        if (isUniqueViolation(err)) throw duplicate(); // concurrent double-submit
        throw err;
      }
      res.json(201, {
        message: 'Application submitted successfully.',
        application: publicApplication(byId.get(id)),
      });
    },

    /** GET /api/applications */
    list(req, res) {
      const applications = byUser.all(req.user.id).map(publicApplication);
      res.json(200, { count: applications.length, applications });
    },

    /** GET /api/applications/:id  (403 when it belongs to someone else) */
    get(req, res) {
      const id = parseId(req.params.id);
      if (id === null) throw badRequest('Application id must be a positive integer.');
      const row = byId.get(id);
      if (!row) throw notFound('Application not found.');
      if (row.user_id !== req.user.id) throw forbidden('You can only view your own applications.');
      res.json(200, { application: publicApplication(row) });
    },
  };
}

module.exports = { createApplicationsController };
