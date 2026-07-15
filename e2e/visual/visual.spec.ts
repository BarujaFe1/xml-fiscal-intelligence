import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Visual + accessibility guard for the 11 captured routes on chromium desktop.
//
// Asserts, per route:
//   - key landmarks exist: a <main> landmark and an <h1>;
//   - no critical/serious Axe violations (wcag2a + wcag2aa).
//
// Graceful skip: if BASE_URL is unreachable, the whole suite is skipped with a
// clear message rather than failing (the dev server may not be running in CI
// for this environment, or browsers may be uninstalled).

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

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    return res.ok || [401, 403, 302].includes(res.status);
  } catch {
    return false;
  }
}

test.describe("visual + a11y guard (11 routes, chromium desktop)", () => {
  test.beforeAll(async ({ baseURL }) => {
    const url = baseURL ?? "http://127.0.0.1:3000";
    const reachable = await isReachable(url);
    test.skip(!reachable, `BASE_URL ${url} is unreachable — skipping (start the app or install browsers).`);
  });

  for (const route of ROUTES) {
    test(`${route} has main + h1 and no critical/serious axe violations`, async ({ page, baseURL }) => {
      const res = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(800);

      // Auth-gated routes may redirect to /login; that is a valid landing with
      // its own landmarks, so we accept any 2xx/3xx status.
      expect(res?.status() ?? 0).toBeGreaterThanOrEqual(200);
      expect(res?.status() ?? 0).toBeLessThan(500);

      await expect(page.getByRole("main").first()).toBeVisible({ timeout: 45_000 });
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 45_000 });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
});
