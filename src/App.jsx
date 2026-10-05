import { useEffect } from "react";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { useAuth } from "./context/useAuth";
import {
  isProtectedRoute,
  matchRoute,
  navigate,
  useHashPath,
} from "./router/hashRouter";

function App() {
  const path = useHashPath();
  const { isAuthenticated, initializing, flash, setFlash, clearFlash, login, register } =
    useAuth();

  const route = matchRoute(path);
  const protectedRoute = isProtectedRoute(route);
  const guestRoute = route.name === "login" || route.name === "register";

  // Route guards
  useEffect(() => {
    if (initializing) return;

    if (protectedRoute && !isAuthenticated) {
      // Keep a more specific message (e.g. "session expired") if one is already set.
      setFlash((current) => current ?? { type: "warning", text: "Please log in to continue." });
      navigate("/login", { replace: true });
    } else if (isAuthenticated && (guestRoute || route.name === "home" || route.name === "notFound")) {
      navigate("/dashboard", { replace: true });
    } else if (!isAuthenticated && (route.name === "home" || route.name === "notFound")) {
      navigate("/register", { replace: true });
    }
  }, [initializing, protectedRoute, guestRoute, isAuthenticated, route.name, setFlash]);

  const handleRegisterSuccess = async (formData) => {
    await register(formData);
    setFlash({ type: "success", text: "Registration successful! Please log in with your new account." });
    navigate("/login");
  };

  const handleLoginSuccess = async (credentials) => {
    await login(credentials);
    navigate("/dashboard");
  };

  if (initializing) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center text-muted">
          <div className="spinner-border text-primary mb-3" role="status" />
          <div>Checking your session…</div>
        </div>
      </div>
    );
  }

  if (protectedRoute) {
    if (!isAuthenticated) return null; // redirecting to /login
    return <Dashboard section={route.section} jobId={route.jobId} />;
  }

  if (route.name === "login") {
    if (isAuthenticated) return null;
    return (
      <Login
        notice={flash}
        onLoginSuccess={handleLoginSuccess}
        onGoToRegister={() => {
          clearFlash();
          navigate("/register");
        }}
      />
    );
  }

  return (
    <Register
      onRegisterSuccess={handleRegisterSuccess}
      onGoToLogin={() => {
        clearFlash();
        navigate("/login");
      }}
    />
  );
}

export default App;
