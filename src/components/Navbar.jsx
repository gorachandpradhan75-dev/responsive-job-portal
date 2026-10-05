function Navbar({ activeSection, onNavigate, onLogout }) {
  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "profile", label: "Profile" },
    { key: "jobs", label: "Jobs" },
    { key: "applications", label: "Applications" },
  ];

  const handleNavClick = (key) => {
    onNavigate(key);
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm sticky-top">
      <div className="container">
        <span className="navbar-brand fw-bold">
          <span className="me-2">💼</span>
          Job Portal
        </span>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNavbar"
          aria-controls="mainNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="mainNavbar">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-2">
            {navItems.map((item) => (
              <li className="nav-item" key={item.key}>
                <button
                  type="button"
                  className={`nav-link btn btn-link text-start ${
                    activeSection === item.key ? "fw-bold text-white" : "text-white-50"
                  }`}
                  onClick={() => handleNavClick(item.key)}
                >
                  {item.label}
                </button>
              </li>
            ))}
            <li className="nav-item ms-lg-2 mt-2 mt-lg-0">
              <button type="button" className="btn btn-light btn-sm px-3" onClick={onLogout}>
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
