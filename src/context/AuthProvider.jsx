import { useCallback, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "../api/client";
import { navigate } from "../router/hashRouter";
import { AuthContext } from "./AuthContext";

// The backend returns `name`; existing UI components read `fullName`.
const normalizeUser = (u) => (u ? { ...u, fullName: u.name } : null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => tokenStore.get());
  const [user, setUser] = useState(null);
  // While a stored token is being verified we must not redirect to login.
  const [initializing, setInitializing] = useState(() => Boolean(tokenStore.get()));
  const [flash, setFlash] = useState(null); // { type: 'success'|'warning'|'info'|'danger', text }

  // Verify a stored token against the backend on first load.
  useEffect(() => {
    if (!tokenStore.get()) return undefined;
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (!cancelled) setUser(normalizeUser(res.user));
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 is handled by the "auth:unauthorized" listener below.
        if (err.status !== 401) {
          tokenStore.clear();
          setToken(null);
          setFlash({ type: "danger", text: err.message });
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any protected API call that comes back 401 (expired / invalid JWT) ends up here.
  useEffect(() => {
    const onUnauthorized = (event) => {
      setToken(null);
      setUser(null);
      setInitializing(false);
      setFlash({
        type: "warning",
        text:
          event.detail?.code === "TOKEN_EXPIRED"
            ? "Your session has expired. Please log in again."
            : "Your session is no longer valid. Please log in again.",
      });
      navigate("/login", { replace: true });
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const res = await api.login({ email, password });
    tokenStore.set(res.token);
    setToken(res.token);
    setUser(normalizeUser(res.user));
    setFlash(null);
  }, []);

  const register = useCallback(
    ({ fullName, email, password, phone }) =>
      api.register({ name: fullName, email, password, phone }),
    []
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
    setFlash({ type: "info", text: "You have been logged out." });
    navigate("/login", { replace: true });
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      initializing,
      isAuthenticated: Boolean(token && user),
      flash,
      setFlash,
      clearFlash: () => setFlash(null),
      login,
      register,
      logout,
    }),
    [user, token, initializing, flash, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
