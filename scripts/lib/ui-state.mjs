// scripts/lib/ui-state.mjs
//
// Deterministic UI-capture state definitions shared by the screenshot harness
// (scripts/screenshots-all.mjs) and the matrix verifier (scripts/verify-screenshot-matrix.mjs).
//
// Honest state model (see docs/production-readiness/* for rationale):
//   - The app's default per-route render is uniform; the only surfaces that are
//     genuinely different and reproducible are:
//       * "guest"  -> a logged-out navigation (fresh context, no auth).
//       * "error"  -> navigation to a non-existent sub-path (app not-found surface).
//   - Routes under GATED_PREFIXES are protected by src/lib/auth/middleware.ts and
//     always surface the login gate in this environment (no Supabase session),
//     so both states legitimately render the auth gate. They are exempt from the
//     "states must differ" check (documented, not hidden).

export const ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/app",
  "/app/upload",
  "/app/reconciliation",
  "/app/closing",
  "/app/batches",
  "/app/companies",
  "/app/billing",
  "/app/settings",
];

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
};

export const STATES = ["guest", "error"];

// Mirrors the protected set in src/lib/auth/middleware.ts.
export const GATED_PREFIXES = [
  "/app/saas",
  "/app/billing",
  "/app/companies",
  "/app/admin",
  "/app/obligations",
];

// Routes whose normal render IS the auth surface (landing on /login is expected,
// not a redirect bug).
export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

export function isGated(route) {
  return GATED_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`));
}

// The concrete path to navigate for a given (route, state).
export function resolveTarget(route, state) {
  if (state === "error") return `${route}/__notfound__`;
  return route;
}

// Expected landing: gated routes always render the auth gate (any state), and
// the auth-family routes legitimately surface /login. Any other non-gated route
// landing on /login would be an unexpected redirect-to-login bug.
export function expectLogin(route, state) {
  if (isGated(route)) return true;
  if (AUTH_ROUTES.includes(route)) return true;
  return false;
}
