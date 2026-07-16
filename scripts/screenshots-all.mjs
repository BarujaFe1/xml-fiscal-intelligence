// scripts/screenshots-all.mjs
//
// Playwright screenshot harness for UI-capture evidence.
//
// Captures a complete, honest matrix across:
//   - 3 engine families: chromium, firefox, webkit
//   - 3 viewports: desktop, tablet, mobile
//   - 2 states: guest (logged-out) and error (not-found surface)
//   - 11 routes (see scripts/lib/ui-state.mjs)
//
// Key correctness properties (vs the previous broken harness):
//   - Runs against an ALREADY-RUNNING app (run `npm run build && npm run start`
//     first) so production output is captured (no Next dev indicator).
//   - Records the final URL and HTTP status per shot, and captures page errors
//     and console errors so the matrix verifier can fail on redirect-to-login
//     bugs and runtime exceptions.
//   - Axe is run across the FULL matrix (every engine/viewport/state/route), not
//     just chromium/desktop/empty+restricted.
//
// Output under artifacts/ui-capture/after/:
//   per-route PNGs, index.html (gallery + Axe summary), manifest.json,
//   axe-report.json, contact-sheet.html (thumbnail grid).
//
// Run: npm run screenshots:all   (or: node scripts/screenshots-all.mjs)
// Env: BASE_URL (default http://127.0.0.1:3000), ENGINES/VIEWPORTS/STATES filters.

import { chromium, firefox, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ROUTES,
  VIEWPORTS,
  STATES,
  isGated,
  resolveTarget,
  expectLogin,
} from "./lib/ui-state.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUT_DIR = join(REPO_ROOT, "artifacts", "ui-capture", "after");

const ENGINE_FILTER = (process.env.ENGINES || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const VIEWPORT_FILTER = (process.env.VIEWPORTS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const STATE_FILTER = (process.env.STATES || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const ENGINES = [
  { name: "chromium", launcher: chromium },
  { name: "firefox", launcher: firefox },
  { name: "webkit", launcher: webkit },
].filter((e) => ENGINE_FILTER.length === 0 || ENGINE_FILTER.includes(e.name));

const ACTIVE_VIEWPORTS = VIEWPORT_FILTER.length
  ? Object.fromEntries(Object.entries(VIEWPORTS).filter(([k]) => VIEWPORT_FILTER.includes(k)))
  : VIEWPORTS;
const ACTIVE_STATES = STATE_FILTER.length ? STATE_FILTER : STATES;

function classifyImpact(violations) {
  const out = { critical: [], serious: [], moderate: [], minor: [] };
  for (const v of violations) {
    const bucket = v.impact && out[v.impact] ? v.impact : "minor";
    out[bucket].push(v.id);
  }
  return out;
}

async function reachable(url) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    return res.ok || [200, 301, 302, 401, 403].includes(res.status);
  } catch {
    return false;
  }
}

async function capturePage(page, engine, route, viewportName, state, axeReport, shots, issues) {
  const target = resolveTarget(route, state);
  const shotName = `${engine}_${viewportName}_${state}${route.replace(/\//g, "_") || "_root"}.png`;
  const shotPath = join(OUT_DIR, shotName);

  const pageErrors = [];
  const consoleErrors = [];
  page.removeAllListeners("pageerror");
  page.removeAllListeners("console");
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  try {
    const navUrl = new URL(target, BASE_URL).href;
    const res = await page.goto(navUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: shotPath, fullPage: false });

    let axe = { violations: [], classification: classifyImpact([]), error: null };
    try {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      axe = {
        violations: results.violations,
        classification: classifyImpact(results.violations),
        error: null,
      };
    } catch (err) {
      axe = { violations: [], classification: classifyImpact([]), error: String(err?.message || err) };
    }

    const finalUrl = page.url();
    const landedLogin = finalUrl.includes("/login");
    const expectedLogin = expectLogin(route, state);

    // Unexpected redirect-to-login: a non-gated route that is NOT supposed to be
    // behind auth but landed on /login anyway.
    if (landedLogin && !expectedLogin) {
      issues.push({
        type: "unexpected-login-redirect",
        engine, route, viewport: viewportName, state, finalUrl,
      });
    }
    if (pageErrors.length) {
      issues.push({
        type: "page-error",
        engine, route, viewport: viewportName, state, errors: pageErrors,
      });
    }

    axeReport.push({
      engine,
      viewport: viewportName,
      state,
      route,
      url: target,
      finalUrl,
      landedLogin,
      expectedLogin,
      gated: isGated(route),
      httpStatus: res?.status() ?? null,
      axe: axe.classification,
      violationCount: axe.violations.length,
      axeError: axe.error,
      pageErrors,
      consoleErrors,
    });

    shots.push({
      engine, viewport: viewportName, state, route, file: shotName, status: res?.status() ?? null,
    });

    console.log(`  [ok] ${engine}/${viewportName}/${state}${route} (${res?.status() ?? "?"})`);
  } catch (err) {
    console.warn(`  [warn] ${engine}/${viewportName}/${state}${route} failed: ${err?.message || err}`);
    issues.push({
      type: "capture-failure",
      engine, route, viewport: viewportName, state, error: String(err?.message || err),
    });
    axeReport.push({
      engine, viewport: viewportName, state, route, url: target, finalUrl: null,
      landedLogin: null, expectedLogin: expectLogin(route, state), gated: isGated(route),
      httpStatus: null, axe: classifyImpact([]), violationCount: 0, axeError: String(err?.message || err),
      pageErrors: [String(err?.message || err)], consoleErrors: [],
    });
  }
}

async function runEngine(engineDef, axeReport, shots, issues) {
  const { name, launcher } = engineDef;
  let browser;
  try {
    browser = await launcher.launch({ headless: true });
  } catch (err) {
    console.warn(
      `[warn] browser engine "${name}" could not launch (likely not installed): ${err?.message || err}. ` +
        `Skipping ${name}. Install with: npx playwright install ${name}`,
    );
    issues.push({ type: "engine-unavailable", engine: name, error: String(err?.message || err) });
    return false;
  }

  try {
    for (const route of ROUTES) {
      for (const viewportName of Object.keys(ACTIVE_VIEWPORTS)) {
        for (const state of ACTIVE_STATES) {
          const context = await browser.newContext({ viewport: VIEWPORTS[viewportName] });
          const page = await context.newPage();
          await capturePage(page, name, route, viewportName, state, axeReport, shots, issues);
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return true;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[screenshots-all] BASE_URL=${BASE_URL}`);

  const ok = await reachable(BASE_URL);
  if (!ok) {
    console.error(
      `[error] Cannot connect to ${BASE_URL}. Start the app first ` +
        "`npm run build && npm run start`. Aborting screenshot capture.",
    );
    process.exitCode = 2;
    return;
  }

  const axeReport = [];
  const shots = [];
  const issues = [];

  for (const engineDef of ENGINES) {
    console.log(`[engine] ${engineDef.name}`);
    await runEngine(engineDef, axeReport, shots, issues);
  }

  const summary = {
    total: axeReport.length,
    withViolations: axeReport.filter((r) => r.violationCount > 0).length,
    critical: axeReport.reduce((s, r) => s + (r.axe?.critical?.length || 0), 0),
    serious: axeReport.reduce((s, r) => s + (r.axe?.serious?.length || 0), 0),
    moderate: axeReport.reduce((s, r) => s + (r.axe?.moderate?.length || 0), 0),
    errors: axeReport.filter((r) => r.axeError).length,
    pageErrors: axeReport.reduce((s, r) => s + (r.pageErrors?.length || 0), 0),
  };

  const manifest = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    routes: ROUTES,
    viewports: VIEWPORTS,
    engines: ENGINES.map((e) => e.name),
    states: STATES,
    gatedRoutes: ROUTES.filter(isGated),
    shotCount: shots.length,
    axeSummary: summary,
    issues,
    notes:
      "States: 'guest' = logged-out navigation; 'error' = not-found surface. " +
      "Gated routes (/app/billing, /app/companies, /app/obligations/*) legitimately " +
      "render the auth gate in this environment (no Supabase session). " +
      "Captured against a running production build (npm run start).",
  };

  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  writeFileSync(join(OUT_DIR, "axe-report.json"), JSON.stringify(axeReport, null, 2) + "\n", "utf8");

  const galleryRows = shots
    .map(
      (s) => `    <tr>
      <td>${s.engine}</td><td>${s.viewport}</td><td>${s.state}</td>
      <td><a href="${s.route}">${s.route}</a></td><td>${s.status ?? "?"}</td>
      <td><a href="./${s.file}">${s.file}</a></td>
    </tr>`,
    )
    .join("\n");

  const indexHtml = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>UI Capture — After (gallery + Axe)</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
  h1 { font-size: 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 0.85rem; }
  th { background: #f4f4f4; }
  .summary { background: #fafafa; border: 1px solid #ddd; padding: 1rem; border-radius: 8px; }
  a { color: #0a58ca; }
</style>
</head>
<body>
  <h1>UI Capture — After</h1>
  <div class="summary">
    <p><strong>Base URL:</strong> ${BASE_URL}</p>
    <p><strong>Generated:</strong> ${manifest.generatedAt}</p>
    <p><strong>Gated routes (auth gate):</strong> ${manifest.gatedRoutes.join(", ") || "none"}</p>
    <p><strong>Axe summary:</strong>
      total=${summary.total}, with violations=${summary.withViolations},
      critical=${summary.critical}, serious=${summary.serious},
      moderate=${summary.moderate}, engine errors=${summary.errors}, page errors=${summary.pageErrors}
    </p>
    <p>See <a href="./contact-sheet.html">contact-sheet.html</a> for the thumbnail grid and
      <a href="./axe-report.json">axe-report.json</a> for the raw report.</p>
  </div>
  <table>
    <thead><tr><th>Engine</th><th>Viewport</th><th>State</th><th>Route</th><th>HTTP</th><th>Shot</th></tr></thead>
    <tbody>
${galleryRows}
    </tbody>
  </table>
</body>
</html>
`;
  writeFileSync(join(OUT_DIR, "index.html"), indexHtml, "utf8");

  const cells = shots
    .map(
      (s) => `      <figure style="margin:0">
        <img src="./${s.file}" alt="${s.engine} ${s.viewport} ${s.state} ${s.route}"
             style="width:100%; border:1px solid #ccc; border-radius:6px;" loading="lazy" />
        <figcaption style="font-size:0.7rem; color:#555; margin-top:4px;">
          ${s.engine} · ${s.viewport} · ${s.state} · ${s.route}
        </figcaption>
      </figure>`,
    )
    .join("\n");

  const contactSheet = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>UI Capture — Contact Sheet</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  h1 { font-size: 1.5rem; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-top: 1rem; }
  figure { background:#fff; padding:8px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
</style>
</head>
<body>
  <h1>UI Capture — Contact Sheet (${shots.length} shots)</h1>
  <div class="grid">
${cells}
  </div>
</body>
</html>
`;
  writeFileSync(join(OUT_DIR, "contact-sheet.html"), contactSheet, "utf8");

  console.log(
    `[screenshots-all] done. ${shots.length} shots; axe: critical=${summary.critical} ` +
      `serious=${summary.serious} moderate=${summary.moderate}; engine errors=${summary.errors}; page errors=${summary.pageErrors}`,
  );
  console.log(`[screenshots-all] output written to ${OUT_DIR}`);
  if (issues.length) {
    console.warn(`[screenshots-all] ${issues.length} issue(s) recorded (see manifest.json > issues).`);
  }
}

main().catch((err) => {
  console.error("[screenshots-all] fatal error:", err);
  process.exitCode = 1;
});
