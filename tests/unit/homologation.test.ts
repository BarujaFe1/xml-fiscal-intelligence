import { describe, expect, it, beforeEach } from "vitest";
import { HOMOLOGATION_PLAYBOOKS, getPlaybook } from "@/modules/homologation/playbooks";
import {
  createScenarioDraft,
  applyLabResult,
  markReviewed,
  cellMaturityFromScenario,
  diffScenarioMatrix,
  evaluateScenarioPackage,
} from "@/modules/homologation/scenarios";
import {
  buildTransmissionChecklist,
  transmissionAllowed,
  assertTransmitSoD,
} from "@/modules/homologation/transmission";
import { isHomologationGradeGeneric, bridgeLabRunToEvidence } from "@/modules/homologation/lab-bridge";
import { goldenCoverageReport, listGoldenPacks } from "@/modules/homologation/golden-packs";
import {
  commercialValidatedScopeClaims,
  HOMOLOGATION_PLATFORM_MATURITY,
  mustShowNonProductionBanner,
  SUPPORT_RUNBOOK_DONT_PROMISE,
} from "@/modules/homologation/platform";
import {
  activateRtcRuleSetWithFixture,
  assertStaticRtcRulesInactive,
} from "@/modules/homologation/rtc-activation";
import {
  clearApiKeyAuditForTests,
  listApiKeyAudit,
  proposeApiKeyRotation,
} from "@/modules/homologation/api-key-audit";
import { authenticateApiKey } from "@/modules/ops/api-auth";
import { createClosingTask, DEFAULT_SOD_POLICY, approveTask } from "@/modules/ops/sod";
import { NextRequest } from "next/server";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";

describe("Homologação Fase 9", () => {
  beforeEach(() => {
    clearApiKeyAuditForTests();
  });

  it("tem playbook por obrigação", () => {
    expect(HOMOLOGATION_PLAYBOOKS).toHaveLength(5);
    expect(getPlaybook("efd-icms-ipi")?.program).toBe("pva_efd_icms_ipi");
  });

  it("cenário sobe célula só com grade+revisão; nunca production global", () => {
    let scn = createScenarioDraft({
      workspaceId: "ws",
      obligationId: "efd-icms-ipi",
      periodKey: "2026-03",
      layoutVersion: "x",
      program: "pva_efd_icms_ipi",
      uf: "SP",
    });
    expect(evaluateScenarioPackage(scn).status).toBe("lab_pending");

    scn = applyLabResult(scn, {
      contentHash: "a".repeat(32),
      programVersion: "1.0",
      generationId: "g1",
      homologationGrade: false,
    });
    expect(scn.status).toBe("blocked_missing_lab");

    scn = applyLabResult(scn, {
      contentHash: "a".repeat(32),
      programVersion: "1.0",
      generationId: "g1",
      evidenceId: "e1",
      homologationGrade: true,
    });
    expect(scn.status).toBe("homologation_grade");
    expect(cellMaturityFromScenario(scn)).toBe("official_validator_beta");

    scn = markReviewed(scn, "rev", "§28 ok");
    expect(scn.status).toBe("validated_scope_ready");
    expect(cellMaturityFromScenario(scn)).toBe("validated_scope");

    // obrigação global inalterada
    expect(OBLIGATION_SUPPORT_PROFILES["efd-icms-ipi"].maturity).not.toBe("production");
    expect(OBLIGATION_SUPPORT_PROFILES["efd-icms-ipi"].maturity).not.toBe("validated_scope");
  });

  it("diff de matriz versionado", () => {
    const a = createScenarioDraft({
      workspaceId: "ws",
      obligationId: "ecd",
      periodKey: "2026",
      layoutVersion: "x",
      program: "programa_ecd",
    });
    const b = { ...a, status: "homologation_grade" as const };
    const d = diffScenarioMatrix([a], [b]);
    expect(d.upgraded).toHaveLength(1);
  });

  it("checklist transmissão bloqueia sem flag/cert/SoD", () => {
    const items = buildTransmissionChecklist({
      obligationId: "reinf",
      certType: "none",
      localAgentReady: false,
      featureSubmitEnabled: false,
      sodApproved: false,
      distinctApprover: false,
    });
    expect(transmissionAllowed(items).ok).toBe(false);

    const okItems = buildTransmissionChecklist({
      obligationId: "reinf",
      certType: "A1",
      localAgentReady: true,
      featureSubmitEnabled: true,
      sodApproved: true,
      distinctApprover: true,
      environment: "restricted",
    });
    expect(transmissionAllowed(okItems).ok).toBe(true);

    const policy = DEFAULT_SOD_POLICY("ws");
    let task = createClosingTask({
      workspaceId: "ws",
      companyId: "co",
      periodKey: "2026-03",
      obligationId: "reinf",
      title: "tx",
      preparerId: "prep",
    });
    task = approveTask(task, policy, "apr");
    expect(() => assertTransmitSoD({ policy, task, actorId: "apr" })).not.toThrow();
    expect(() => assertTransmitSoD({ policy, task, actorId: "prep" })).toThrow(/preparador/i);
  });

  it("homologationGrade genérico + bridge evidência", () => {
    expect(
      isHomologationGradeGeneric({
        contentHash: "ab".repeat(16),
        programVersion: "1",
        resultStatus: "ok",
      }),
    ).toBe(true);
    const ev = bridgeLabRunToEvidence(
      {
        id: "r1",
        obligationId: "efd-icms-ipi",
        program: "pva_efd_icms_ipi",
        programVersion: "6",
        resultStatus: "ok",
        contentHash: "ab".repeat(16),
        importedAt: new Date().toISOString(),
      },
      "ws",
    );
    expect(ev.contentHash.length).toBeGreaterThan(10);
  });

  it("goldens e comercial sem claim validated_scope vazio", () => {
    expect(goldenCoverageReport().required).toBeGreaterThanOrEqual(5);
    expect(listGoldenPacks("reinf")).toHaveLength(1);
    expect(commercialValidatedScopeClaims(0).claimValidatedScope).toBe(false);
    expect(commercialValidatedScopeClaims(2).claimValidatedScope).toBe(true);
    expect(mustShowNonProductionBanner("internal_beta")).toBe(true);
    expect(SUPPORT_RUNBOOK_DONT_PROMISE.length).toBeGreaterThan(3);
    expect(HOMOLOGATION_PLATFORM_MATURITY).toBe("internal_beta");
  });

  it("RTC activation lab não muta catálogo static", () => {
    expect(assertStaticRtcRulesInactive()).toBe(true);
    const r = activateRtcRuleSetWithFixture({
      ruleSetId: "rs_rtc_reforma_consumo_2026",
      fixtureId: "f1",
      reviewerId: "rev",
      evidenceHash: "c".repeat(32),
    });
    expect(r.ok).toBe(true);
    expect(r.rule?.activated).toBe(true);
    expect(assertStaticRtcRulesInactive()).toBe(true);
  });

  it("API key audit registra uso", () => {
    const req = new NextRequest("http://localhost/api/v1/status", {
      headers: { "x-api-key": "local-dev" },
    });
    expect(authenticateApiKey(req).ok).toBe(true);
    expect(listApiKeyAudit(5).some((e) => e.keyId === "local-dev")).toBe(true);
    expect(proposeApiKeyRotation().note).toMatch(/OPS_API_KEYS/);
  });
});
