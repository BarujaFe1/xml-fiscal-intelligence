// scripts/screenshots-all.mjs
//
// Playwright screenshot harness for before/after UI-capture evidence.
//
// - Reads BASE_URL from env (default http://localhost:3000); assumes the app
//   is ALREADY running (this script does NOT start a dev server).
// - For the 11 captured routes, captures chromium + firefox + webkit at
//   desktop / tablet / mobile viewports.
// - Captures key states where feasible: empty (default), populated (best-effort
//   via the seed module), error (a route that can show an error), restricted
//   (an /app route captured while logged-out to show redirect/403).
// - Runs @axe-core/playwright on each page and collects violations into a JSON
//   report, classifying critical / serious / moderate.
// - Writes everything under artifacts/ui-capture/after/:
//     per-route PNGs, index.html (gallery + Axe summary), manifest.json,
//     axe-report.json, contact-sheet.html (thumbnail grid).
// - If a browser engine isn't installed, the error is caught, a warning is
//   logged, and the harness continues with the other engines (no hard crash).
//
// NOTE: Browser download may be blocked in some environments. If engines are
// not installed, this script will report the missing engines and exit cleanly
// (it will NOT fabricate screenshots).
//
// Run: npm run screenshots:all   (or: node scripts/screenshots-all.mjs)

import { chromium, firefox, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = join(REPO_ROOT, "artifacts", "ui-capture", "after");

// The 11 captured routes (per the capture plan).
const ROUTES = [
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

// Viewport matrix.
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
};

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

// State variants. "restricted" performs a logged-out navigation to an /app
// route (no storage state) to surface redirect / 403 behavior. "error" tries a
// deliberately bad navigation; both are best-effort and failure-tolerant.
const STATES = ["empty", "populated", "error", "restricted"];

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
    return res.ok || res.status === 200 || res.status === 401 || res.status === 403 || res.status === 302;
  } catch {
    return false;
  }
}

async function capturePage(page, engine, route, viewportName, state, axeReport, shots) {
  // Map state -> concrete navigation behavior (best-effort).
  let target = route;
  let label = state;

  if (state === "restricted" && !route.startsWith("/app")) {
    // Only /app routes are "restricted"; skip non-app routes for this state.
    return;
  }
  if (state === "error") {
    // Best-effort: a route likely to render an error surface. Use a bogus
    // query/segment we expect the app to surface as an error when present.
    target = `${route}?__force_error=1`;
    label = "error";
  }
  if (state === "populated") {
    // Best-effort: seed data is generated locally; we simply navigate. Real
    // population depends on the app consuming private-test-data/seed. This is
    // intentionally non-fatal if nothing changes visually.
    target = route;
    label = "populated";
  }

  const shotName = `${engine}_${viewportName}_${label}${route.replace(/\//g, "_") || "_root"}.png`;
  const shotPath = join(OUT_DIR, shotName);

  try {
    await page.setViewportSize(VIEWPORTS[viewportName]);
    const navUrl = new URL(target, BASE_URL).href;
    const res = await page.goto(navUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // Give client hydration a moment.
    await page.waitForTimeout(800);

    await page.screenshot({ path: shotPath, fullPage: false });

    // Axe (skip for best-effort error navigation if page failed to load).
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

    axeReport.push({
      engine,
      viewport: viewportName,
      state: label,
      route,
      url: target,
      httpStatus: res?.status() ?? null,
      axe: axe.classification,
      violationCount: axe.violations.length,
      axeError: axe.error,
    });

    shots.push({
      engine,
      viewport: viewportName,
      state: label,
      route,
      file: shotName,
      status: res?.status() ?? null,
    });

    // eslint-disable-next-line no-console
    console.log(`  [ok] ${engine}/${viewportName}/${label}${route} (${res?.status() ?? "?"})`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`  [warn] ${engine}/${viewportName}/${label}${route} failed: ${err?.message || err}`);
    axeReport.push({
      engine,
      viewport: viewportName,
      state: label,
      route,
      url: target,
      httpStatus: null,
      axe: classifyImpact([]),
      violationCount: 0,
      axeError: String(err?.message || err),
    });
  }
}

async function runEngine(engineDef, axeReport, shots) {
  const { name, launcher } = engineDef;
  let browser;
  try {
    browser = await launcher.launch({ headless: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[warn] browser engine "${name}" could not launch (likely not installed): ${err?.message || err}. ` +
        `Skipping ${name}. Install with: npx playwright install ${name}`,
    );
    return false;
  }

  try {
    for (const route of ROUTES) {
      for (const viewportName of Object.keys(ACTIVE_VIEWPORTS)) {
        for (const state of ACTIVE_STATES) {
          // For "restricted", force a clean (logged-out) context.
          const context = await browser.newContext({
            viewport: VIEWPORTS[viewportName],
            storageState: state === "restricted" ? undefined : undefined,
          });
          const page = await context.newPage();
          await capturePage(page, name, route, viewportName, state, axeReport, shots);
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

  // eslint-disable-next-line no-console
  console.log(`[screenshots-all] BASE_URL=${BASE_URL}`);

  const ok = await reachable(BASE_URL);
  if (!ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[error] Cannot connect to ${BASE_URL}. The app must be running already ` +
        `(e.g. \`npm run start\` or \`npm run dev\`). Aborting screenshot capture.`,
    );
    process.exitCode = 2;
    return;
  }

  const axeReport = [];
  const shots = [];

  for (const engineDef of ENGINES) {
    // eslint-disable-next-line no-console
    console.log(`[engine] ${engineDef.name}`);
    await runEngine(engineDef, axeReport, shots);
  }

  // Aggregate Axe summary.
  const summary = {
    total: axeReport.length,
    withViolations: axeReport.filter((r) => r.violationCount > 0).length,
    critical: axeReport.reduce((s, r) => s + (r.axe?.critical?.length || 0), 0),
    serious: axeReport.reduce((s, r) => s + (r.axe?.serious?.length || 0), 0),
    moderate: axeReport.reduce((s, r) => s + (r.axe?.moderate?.length || 0), 0),
    errors: axeReport.filter((r) => r.axeError).length,
  };

  const manifest = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    routes: ROUTES,
    viewports: VIEWPORTS,
    engines: ENGINES.map((e) => e.name),
    states: STATES,
    shotCount: shots.length,
    axeSummary: summary,
    notes:
      "Screenshots are generated against a running app instance. 'restricted' " +
      "captures are logged-out navigations to /app routes. 'error' is a best-effort " +
      "forced-error navigation. 'populated' assumes private-test-data/seed exists.",
  };

  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  writeFileSync(join(OUT_DIR, "axe-report.json"), JSON.stringify(axeReport, null, 2) + "\n", "utf8");

  // Gallery index.html
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
    <p><strong>Axe summary:</strong>
      total=${summary.total},
      with violations=${summary.withViolations},
      critical=${summary.critical},
      serious=${summary.serious},
      moderate=${summary.moderate},
      engine errors=${summary.errors}
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

  // Contact sheet (thumbnail grid).
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

  // eslint-disable-next-line no-console
  console.log(
    `[screenshots-all] done. ${shots.length} shots; axe: critical=${summary.critical} ` +
      `serious=${summary.serious} moderate=${summary.moderate}; errors=${summary.errors}`,
  );
  // eslint-disable-next-line no-console
  console.log(`[screenshots-all] output written to ${OUT_DIR}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[screenshots-all] fatal error:", err);
  process.exitCode = 1;
});
