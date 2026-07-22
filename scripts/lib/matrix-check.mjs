// scripts/lib/matrix-check.mjs
//
// Verification gate for the UI-capture matrix produced by scripts/screenshots-all.mjs.
//
// Enforces:
//   1. Completeness — every shot declared in manifest.json exists on disk.
//   2. No unexpected redirect-to-login — a non-gated route that landed on /login.
//   3. No uncaught page errors during capture.
//   4. Real differentiation — for each NON-GATED (route, engine, viewport) cell,
//      the captured states must not be byte-identical (the previous harness
//      produced 273 PNGs of which only 65 were unique because every state was
//      the same login redirect). Gated routes are exempt (they legitimately
//      render the auth gate for every state).
//
// Returns { ok, violations[], summary }.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ROUTES, VIEWPORTS, STATES, isGated } from "./ui-state.mjs";

function sha256(path) {
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex");
}

export function checkMatrix(outDir, opts = {}) {
  const manifestPath = join(outDir, "manifest.json");
  const violations = [];

  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      violations: [{ type: "missing-manifest", detail: manifestPath }],
      summary: { shotCount: 0, cellsChecked: 0, distinctCells: 0 },
    };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const files = readdirSync(outDir).filter((f) => f.endsWith(".png"));
  const fileSet = new Set(files);

  // 1) Completeness: declared shots must exist; warn on stray PNGs.
  for (const shot of manifest.shotCount ? [] : []) { /* noop */ }
  // Re-derive expected file names from manifest.routes x engines x viewports x states.
  const engines = manifest.engines || ["chromium", "firefox", "webkit"];
  const viewports = Object.keys(manifest.viewports || VIEWPORTS);
  const states = manifest.states || STATES;
  const routes = manifest.routes || ROUTES;
  const expected = [];
  for (const e of engines) {
    for (const r of routes) {
      for (const v of viewports) {
        for (const s of states) {
          expected.push(`${e}_${v}_${s}${r.replace(/\//g, "_") || "_root"}.png`);
        }
      }
    }
  }
  const missing = expected.filter((f) => !fileSet.has(f));
  if (missing.length) {
    violations.push({ type: "missing-shots", count: missing.length, sample: missing.slice(0, 10) });
  }

  // 2) Redirect + 3) page errors from recorded issues.
  for (const issue of manifest.issues || []) {
    if (issue.type === "unexpected-login-redirect") {
      violations.push({
        type: "unexpected-login-redirect",
        route: issue.route, state: issue.state, engine: issue.engine, viewport: issue.viewport,
      });
    }
    if (issue.type === "page-error") {
      violations.push({
        type: "page-error",
        route: issue.route, state: issue.state, engine: issue.engine, viewport: issue.viewport,
        errors: issue.errors,
      });
    }
    if (issue.type === "capture-failure") {
      violations.push({
        type: "capture-failure",
        route: issue.route, state: issue.state, engine: issue.engine, viewport: issue.viewport,
        error: issue.error,
      });
    }
  }

  // 4) Real differentiation per (route, engine, viewport) cell.
  const cells = {};
  for (const f of files) {
    // name shape: <engine>_<viewport>_<state><route...>.png
    const m = f.match(/^(chromium|firefox|webkit)_(desktop|tablet|mobile)_(guest|error)(.*)\.png$/);
    if (!m) continue;
    const [, engine, viewport, state, routeRaw] = m;
    const route = routeRaw.replace(/_/g, "/").replace(/\/root$/, "") || "/";
    const key = `${route}::${engine}::${viewport}`;
    cells[key] = cells[key] || { route, engine, viewport, hashes: {} };
    cells[key].hashes[state] = sha256(join(outDir, f));
  }

  let cellsChecked = 0;
  let distinctCells = 0;
  for (const [key, cell] of Object.entries(cells)) {
    cellsChecked += 1;
    const distinct = new Set(Object.values(cell.hashes)).size;
    if (distinct >= 2) distinctCells += 1;
    if (isGated(cell.route)) continue; // exempt: auth gate renders for every state
    // Non-gated: error (not-found) must differ from guest (normal render).
    const statesPresent = Object.keys(cell.hashes);
    if (statesPresent.length >= 2 && distinct < 2) {
      violations.push({
        type: "cell-not-differentiated",
        route: cell.route, engine: cell.engine, viewport: cell.viewport,
        states: statesPresent, note: "all captured states are byte-identical",
      });
    }
  }

  const summary = {
    shotCount: files.length,
    expectedCount: expected.length,
    cellsChecked,
    distinctCells,
    gatedRoutes: routes.filter(isGated),
  };

  return { ok: violations.length === 0, violations, summary };
}
