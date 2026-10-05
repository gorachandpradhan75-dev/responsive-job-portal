// Thin fetch wrapper for the Job Portal REST API.
// In development Vite proxies /api -> http://localhost:5000 (see vite.config.js).
// For a separately hosted frontend set VITE_API_URL=https://your-api-host at build time.
const API_ROOT = `${(import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "")}/api`;
const TOKEN_KEY = "jobportal_token";

export class ApiError extends Error {
  constructor(message, { status = 0, code, errors } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 = network failure
    this.code = code;
    this.errors = errors;
  }
}

export const tokenStore = {
  get() {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const FRIENDLY = {
  400: "Please check the information you entered and try again.",
  401: "Please log in to continue.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That already exists.",
  500: "Something went wrong on our side. Please try again later.",
};

async function request(path, { method = "GET", body, auth = true, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(
      "Unable to reach the server. Please check your connection and try again.",
      { status: 0, code: "NETWORK_ERROR" }
    );
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      (response.status >= 500 ? FRIENDLY[500] : FRIENDLY[response.status]) ||
      `Request failed (${response.status}).`;
    // An expired/invalid token on a protected call logs the user out (handled in AuthProvider).
    if (response.status === 401 && auth && token) {
      tokenStore.clear();
      window.dispatchEvent(
        new CustomEvent("auth:unauthorized", { detail: { code: data?.code, message } })
      );
    }
    throw new ApiError(message, {
      status: response.status,
      code: data?.code,
      errors: data?.errors,
    });
  }
  return data ?? {};
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me"),
  getJobs: ({ search = "", type = "" } = {}, signal) => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (type && type !== "All") params.set("type", type);
    const qs = params.toString();
    return request(`/jobs${qs ? `?${qs}` : ""}`, { auth: false, signal });
  },
  getJob: (id, signal) => request(`/jobs/${encodeURIComponent(id)}`, { auth: false, signal }),
  apply: (jobId) => request("/applications", { method: "POST", body: { jobId } }),
  getApplications: (signal) => request("/applications", { signal }),
};
