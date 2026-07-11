import { test, expect } from "@playwright/test";

test.describe("smoke SaaS honesty", () => {
  test("landing is honest and links to demo/signup", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /XML Fiscal Intelligence/i })).toBeVisible();
    await expect(page.getByText(/rastreabilidade/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Criar conta/i }).first()).toBeVisible();
    await expect(page.getByText(/SPED com um clique/i)).toHaveCount(0);
  });

  test("app overview shows local persistence posture", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Visão geral/i })).toBeVisible();
    await expect(page.getByText(/IndexedDB|navegador/i).first()).toBeVisible();
  });

  test("billing demo does not claim active subscription", async ({ page }) => {
    await page.goto("/app/billing");
    await expect(page.getByRole("heading", { name: /Planos/i })).toBeVisible();
    await expect(page.getByText(/demonstração|indisponível|Stripe/i).first()).toBeVisible();
  });

  test("EFD page shows diagnostic banner", async ({ page }) => {
    await page.goto("/app/obligations/efd-icms-ipi");
    await expect(page.getByText(/pré-validação interna/i).first()).toBeVisible();
    await expect(page.getByText(/PVA oficial/i).first()).toBeVisible();
  });

  test("health endpoint responds", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.status).toBe("ok");
  });
});
