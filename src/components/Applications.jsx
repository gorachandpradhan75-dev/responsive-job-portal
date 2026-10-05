const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";

const statusClass = (status) =>
  ({
    Applied: "bg-success",
    "Under Review": "bg-info text-dark",
    Shortlisted: "bg-primary",
    Accepted: "bg-success",
    Rejected: "bg-danger",
  })[status] || "bg-secondary";

function Applications({ applications, loading = false, error = "", onRetry }) {
  return (
    <div>
      <h4 className="fw-bold text-primary mb-3">My Applications</h4>

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
              Loading your applications...
            </div>
          ) : error ? (
            <div className="p-3">
              <div className="alert alert-danger d-flex justify-content-between align-items-center mb-0" role="alert">
                <span>{error}</span>
                {onRetry && (
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
                    Retry
                  </button>
                )}
              </div>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-4 text-center text-muted">
              You haven't applied to any jobs yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Job Title</th>
                    <th scope="col">Company</th>
                    <th scope="col">Location</th>
                    <th scope="col">Type</th>
                    <th scope="col">Applied On</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application, index) => (
                    <tr key={application.id}>
                      <td>{index + 1}</td>
                      <td className="fw-semibold">
                        <a href={`#/jobs/${application.job.id}`} className="text-decoration-none">
                          {application.job.title}
                        </a>
                      </td>
                      <td>{application.job.company}</td>
                      <td>{application.job.location}</td>
                      <td>
                        <span className="badge bg-primary rounded-pill">{application.job.type}</span>
                      </td>
                      <td>{formatDate(application.appliedAt)}</td>
                      <td>
                        <span className={`badge ${statusClass(application.status)} rounded-pill`}>
                          {application.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Applications;
