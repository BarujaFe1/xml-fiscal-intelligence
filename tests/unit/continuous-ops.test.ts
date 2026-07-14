import { describe, expect, it } from "vitest";
import { listRegisteredAdapters, assertCatalogSafe, getAdapter } from "@/modules/continuous-ops/erp/registry";
import { runPilotGoldenPreview, PILOT_SYNTH_FIXTURE } from "@/modules/continuous-ops/erp/pilot";
import {
  assertWithinQuota,
  bumpUsage,
  defaultQuotaPolicy,
  filterByCompanyScope,
  hourBucket,
} from "@/modules/continuous-ops/multi-company";
import {
  advanceNtStatus,
  assertNeverAutoActivated,
  createNtInboxItem,
  diffImpactManifest,
  seedNtFromOfficialSource,
} from "@/modules/continuous-ops/nt-inbox";
import {
  checkRehomologation,
  exportSection28Pack,
  evidenceAgeDays,
} from "@/modules/continuous-ops/rehomologation";
import { continuousOpsHealth, CONTINUOUS_OPS_MATURITY } from "@/modules/continuous-ops/platform";
import { buildWebhookAlert, summarizeTelemetry } from "@/modules/continuous-ops/observability";
import { createScenarioDraft, applyLabResult, markReviewed } from "@/modules/homologation/scenarios";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import type { OpsTelemetryEvent } from "@/modules/ops/telemetry";

describe("Continuous ops Fase 10", () => {
  it("piloto golden + placeholders sem live", () => {
    expect(assertCatalogSafe()).toBe(true);
    expect(listRegisteredAdapters().length).toBeGreaterThanOrEqual(5);
    expect(getAdapter("pilot_synth")?.maturity).toBe("development");
    expect(getAdapter("totvs_placeholder")?.liveConnectionEnabled).toBe(false);
    const g = runPilotGoldenPreview();
    expect(g.ok).toBe(true);
    expect(PILOT_SYNTH_FIXTURE).toContain("pilot_row_1");
  });

  it("filtra multi-empresa e aplica quotas", () => {
    const rows = [
      { companyId: "a", establishmentId: "e1" },
      { companyId: "b", establishmentId: "e1" },
      { companyId: "a", establishmentId: "e2" },
    ];
    expect(
      filterByCompanyScope(rows, { workspaceId: "ws", companyId: "a" }),
    ).toHaveLength(2);
    expect(
      filterByCompanyScope(rows, {
        workspaceId: "ws",
        companyId: "a",
        establishmentId: "e2",
      }),
    ).toHaveLength(1);

    const policy = defaultQuotaPolicy("ws");
    policy.maxGenerationsPerHour = 2;
    let usage = { generationsThisHour: 0, apiCallsThisHour: 0, hourBucket: hourBucket() };
    usage = bumpUsage(usage, "generation");
    usage = bumpUsage(usage, "generation");
    expect(assertWithinQuota(policy, usage, "generation").ok).toBe(false);
  });

  it("inbox NT nunca auto-ativa e avança linearmente", () => {
    let item = seedNtFromOfficialSource({
      workspaceId: "ws",
      sourceId: "official:reforma:consumo-2026",
      title: "RTC",
      obligationId: "rtc",
    });
    expect(item.ruleSetActivated).toBe(false);
    item = advanceNtStatus(item, "impact_assessment", {
      impactManifest: ["a", "b"],
    });
    item = advanceNtStatus(item, "draft_rule_set", { draftRuleSetCode: "X" });
    item = advanceNtStatus(item, "awaiting_fixture");
    expect(() => advanceNtStatus(item, "ready_for_review")).toThrow(/fixture/i);
    item = advanceNtStatus(item, "ready_for_review", { fixtureId: "f1" });
    expect(assertNeverAutoActivated([item])).toBe(true);
    const d = diffImpactManifest(["a"], ["a", "b"]);
    expect(d.added).toEqual(["b"]);
  });

  it("re-homologação e export §28", () => {
    let scn = createScenarioDraft({
      workspaceId: "ws",
      obligationId: "ecd",
      periodKey: "2026",
      layoutVersion: "x",
      program: "programa_ecd",
    });
    scn = applyLabResult(scn, {
      contentHash: "d".repeat(32),
      programVersion: "1",
      generationId: "g",
      evidenceId: "e",
      homologationGrade: true,
    });
    scn = markReviewed(scn, "rev", "ok");
    const check = checkRehomologation(scn, {
      now: new Date(Date.parse(scn.reviewedAt!) + 100 * 24 * 3600 * 1000),
      maxAgeDays: 90,
    });
    expect(check.expired).toBe(true);
    expect(check.action).toBe("retest_lab");
    expect(exportSection28Pack(scn).markdown).toMatch(/§28/);
    expect(evidenceAgeDays(scn.reviewedAt!).toString()).toMatch(/\d/);
  });

  it("telemetria/alertas e health sem production", () => {
    const events: OpsTelemetryEvent[] = [
      { id: "1", kind: "api_denied", at: "", detail: "x" },
      { id: "2", kind: "api_denied", at: "", detail: "y" },
      { id: "3", kind: "lab_import", at: "", detail: "z" },
    ];
    expect(summarizeTelemetry(events).api_denied).toBe(2);
    const alert = buildWebhookAlert({
      workspaceId: "ws",
      title: "t",
      rawBody: "CNPJ 11222333000181",
    });
    expect(alert.body).not.toMatch(/11222333000181/);
    expect(CONTINUOUS_OPS_MATURITY).toBe("internal_beta");
    expect(continuousOpsHealth().noProductionClaim).toBe(true);
    expect(
      Object.values(OBLIGATION_SUPPORT_PROFILES).every((p) => p.maturity !== "production"),
    ).toBe(true);
  });

  it("createNtInboxItem básico", () => {
    const i = createNtInboxItem({
      workspaceId: "ws",
      sourceId: "official:sped:portal",
      title: "x",
    });
    expect(i.status).toBe("identified");
  });
});
