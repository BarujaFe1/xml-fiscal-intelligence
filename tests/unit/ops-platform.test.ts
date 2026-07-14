import { describe, expect, it } from "vitest";
import { listCalendarCatalog, assertCalendarOverride, buildIcalReminder } from "@/modules/ops/calendar";
import { canApprove, createClosingTask, approveTask, DEFAULT_SOD_POLICY } from "@/modules/ops/sod";
import { createGeneration, diffGenerations } from "@/modules/ops/generations";
import { createEvidenceMeta, assertNoBinaryPayload } from "@/modules/ops/evidence";
import {
  sanitizeNotificationBody,
  buildNotification,
  defaultPrefs,
} from "@/modules/ops/notifications";
import {
  buildCommercialSupportMatrix,
  assertNoFalseProduction,
} from "@/modules/ops/commercial-matrix";
import { seedRegulatoryFromOfficialSources, advanceRegulatoryStatus } from "@/modules/ops/regulatory";
import { previewCsvImport } from "@/modules/ops/erp-generic";
import { authenticateApiKey } from "@/modules/ops/api-auth";
import { PLATFORM_OPS_MATURITY } from "@/modules/ops/platform";
import { NextRequest } from "next/server";

describe("Ops platform Fase 7", () => {
  it("calendário tem sourceId e não inventa dia do mês", () => {
    const rules = listCalendarCatalog();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.sourceId.startsWith("official:"))).toBe(true);
    expect(rules.every((r) => !/dia\s*\d{1,2}/i.test(r.dueRule || ""))).toBe(true);
    expect(assertCalendarOverride({ description: "x" })).toMatch(/sourceId/);
    expect(buildIcalReminder({
      obligationId: "ecd",
      periodKey: "2026-01",
      summary: "ECD 2026",
      sourceId: "official:sped:ecd:hub",
    })).toContain("NÃO é vencimento legal");
  });

  it("SoD bloqueia auto-aprovação", () => {
    const policy = DEFAULT_SOD_POLICY("ws");
    const task = createClosingTask({
      workspaceId: "ws",
      companyId: "co",
      periodKey: "2026-03",
      obligationId: "reinf",
      title: "t",
      preparerId: "prep",
    });
    expect(canApprove({ policy, task, actorId: "prep" }).ok).toBe(false);
    expect(canApprove({ policy, task, actorId: "apr" }).ok).toBe(true);
    const done = approveTask(task, policy, "apr");
    expect(done.status).toBe("done");
  });

  it("retificação cria nova versão e diff", () => {
    const g1 = createGeneration({
      workspaceId: "ws",
      companyId: "co",
      obligationId: "ecf",
      periodKey: "2026",
      contentHash: "a".repeat(32),
      layoutVersion: "x",
      contentPreview: "line1\nline2",
    });
    expect(g1.locked).toBe(true);
    const g2 = createGeneration({
      workspaceId: "ws",
      companyId: "co",
      obligationId: "ecf",
      periodKey: "2026",
      contentHash: "b".repeat(32),
      layoutVersion: "x",
      contentPreview: "line1\nline3",
      previous: g1,
    });
    expect(g2.version).toBe(2);
    expect(g2.rectifiesId).toBe(g1.id);
    const d = diffGenerations(g1, g2);
    expect(d.sameHash).toBe(false);
    expect(d.previewLinesAdded).toBeGreaterThan(0);
  });

  it("evidência rejeita binário e exige metadata", () => {
    expect(() => assertNoBinaryPayload(new ArrayBuffer(8))).toThrow(/binário/i);
    const ev = createEvidenceMeta({
      workspaceId: "ws",
      obligationId: "efd-icms-ipi",
      program: "pva_efd_icms_ipi",
      programVersion: "1",
      contentHash: "abcd1234ffff",
      resultStatus: "ok",
      generationId: "gen1",
    });
    expect(ev.generationId).toBe("gen1");
  });

  it("notificações mascaram CNPJ e removem XML", () => {
    const body = sanitizeNotificationBody(
      "Empresa 11.222.333/0001-81 <?xml version='1.0'?><nfe/>",
    );
    expect(body).not.toMatch(/222\.333/);
    expect(body).not.toMatch(/<nfe/i);
    const prefs = defaultPrefs("ws");
    const n = buildNotification({
      workspaceId: "ws",
      channel: "internal",
      title: "t",
      body: "11222333000181",
      prefs,
      recentCount: 0,
    });
    expect(n.body).toContain("****");
  });

  it("matriz comercial sem claim production", () => {
    const rows = buildCommercialSupportMatrix();
    expect(assertNoFalseProduction(rows)).toBe(true);
    expect(rows.some((r) => r.obligationId === "efd-contribuicoes")).toBe(true);
    expect(rows.filter((r) => r.obligationId).every((r) => r.productionClaimAllowed === false)).toBe(
      true,
    );
  });

  it("catálogo regulatório não auto-ativa rule_set", () => {
    const seed = seedRegulatoryFromOfficialSources();
    expect(seed.length).toBeGreaterThan(5);
    expect(seed.every((s) => s.activatesRuleSet === false)).toBe(true);
    const pub = advanceRegulatoryStatus(
      advanceRegulatoryStatus(seed[0]!, "reviewed"),
      "published",
    );
    expect(pub.status).toBe("published");
    expect(pub.activatesRuleSet).toBe(false);
  });

  it("ERP CSV preview detecta idempotency duplicada", () => {
    const prev = previewCsvImport(
      "code;name;idempotencyKey\na;A;k1\nb;B;k1\n",
      [
        { sourceColumn: "code", targetField: "code" },
        { sourceColumn: "idempotencyKey", targetField: "idempotencyKey" },
      ],
      "generic",
    );
    expect(prev.errorCount).toBe(1);
  });

  it("API key local-dev em development", () => {
    const req = new NextRequest("http://localhost/api/v1/status", {
      headers: { "x-api-key": "local-dev" },
    });
    const auth = authenticateApiKey(req);
    expect(auth.ok).toBe(true);
    expect(PLATFORM_OPS_MATURITY).toBe("internal_beta");
  });
});
