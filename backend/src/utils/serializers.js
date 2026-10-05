'use strict';

/** Never include password_hash in API output. */
function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
  };
}

function publicJob(row) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    description: row.description,
    createdAt: row.created_at,
  };
}

/** Row from applications JOIN jobs (aliases: j_*). */
function publicApplication(row) {
  return {
    id: row.id,
    userId: row.user_id,
    jobId: row.job_id,
    status: row.status,
    appliedAt: row.applied_at,
    job: {
      id: row.job_id,
      title: row.j_title,
      company: row.j_company,
      location: row.j_location,
      type: row.j_type,
      description: row.j_description,
    },
  };
}

module.exports = { publicUser, publicJob, publicApplication };
