import LoginForm from "../components/LoginForm";

function Login({ onLoginSuccess, onGoToRegister, notice }) {
  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-5">
            <div className="text-center mb-4">
              <h2 className="fw-bold text-primary">💼 Job Portal</h2>
              <p className="text-muted">Login to access your dashboard</p>
            </div>

            <LoginForm onLoginSuccess={onLoginSuccess} notice={notice} />

            <p className="text-center mt-3">
              Don't have an account?{" "}
              <button
                type="button"
                className="btn btn-link p-0 align-baseline"
                onClick={onGoToRegister}
              >
                Register here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
