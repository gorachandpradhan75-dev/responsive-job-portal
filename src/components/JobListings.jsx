import { useEffect, useState } from "react";
import { api } from "../api/client";
import JobCard from "./JobCard";

function JobListings({ appliedJobs, onApply, applyingJobId = null }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const jobTypes = ["All", "Full Time", "Part Time", "Internship"];

  // Debounce typing so we don't call the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search / filter is performed by the backend: GET /api/jobs?search=&type=
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .getJobs({ search: debouncedSearch, type: selectedType }, controller.signal)
      .then((res) => {
        setJobs(res.jobs);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load jobs.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, selectedType, reloadKey]);

  const filteredJobs = jobs;

  return (
    <div>
      <h4 className="fw-bold text-primary mb-3">Job Listings</h4>

      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-center">
            <div className="col-md-8">
              <label htmlFor="jobSearch" className="form-label mb-1 small text-muted">
                Search Jobs
              </label>
              <input
                type="text"
                id="jobSearch"
                className="form-control"
                placeholder="Search by title, company or location"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label htmlFor="jobFilter" className="form-label mb-1 small text-muted">
                Filter by Type
              </label>
              <select
                id="jobFilter"
                className="form-select"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {jobTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {loading ? (
          <div className="col-12 text-center py-5 text-muted">
            <div className="spinner-border text-primary mb-2" role="status" />
            <div>Loading jobs...</div>
          </div>
        ) : error ? (
          <div className="col-12">
            <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Retry
              </button>
            </div>
          </div>
        ) : filteredJobs.length > 0 ? (
          filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onApply={onApply}
              isApplied={appliedJobs.some((applied) => applied.id === job.id)}
              isApplying={applyingJobId === job.id}
            />
          ))
        ) : (
          <div className="col-12">
            <div className="alert alert-warning text-center">
              No jobs found matching your search/filter.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobListings;
