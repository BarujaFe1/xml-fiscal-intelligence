import { describe, expect, it, beforeEach } from "vitest";
import {
  formatBytes,
} from "@/lib/sync/migrate-local";
import {
  inferPvaStatus,
  mapPvaIssuesToInternal,
  parsePvaReportText,
} from "@/modules/obligations/efd-icms-ipi/pva/workflow";
import {
  getUsage,
  incrementUsage,
  resetUsageCountersForTests,
  currentPeriodYm,
} from "@/lib/entitlements/usage";
import { getPlanEntitlements } from "@/lib/entitlements";
import { MockBillingProvider, billingIsLive } from "@/lib/billing/provider";

describe("migrate helpers", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toMatch(/KB/);
    expect(formatBytes(3 * 1024 * 1024)).toMatch(/MB/);
  });
});

describe("PVA workflow", () => {
  it("parses ERRO/AVISO lines and maps level-3 record", () => {
    const issues = parsePvaReportText("ERRO: campo X\nAVISO: campo Y\nINFO: ok");
    expect(issues).toHaveLength(3);
    expect(inferPvaStatus(issues)).toBe("errors");
    const record = mapPvaIssuesToInternal({
      generationId: "gen1",
      pvaVersion: "PVA 5.0",
      resultStatus: inferPvaStatus(issues),
      issues,
    });
    expect(record.validationLevel).toBe(3);
    expect(record.disclaimer).toMatch(/não executa o PVA/i);
  });

  it("infers ok when empty", () => {
    expect(inferPvaStatus([])).toBe("ok");
  });
});

describe("usage counters", () => {
  beforeEach(() => resetUsageCountersForTests());

  it("increments and enforces entitlement limits concurrently", async () => {
    const entitlements = getPlanEntitlements("trial");
    const ws = "ws_test";
    const period = currentPeriodYm();
    await incrementUsage({
      workspaceId: ws,
      metric: "exports",
      entitlements,
      entitlementKey: "maxExportsPerMonth",
    });
    expect(await getUsage(ws, "exports", period)).toBe(1);

    const tasks = Array.from({ length: 5 }, () =>
      incrementUsage({
        workspaceId: ws,
        metric: "exports",
        entitlements,
        entitlementKey: "maxExportsPerMonth",
      }),
    );
    await Promise.all(tasks);
    expect(await getUsage(ws, "exports", period)).toBe(6);

    // trial maxExportsPerMonth = 20 — push over limit
    await expect(
      incrementUsage({
        workspaceId: ws,
        metric: "exports",
        amount: 20,
        entitlements,
        entitlementKey: "maxExportsPerMonth",
      }),
    ).rejects.toThrow(/Limit exceeded/);
  });
});

describe("billing live gate", () => {
  it("is not live without stripe env", () => {
    expect(billingIsLive()).toBe(false);
  });

  it("checkout redirect alone does not activate subscription", async () => {
    const p = new MockBillingProvider();
    const session = await p.createCheckoutSession({
      workspaceId: "ws1",
      customerEmail: "a@b.com",
      priceId: "price_x",
      successUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
    });
    expect(session.url).toContain("pending=1");
    const before = await p.getSubscriptionStatus("ws1");
    expect(before.status).toBe("none");

    await p.processWebhook({
      rawBody: JSON.stringify({
        id: "evt_activate",
        type: "checkout.session.completed",
        sessionId: session.sessionId,
        planId: "essencial",
      }),
      signature: "mock_valid",
    });
    const after = await p.getSubscriptionStatus("ws1");
    expect(after.status).toBe("active");
    expect(after.planId).toBe("essencial");
  });
});
