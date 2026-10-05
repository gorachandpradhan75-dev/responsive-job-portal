function Profile({ user }) {
  return (
    <div className="card shadow-sm border-0 rounded-4">
      <div className="card-body p-4">
        <h4 className="fw-bold text-primary mb-4">My Profile</h4>

        <div className="d-flex align-items-center mb-4">
          <div
            className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold me-3"
            style={{ width: "64px", height: "64px", fontSize: "1.5rem" }}
          >
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <h5 className="mb-0 fw-semibold">{user?.fullName || "Guest User"}</h5>
            <p className="text-muted mb-0">Job Seeker</p>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-md-6">
            <div className="p-3 bg-light rounded-3 h-100">
              <p className="text-muted small mb-1">Full Name</p>
              <p className="fw-semibold mb-0">{user?.fullName || "N/A"}</p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="p-3 bg-light rounded-3 h-100">
              <p className="text-muted small mb-1">Email</p>
              <p className="fw-semibold mb-0">{user?.email || "N/A"}</p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="p-3 bg-light rounded-3 h-100">
              <p className="text-muted small mb-1">Phone</p>
              <p className="fw-semibold mb-0">{user?.phone || "N/A"}</p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="p-3 bg-light rounded-3 h-100">
              <p className="text-muted small mb-1">Account Status</p>
              <p className="fw-semibold mb-0">
                <span className="badge bg-success rounded-pill">Active</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
