import { useEffect, useState } from "react";
import { api } from "../api/client";

function JobDetails({ jobId, isApplied, isApplying, onApply }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { status, message }
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .getJob(jobId, controller.signal)
      .then((res) => {
        setJob(res.job);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError({ status: err.status, message: err.message });
        setLoading(false);
      });
    return () => controller.abort();
  }, [jobId, reloadKey]);

  const badgeClass =
    job?.type === "Full Time"
      ? "bg-primary"
      : job?.type === "Part Time"
      ? "bg-info text-dark"
      : "bg-warning text-dark";

  return (
    <div>
      <a href="#/jobs" className="btn btn-link px-0 mb-2 text-decoration-none">
        ← Back to jobs
      </a>

      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border text-primary mb-2" role="status" />
          <div>Loading job details...</div>
        </div>
      ) : error ? (
        <div
          className={`alert ${error.status === 404 ? "alert-warning" : "alert-danger"} d-flex justify-content-between align-items-center`}
          role="alert"
        >
          <span>{error.status === 404 ? "This job could not be found." : error.message}</span>
          {error.status !== 404 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <div className="card shadow-sm border-0 rounded-4">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <h4 className="fw-bold mb-0">{job.title}</h4>
              <span className={`badge ${badgeClass} rounded-pill`}>{job.type}</span>
            </div>
            <h6 className="text-primary mb-3">{job.company}</h6>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="p-3 bg-light rounded-3 h-100">
                  <p className="text-muted small mb-1">Location</p>
                  <p className="fw-semibold mb-0">📍 {job.location}</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 bg-light rounded-3 h-100">
                  <p className="text-muted small mb-1">Job Type</p>
                  <p className="fw-semibold mb-0">{job.type}</p>
                </div>
              </div>
            </div>

            <h6 className="fw-semibold">Description</h6>
            <p className="mb-4">{job.description}</p>

            <button
              type="button"
              className={`btn ${isApplied ? "btn-success" : "btn-primary"}`}
              onClick={() => onApply(job)}
              disabled={isApplied || isApplying}
            >
              {isApplying && (
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              )}
              {isApplied ? "Applied ✓" : isApplying ? "Applying..." : "Apply Now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default JobDetails;
