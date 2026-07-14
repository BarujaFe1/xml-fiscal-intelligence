import { test, expect } from "@playwright/test";

test.describe("smoke SaaS honesty", () => {
  test("landing is honest and links to demo/signup", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /XML Fiscal Intelligence/i })).toBeVisible();
    await expect(page.getByText(/rastreabilidade/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Criar conta/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /SPED com um clique/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /SPED com um clique/i })).toHaveCount(0);
  });

  test("app overview shows local persistence posture", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Visão geral/i })).toBeVisible();
    await expect(page.getByText(/IndexedDB|navegador/i).first()).toBeVisible();
  });

  test("billing gated by auth when Supabase configured; demo path is honest", async ({ page }) => {
    await page.goto("/app/billing");
    const login = page.getByRole("heading", { name: /^Entrar$/i });
    const plans = page.getByRole("heading", { name: /Planos|Assinatura/i });
    await expect(login.or(plans)).toBeVisible();
    if (await login.isVisible()) {
      await expect(page.getByRole("link", { name: /Continuar sem login/i })).toBeVisible();
      return;
    }
    await expect(page.getByText(/demonstração|Stripe|assinatura/i).first()).toBeVisible();
  });

  test("EFD page: auth gate or honesty banner with PVA", async ({ page }) => {
    await page.goto("/app/obligations/efd-icms-ipi");
    const login = page.getByRole("heading", { name: /^Entrar$/i });
    if (await login.isVisible()) {
      await expect(page.getByRole("link", { name: /Continuar sem login/i })).toBeVisible();
      return;
    }
    await expect(page.getByText(/PVA oficial|pré-validação|Níveis:/i).first()).toBeVisible();
  });

  test("health endpoint responds", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.status).toBe("ok");
  });
});

test.describe("phase surfaces F10–F17", () => {
  const pages: Array<{ path: string; heading: RegExp }> = [
    { path: "/app/continuous-ops", heading: /Ops contínua|Operação contínua|Continuous/i },
    { path: "/app/governance", heading: /Governança/i },
    { path: "/app/enterprise", heading: /Enterprise/i },
    { path: "/app/scale", heading: /Scale|DR/i },
    { path: "/app/ecosystem", heading: /Ecosystem/i },
    { path: "/app/compliance", heading: /Compliance/i },
    { path: "/app/growth", heading: /Growth/i },
    { path: "/app/assurance", heading: /Assurance/i },
    { path: "/app/m", heading: /Fechamento/i },
    { path: "/app/homologation", heading: /Homologação/i },
  ];

  for (const p of pages) {
    test(`${p.path} renders without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      const res = await page.goto(p.path);
      expect(res?.ok() || res?.status() === 304).toBeTruthy();
      await expect(page.getByRole("heading", { name: p.heading }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/Application error|Unhandled Runtime Error/i)).toHaveCount(0);
      expect(errors, errors.join(" | ")).toEqual([]);
    });
  }

  test("assurance does not claim SOC2 certified", async ({ page }) => {
    await page.goto("/app/assurance");
    await expect(page.getByText(/soc2Certified=false|sem relatório SOC2|não emite/i).first()).toBeVisible();
  });
});
