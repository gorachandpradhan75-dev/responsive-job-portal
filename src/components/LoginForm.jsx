import { useState } from "react";

function LoginForm({ onLoginSuccess, notice }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [validated, setValidated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidated(true);
    setLoginError("");

    const isValid = validateForm();
    if (!isValid) return;

    setSubmitting(true);
    try {
      await onLoginSuccess({ ...formData, email: formData.email.trim() });
    } catch (err) {
      // 401 -> wrong credentials, 0 -> network failure, etc. (message comes from the API client)
      setLoginError(err.message || "Login failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="card shadow border-0 rounded-4">
      <div className="card-body p-4 p-md-5">
        <h3 className="text-center fw-bold text-primary mb-4">Welcome Back</h3>

        {notice && !loginError && (
          <div className={`alert alert-${notice.type}`} role="alert">
            {notice.text}
          </div>
        )}

        {loginError && (
          <div className="alert alert-danger" role="alert">
            {loginError}
          </div>
        )}

        <form
          noValidate
          className={validated ? "was-validated" : ""}
          onSubmit={handleSubmit}
        >
          <div className="mb-3">
            <label htmlFor="loginEmail" className="form-label">
              Email
            </label>
            <input
              type="email"
              className={`form-control ${
                validated ? (errors.email ? "is-invalid" : "is-valid") : ""
              }`}
              id="loginEmail"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
            {errors.email && <div className="invalid-feedback">{errors.email}</div>}
          </div>

          <div className="mb-4">
            <label htmlFor="loginPassword" className="form-label">
              Password
            </label>
            <input
              type="password"
              className={`form-control ${
                validated ? (errors.password ? "is-invalid" : "is-valid") : ""
              }`}
              id="loginPassword"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
            {errors.password && (
              <div className="invalid-feedback">{errors.password}</div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2 fw-semibold"
            disabled={submitting}
          >
            {submitting && (
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            )}
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
