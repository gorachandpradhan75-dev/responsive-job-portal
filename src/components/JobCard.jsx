function JobCard({ job, onApply, isApplied, isApplying = false }) {
  const badgeClass =
    job.type === "Full Time"
      ? "bg-primary"
      : job.type === "Part Time"
      ? "bg-info text-dark"
      : "bg-warning text-dark";

  return (
    <div className="col-md-6 col-lg-4 mb-4">
      <div className="card h-100 shadow-sm border-0 rounded-4">
        <div className="card-body d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <h5 className="card-title fw-bold mb-0">{job.title}</h5>
            <span className={`badge ${badgeClass} rounded-pill`}>{job.type}</span>
          </div>
          <h6 className="card-subtitle mb-2 text-primary">{job.company}</h6>
          <p className="card-text text-muted small mb-2">
            📍 {job.location}
          </p>
          <p className="card-text flex-grow-1">{job.description}</p>
          <div className="d-flex gap-2 mt-2">
            <button
              type="button"
              className={`btn flex-grow-1 ${isApplied ? "btn-success" : "btn-primary"}`}
              onClick={() => onApply(job)}
              disabled={isApplied || isApplying}
            >
              {isApplying && (
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              )}
              {isApplied ? "Applied ✓" : isApplying ? "Applying..." : "Apply"}
            </button>
            <a href={`#/jobs/${job.id}`} className="btn btn-outline-primary">
              Details
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobCard;
