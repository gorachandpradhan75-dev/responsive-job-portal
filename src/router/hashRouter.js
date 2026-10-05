// Dependency-free hash router (#/login, #/dashboard, #/jobs/3 ...).
// Hash routing needs no server rewrite rules, so it works on any static host.
import { useSyncExternalStore } from "react";

const subscribe = (callback) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};
const getSnapshot = () => window.location.hash.replace(/^#/, "") || "/";

export function useHashPath() {
  return useSyncExternalStore(subscribe, getSnapshot, () => "/");
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (window.location.hash === target) return;
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

const SECTIONS = ["dashboard", "profile", "jobs", "applications"];

export function matchRoute(path) {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (clean === "/") return { name: "home" };
  if (clean === "/login") return { name: "login" };
  if (clean === "/register") return { name: "register" };
  const section = clean.slice(1);
  if (SECTIONS.includes(section)) return { name: "section", section };
  const job = /^\/jobs\/(\d+)$/.exec(clean);
  if (job) return { name: "jobDetails", section: "jobs", jobId: job[1] };
  return { name: "notFound" };
}

export const isProtectedRoute = (route) =>
  route.name === "section" || route.name === "jobDetails";
