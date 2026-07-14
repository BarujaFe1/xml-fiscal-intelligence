import { describe, expect, it } from "vitest";
import { PERSISTENCE_INVENTORY, persistenceInventoryMarkdown } from "@/modules/scale/persistence";
import {
  createDrDrill,
  executeDrDrill,
  defaultDrTargets,
  backupRestoreProcedureMarkdown,
} from "@/modules/scale/dr";
import { regionalHealthReport, checkRegionHealth } from "@/modules/scale/regions";
import {
  listPlanCatalog,
  quotaPolicyForPlan,
  billingEnterpriseEnabled,
  resolvePlanId,
} from "@/modules/scale/billing-plans";
import { aggregateMeterSamples, recordMeterSample, periodKeyFromDate } from "@/modules/scale/metering";
import {
  createMassCampaign,
  enqueueFromMarketplace,
  attachScenarioIds,
  tryCompleteMassCampaign,
  buildCoverageDashboard,
  aggregateSection28Campaign,
  popRelabQueue,
} from "@/modules/scale/mass-campaigns";
import {
  resolveSecretsManagerMode,
  createPenTestFinding,
  triageFinding,
  residualRisksMarkdown,
} from "@/modules/scale/hardening";
import {
  SCALE_PLATFORM_MATURITY,
  scaleHealth,
  section28Phase13Report,
} from "@/modules/scale/platform";
import {
  createScenarioDraft,
  applyLabResult,
  markReviewed,
} from "@/modules/homologation/scenarios";
import { publishScenarioListing } from "@/modules/enterprise/marketplace";
import { assertWithinQuota, hourBucket } from "@/modules/continuous-ops/multi-company";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { buildCommercialSupportMatrix, assertNoFalseProduction } from "@/modules/ops/commercial-matrix";
import { OPS_OPENAPI_V1 } from "@/modules/ops/openapi";

describe("Scale Fase 13", () => {
  it("inventário + DR drill staging conta evidência; production_claimed não", () => {
    expect(PERSISTENCE_INVENTORY.length).toBeGreaterThan(3);
    expect(persistenceInventoryMarkdown()).toMatch(/persistência/i);
    expect(defaultDrTargets().outOfScope.some((x) => /PVA/i.test(x))).toBe(true);
    expect(backupRestoreProcedureMarkdown()).toMatch(/restore/i);
    let d = createDrDrill({ regionId: "gru", notes: "test" });
    d = executeDrDrill(d, "executed");
    expect(d.countsAsEvidence).toBe(true);
    let bad = createDrDrill({
      regionId: "iad",
      environment: "production_claimed",
      notes: "no",
    });
    bad = executeDrDrill(bad, "executed");
    expect(bad.countsAsEvidence).toBe(false);
  });

  it("regiões synth + billing quotas por plano", () => {
    const regs = regionalHealthReport({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" });
    expect(regs.length).toBe(3);
    expect(checkRegionHealth("local", {}).reachable).toBe(true);
    expect(listPlanCatalog()).toHaveLength(4);
    const policy = quotaPolicyForPlan("ws", "free");
    expect(policy.maxGenerationsPerHour).toBe(10);
    expect(
      assertWithinQuota(
        policy,
        { generationsThisHour: 10, apiCallsThisHour: 0, hourBucket: hourBucket() },
        "generation",
      ).ok,
    ).toBe(false);
    expect(resolvePlanId("enterprise")).toBe("enterprise");
    expect(typeof billingEnterpriseEnabled()).toBe("boolean");
  });

  it("metering agrega e detecta breach de storage", () => {
    const ws = "ws_m";
    const samples = [
      recordMeterSample({ workspaceId: ws, generations: 1, apiCalls: 1, evidenceStorageMb: 10 }),
      { workspaceId: ws, at: `${periodKeyFromDate()}-15T00:00:00.000Z`, generations: 2, apiCalls: 2, evidenceStorageMb: 99999 },
    ];
    const snap = aggregateMeterSamples(ws, "free", samples);
    expect(snap.generations).toBe(3);
    expect(snap.withinPlanLimits).toBe(false);
    expect(snap.breaches.some((b) => b.startsWith("evidenceStorageMb"))).toBe(true);
  });

  it("campanha massiva multi-UF sem promote global", () => {
    let camp = createMassCampaign({
      tenantId: "t1",
      workspaceId: "ws",
      title: "ICMS",
      obligationId: "efd-icms-ipi",
      targetUfs: ["SP", "RJ"],
    });
    let scn = createScenarioDraft({
      workspaceId: "ws",
      obligationId: "efd-icms-ipi",
      periodKey: "2026-01",
      layoutVersion: "x",
      program: "pva_efd_icms_ipi",
      uf: "SP",
    });
    scn = applyLabResult(scn, {
      contentHash: "c".repeat(32),
      programVersion: "1",
      generationId: "g",
      evidenceId: "e",
      homologationGrade: true,
    });
    scn = markReviewed(scn, "r", "§28");
    const listing = publishScenarioListing({
      tenantId: "t1",
      workspaceId: "ws",
      scenario: scn,
      goldenPackVersion: "1.0.0",
    });
    camp = enqueueFromMarketplace(camp, [listing]);
    expect(camp.status).toBe("queued_relab");
    const popped = popRelabQueue(camp);
    expect(popped.listingId).toBe(listing.id);
    camp = attachScenarioIds(popped.camp, [scn.id]);
    camp = tryCompleteMassCampaign(camp, [scn], 1);
    expect(camp.status).toBe("completed");
    expect(buildCoverageDashboard([scn])[0]?.validatedScopeCount).toBe(1);
    expect(aggregateSection28Campaign(camp, [scn])).toMatch(/§28 agregado/);
    expect(OBLIGATION_SUPPORT_PROFILES["efd-icms-ipi"].maturity).not.toBe("production");
    expect(OBLIGATION_SUPPORT_PROFILES["efd-icms-ipi"].maturity).not.toBe("validated_scope");
  });

  it("hardening secrets + pen-test triage", () => {
    expect(resolveSecretsManagerMode({})).toBe("env_only");
    expect(resolveSecretsManagerMode({ XFI_SECRETS_MANAGER_URL: "https://vault" })).toBe(
      "external_configured",
    );
    let f = createPenTestFinding({ title: "x", severity: "low" });
    f = triageFinding(f, "accepted", "risco aceito");
    expect(residualRisksMarkdown([f])).toMatch(/accepted/);
  });

  it("health + comercial + openapi status menciona scale via version", () => {
    expect(SCALE_PLATFORM_MATURITY).toBe("internal_beta");
    expect(scaleHealth({}).anyObligationProduction).toBe(false);
    expect(section28Phase13Report()).toMatch(/Fase 13/);
    const matrix = buildCommercialSupportMatrix();
    expect(assertNoFalseProduction(matrix)).toBe(true);
    expect(matrix.some((r) => r.resource.includes("Scale DR"))).toBe(true);
    expect(OPS_OPENAPI_V1.info.version).toMatch(/phase/);
  });
});
