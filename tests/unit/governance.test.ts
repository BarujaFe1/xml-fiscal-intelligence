import { describe, expect, it } from "vitest";
import { bindRole, canAct, assertTransmitRbac, assertNtActivateRbac } from "@/modules/governance/rbac";
import {
  sanitizeAuditDetail,
  mergeAuditExport,
  auditExportToCsv,
  rowsFromClosingTasks,
} from "@/modules/governance/audit-export";
import {
  createRetentionPolicy,
  isPastRetention,
  seedDefaultRetention,
} from "@/modules/governance/retention";
import { computeSlaSnapshot, DRAFT_SLA_TARGETS } from "@/modules/governance/sla";
import {
  createCampaign,
  tryCompleteCampaign,
  buildCellDashboard,
  attachScenariosToCampaign,
} from "@/modules/governance/campaigns";
import {
  GOVERNANCE_PLATFORM_MATURITY,
  governanceHealth,
  section28Phase11Report,
} from "@/modules/governance/platform";
import { requestNtActivationReview } from "@/modules/governance/nt-activate-gate";
import {
  denyLiveErpWithoutEnv,
  isLikelySecretPath,
  assertNoLiveErpWithoutEnv,
} from "@/modules/governance/secrets-guard";
import { assertTransmitGates } from "@/modules/homologation/transmission";
import { createClosingTask, approveTask, DEFAULT_SOD_POLICY } from "@/modules/ops/sod";
import { createNtInboxItem, advanceNtStatus } from "@/modules/continuous-ops/nt-inbox";
import {
  createScenarioDraft,
  applyLabResult,
  markReviewed,
} from "@/modules/homologation/scenarios";
import { clearOpsEventsForTests, recordOpsEvent } from "@/modules/ops/telemetry";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { OPS_OPENAPI_V1 } from "@/modules/ops/openapi";

describe("Governance Fase 11", () => {
  it("RBAC: preparer não transmite; owner transmite e NT activate", () => {
    const ws = "ws1";
    const owner = bindRole({ workspaceId: ws, userId: "o1", role: "owner" });
    const prep = bindRole({ workspaceId: ws, userId: "p1", role: "preparer" });
    expect(canAct({ bindings: [prep], workspaceId: ws, userId: "p1", action: "transmit" }).ok).toBe(
      false,
    );
    expect(() =>
      assertTransmitRbac({ bindings: [prep], workspaceId: ws, userId: "p1" }),
    ).toThrow(/transmit|permissão|papel/i);
    expect(() =>
      assertTransmitRbac({ bindings: [owner], workspaceId: ws, userId: "o1" }),
    ).not.toThrow();
    expect(() =>
      assertNtActivateRbac({ bindings: [owner], workspaceId: ws, userId: "o1" }),
    ).not.toThrow();
    expect(() =>
      assertNtActivateRbac({ bindings: [prep], workspaceId: ws, userId: "p1" }),
    ).toThrow();
  });

  it("assertTransmitGates = SoD + RBAC", () => {
    const ws = "ws2";
    const bindings = [
      bindRole({ workspaceId: ws, userId: "prep", role: "preparer" }),
      bindRole({ workspaceId: ws, userId: "apr", role: "approver" }),
    ];
    let task = createClosingTask({
      workspaceId: ws,
      companyId: "c",
      periodKey: "2026-01",
      obligationId: "ecd",
      title: "t",
      preparerId: "prep",
    });
    const policy = DEFAULT_SOD_POLICY(ws);
    task = approveTask(task, policy, "apr");
    expect(() =>
      assertTransmitGates({
        policy,
        task,
        actorId: "prep",
        bindings,
        workspaceId: ws,
      }),
    ).toThrow();
    expect(() =>
      assertTransmitGates({
        policy,
        task,
        actorId: "apr",
        bindings,
        workspaceId: ws,
      }),
    ).not.toThrow();
  });

  it("audit sanitiza CNPJ e exporta CSV", () => {
    expect(sanitizeAuditDetail("CNPJ 11.222.333/0001-81 ok")).not.toMatch(/11222333|11\.222/);
    const task = createClosingTask({
      workspaceId: "w",
      companyId: "c",
      periodKey: "2026",
      obligationId: "ecd",
      title: "x 11222333000181",
      preparerId: "a",
    });
    const rows = mergeAuditExport(rowsFromClosingTasks([task]));
    expect(auditExportToCsv(rows)).toMatch(/closing_task/);
    expect(rows[0]?.detail).not.toMatch(/11222333000181/);
  });

  it("retenção versionada", () => {
    const p1 = createRetentionPolicy({ workspaceId: "w", class: "evidence" });
    const p2 = createRetentionPolicy({ workspaceId: "w", class: "evidence", previous: p1 });
    expect(p2.version).toBe(2);
    expect(seedDefaultRetention("w").length).toBe(5);
    expect(
      isPastRetention(p1, new Date(Date.now() - 3000 * 24 * 3600 * 1000).toISOString()),
    ).toBe(true);
  });

  it("SLA snapshot + OpenAPI rate limits", () => {
    clearOpsEventsForTests();
    recordOpsEvent("generation_error", "x");
    recordOpsEvent("api_denied", "429");
    const snap = computeSlaSnapshot([{ id: "1", kind: "api_denied", at: "", detail: "q" }]);
    expect(snap.apiDenied).toBe(1);
    expect(DRAFT_SLA_TARGETS.length).toBeGreaterThan(0);
    expect(OPS_OPENAPI_V1["x-rate-limits"].apiKeyDefault.maxRequestsPerHour).toBe(300);
  });

  it("campanhas validated_scope sem promover global", () => {
    let camp = createCampaign({
      workspaceId: "w",
      title: "ICMS",
      obligationId: "efd-icms-ipi",
    });
    let scn = createScenarioDraft({
      workspaceId: "w",
      obligationId: "efd-icms-ipi",
      periodKey: "2026-01",
      layoutVersion: "x",
      program: "pva_efd_icms_ipi",
      uf: "SP",
    });
    scn = applyLabResult(scn, {
      contentHash: "a".repeat(32),
      programVersion: "1",
      generationId: "g",
      evidenceId: "e",
      homologationGrade: true,
    });
    scn = markReviewed(scn, "rev", "§28 ok");
    camp = attachScenariosToCampaign(camp, [scn.id]);
    camp = tryCompleteCampaign(camp, [scn]);
    expect(camp.status).toBe("completed");
    expect(buildCellDashboard([scn])[0]?.cellMaturity).toBe("validated_scope");
    expect(OBLIGATION_SUPPORT_PROFILES["efd-icms-ipi"].maturity).not.toBe("validated_scope");
    expect(OBLIGATION_SUPPORT_PROFILES["efd-icms-ipi"].maturity).not.toBe("production");
  });

  it("NT activation request com RBAC sem ativar rule set", () => {
    const ws = "w";
    const owner = bindRole({ workspaceId: ws, userId: "o", role: "owner" });
    let item = createNtInboxItem({ workspaceId: ws, sourceId: "official:x", title: "NT" });
    item = advanceNtStatus(item, "impact_assessment", { impactManifest: ["a"] });
    item = advanceNtStatus(item, "draft_rule_set", { draftRuleSetCode: "R" });
    item = advanceNtStatus(item, "awaiting_fixture");
    item = advanceNtStatus(item, "ready_for_review", { fixtureId: "fx" });
    const next = requestNtActivationReview({
      item,
      bindings: [owner],
      workspaceId: ws,
      userId: "o",
    });
    expect(next.ruleSetActivated).toBe(false);
    expect(next.notes).toMatch(/activation_requested/);
  });

  it("secrets guard + health", () => {
    expect(assertNoLiveErpWithoutEnv({}).ok).toBe(true);
    expect(() => denyLiveErpWithoutEnv({})).not.toThrow();
    expect(isLikelySecretPath("foo/.env.local")).toBe(true);
    expect(isLikelySecretPath("src/modules/x.ts")).toBe(false);
    expect(GOVERNANCE_PLATFORM_MATURITY).toBe("official_validator_beta");
    expect(governanceHealth().anyObligationProduction).toBe(false);
    expect(section28Phase11Report()).toMatch(/Fase 11/);
  });
});
