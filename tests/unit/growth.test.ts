import { describe, expect, it } from "vitest";
import {
  submitPublicListing,
  moderatePublicListing,
  importPublicListingWithRelab,
  listApprovedPublic,
  flagAbuse,
  defaultMarketplaceRateLimit,
  assertImportForcesLabPending,
  assertWithinMarketplaceRate,
  bumpMarketplaceRate,
  hourBucket,
} from "@/modules/growth/public-marketplace";
import {
  answerGuidedAssist,
  detectsForbiddenTaxAsk,
  isGuidedAssistEnabled,
  maturityGaps,
} from "@/modules/growth/guided-assist";
import {
  buildMobileClosingSummary,
  assertMobileReadOnly,
} from "@/modules/growth/mobile-readonly";
import {
  GROWTH_PLATFORM_MATURITY,
  growthHealth,
  section28Phase16Report,
} from "@/modules/growth/platform";
import { publishScenarioListing } from "@/modules/enterprise/marketplace";
import {
  createScenarioDraft,
  applyLabResult,
  markReviewed,
} from "@/modules/homologation/scenarios";
import { emptyCell } from "@/modules/obligations/core/workflows/closing";
import type { ClosingPeriodCard } from "@/modules/obligations/core/workflows/closing";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { buildCommercialSupportMatrix, assertNoFalseProduction } from "@/modules/ops/commercial-matrix";
import { getFeatureFlags } from "@/lib/feature-flags";

describe("Growth Fase 16", () => {
  it("marketplace público: submit → moderate → import força re-lab", () => {
    let scn = createScenarioDraft({
      workspaceId: "ws_a",
      obligationId: "efd-icms-ipi",
      periodKey: "2026-01",
      layoutVersion: "017",
      program: "pva_efd_icms_ipi",
      uf: "SP",
    });
    scn = applyLabResult(scn, {
      contentHash: "d".repeat(32),
      programVersion: "1",
      generationId: "g",
      evidenceId: "e",
      homologationGrade: true,
    });
    scn = markReviewed(scn, "rev", "§28");
    const listing = publishScenarioListing({
      tenantId: "t1",
      workspaceId: "ws_a",
      scenario: scn,
      goldenPackVersion: "1.0.0",
    });
    let rate = defaultMarketplaceRateLimit("t1");
    const { publicListing, rateLimit } = submitPublicListing({
      listing,
      compliancePackHashRef: "hashabc",
      rateLimit: rate,
    });
    expect(publicListing.moderation).toBe("pending_review");
    expect(publicListing.compliancePackHashRef).toBe("hashabc");
    rate = rateLimit;
    const approved = moderatePublicListing(publicListing, "approved", "mod1");
    expect(listApprovedPublic([approved])).toHaveLength(1);

    const imported = importPublicListingWithRelab({
      publicListing: approved,
      targetWorkspaceId: "ws_b",
      targetTenantId: "t2",
      rateLimit: defaultMarketplaceRateLimit("t2"),
    });
    expect(imported.result.requiresRelab).toBe(true);
    assertImportForcesLabPending(imported.scenario);

    let abused = flagAbuse(approved, "spam");
    abused = flagAbuse(abused, "pii");
    abused = flagAbuse(abused, "scam");
    expect(abused.moderation).toBe("rejected");
  });

  it("rate limit publish", () => {
    const rate = {
      ...defaultMarketplaceRateLimit("t"),
      maxPublishesPerHour: 1,
      publishesThisHour: 1,
      hourBucket: hourBucket(),
    };
    expect(assertWithinMarketplaceRate(rate, "publish").ok).toBe(false);
    expect(
      bumpMarketplaceRate({ ...rate, publishesThisHour: 0 }, "publish").publishesThisHour,
    ).toBe(1);
  });

  it("guided assist: flag off; ban tributário; playbook ok", () => {
    expect(getFeatureFlags().guidedAssist).toBe(false);
    expect(isGuidedAssistEnabled({})).toBe(false);
    expect(answerGuidedAssist({ question: "Como homologar?", env: {} }).blocked).toBe(true);

    expect(detectsForbiddenTaxAsk("Qual a alíquota de PIS?")).toBe(true);
    expect(detectsForbiddenTaxAsk("Qual o vencimento da EFD?")).toBe(true);
    const banned = answerGuidedAssist({
      question: "Calcular imposto de PIS",
      env: { FEATURE_GUIDED_ASSIST: "1" },
    });
    expect(banned.blocked).toBe(true);
    expect(banned.reason).toMatch(/tribut/i);

    const ok = answerGuidedAssist({
      question: "Como homologar EFD ICMS no PVA?",
      obligationId: "efd-icms-ipi",
      env: { FEATURE_GUIDED_ASSIST: "1" },
    });
    expect(ok.ok).toBe(true);
    expect(ok.blocked).toBe(false);
    expect(ok.playbookId).toMatch(/icms/i);
    expect(ok.disclaimer).toMatch(/Não calcula impostos/);
    expect(maturityGaps("efd-icms-ipi").maturity).not.toBe("production");
  });

  it("mobile read-only summary", () => {
    const card: ClosingPeriodCard = {
      id: "c1",
      workspaceId: "ws",
      companyId: "co",
      companyLabel: "Co",
      establishmentId: "e1",
      establishmentLabel: "Est",
      periodKey: "2026-01",
      periodKind: "monthly",
      cells: { ecd: emptyCell("ecd") },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const s = buildMobileClosingSummary({
      workspaceId: "ws",
      cards: [card],
      telemetry: [{ id: "1", kind: "api_denied", at: "", detail: "CNPJ 11222333000181" }],
    });
    expect(s.readOnly).toBe(true);
    expect(s.canGenerate).toBe(false);
    expect(s.canTransmit).toBe(false);
    expect(s.alerts[0]).not.toMatch(/11222333000181/);
    expect(() => assertMobileReadOnly(s)).not.toThrow();
  });

  it("health + comercial sem production", () => {
    expect(GROWTH_PLATFORM_MATURITY).toBe("internal_beta");
    expect(growthHealth({}).anyObligationProduction).toBe(false);
    expect(section28Phase16Report()).toMatch(/Fase 16/);
    const matrix = buildCommercialSupportMatrix();
    expect(assertNoFalseProduction(matrix)).toBe(true);
    expect(matrix.some((r) => r.resource.includes("Marketplace público"))).toBe(true);
    expect(
      Object.values(OBLIGATION_SUPPORT_PROFILES).every((p) => p.maturity !== "production"),
    ).toBe(true);
  });
});
