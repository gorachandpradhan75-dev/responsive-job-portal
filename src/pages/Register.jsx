import RegistrationForm from "../components/RegistrationForm";

function Register({ onRegisterSuccess, onGoToLogin }) {
  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="text-center mb-4">
              <h2 className="fw-bold text-primary">💼 Job Portal</h2>
              <p className="text-muted">Create your account to get started</p>
            </div>

            <RegistrationForm onRegisterSuccess={onRegisterSuccess} />

            <p className="text-center mt-3">
              Already have an account?{" "}
              <button
                type="button"
                className="btn btn-link p-0 align-baseline"
                onClick={onGoToLogin}
              >
                Login here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
