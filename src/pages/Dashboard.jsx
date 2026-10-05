import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Profile from "../components/Profile";
import JobListings from "../components/JobListings";
import JobDetails from "../components/JobDetails";
import Applications from "../components/Applications";
import { api } from "../api/client";
import { useAuth } from "../context/useAuth";
import { navigate } from "../router/hashRouter";

function Dashboard({ section = "dashboard", jobId = null }) {
  const { user, logout } = useAuth();

  // Applications now live in the database; this is just a cache of GET /api/applications.
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState("");
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retryApplications = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setAppsLoading(true);
    setAppsError("");
    api
      .getApplications(controller.signal)
      .then((res) => {
        setApplications(res.applications);
        setAppsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (err.status === 401) return; // AuthProvider redirects to login
        setAppsError(err.message || "Failed to load your applications.");
        setAppsLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  // Auto-dismiss notices
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleApply = async (job) => {
    if (applyingJobId !== null) return;
    setApplyingJobId(job.id);
    setNotice(null);
    try {
      const res = await api.apply(job.id);
      setApplications((prev) => [res.application, ...prev.filter((a) => a.jobId !== job.id)]);
      setNotice({ type: "success", text: `You applied to "${job.title}" at ${job.company}.` });
    } catch (err) {
      if (err.status === 401) return; // session expired -> redirected to login
      if (err.status === 409) {
        retryApplications(); // already applied (e.g. in another tab): re-sync from the server
        setNotice({ type: "info", text: "You have already applied to this job." });
      } else {
        setNotice({ type: "danger", text: err.message || "Could not submit your application." });
      }
    } finally {
      setApplyingJobId(null);
    }
  };

  // JobListings / JobCard expect an array of job objects the user has applied to.
  const appliedJobs = applications.map((a) => a.job);

  const renderSection = () => {
    if (jobId) {
      return (
        <JobDetails
          jobId={jobId}
          isApplied={appliedJobs.some((j) => String(j.id) === String(jobId))}
          isApplying={String(applyingJobId) === String(jobId)}
          onApply={handleApply}
        />
      );
    }

    switch (section) {
      case "profile":
        return <Profile user={user} />;
      case "jobs":
        return (
          <JobListings
            appliedJobs={appliedJobs}
            onApply={handleApply}
            applyingJobId={applyingJobId}
          />
        );
      case "applications":
        return (
          <Applications
            applications={applications}
            loading={appsLoading}
            error={appsError}
            onRetry={retryApplications}
          />
        );
      case "dashboard":
      default:
        return (
          <>
            <Profile user={user} />
            <div className="mt-4">
              <JobListings
                appliedJobs={appliedJobs}
                onApply={handleApply}
                applyingJobId={applyingJobId}
              />
            </div>
          </>
        );
    }
  };

  return (
    <div className="bg-light min-vh-100">
      <Navbar
        activeSection={section}
        onNavigate={(key) => navigate(`/${key}`)}
        onLogout={logout}
      />

      <header className="bg-primary text-white py-4 mb-4">
        <div className="container">
          <h2 className="fw-bold mb-1">Welcome, {user?.fullName || "User"} 👋</h2>
          <p className="mb-0 opacity-75">
            Find and apply to jobs that match your skills.
          </p>
        </div>
      </header>

      <main className="container pb-5">
        {notice && (
          <div
            className={`alert alert-${notice.type} alert-dismissible fade show`}
            role="alert"
          >
            {notice.text}
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => setNotice(null)}
            ></button>
          </div>
        )}
        {renderSection()}
      </main>
    </div>
  );
}

export default Dashboard;
