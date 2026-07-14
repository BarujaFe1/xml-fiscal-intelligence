import { describe, expect, it } from "vitest";
import { CONTROL_MATRIX, controlMatrixSummary, controlMatrixMarkdown } from "@/modules/enterprise/controls";
import {
  buildEvidenceBinder,
  binderToMarkdown,
  binderToZipBlob,
} from "@/modules/enterprise/evidence-binder";
import {
  publishScenarioListing,
  importListingWithRelab,
  listPublishedForTenant,
  retireListing,
} from "@/modules/enterprise/marketplace";
import { listGoldenVersions, resolveGoldenVersion } from "@/modules/enterprise/golden-versions";
import {
  createOmieLivePilotAdapter,
  runOmieLivePilotGolden,
  fetchOmieLivePreviewBlocked,
  liveErpEnvAllowed,
} from "@/modules/enterprise/erp-live-pilot";
import {
  defaultLegalStatus,
  applyLegalMilestones,
  assertNoFakeCertification,
} from "@/modules/enterprise/legal-status";
import {
  ENTERPRISE_PLATFORM_MATURITY,
  enterpriseHealth,
  section28Phase12Report,
} from "@/modules/enterprise/platform";
import {
  createScenarioDraft,
  applyLabResult,
  markReviewed,
} from "@/modules/homologation/scenarios";
import { assertCatalogSafe, getAdapter, listRegisteredAdapters } from "@/modules/continuous-ops/erp/registry";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { buildCommercialSupportMatrix, assertNoFalseProduction } from "@/modules/ops/commercial-matrix";

describe("Enterprise Fase 12", () => {
  it("control matrix + binder zip sem claim SOC2", async () => {
    expect(CONTROL_MATRIX.length).toBeGreaterThan(5);
    expect(controlMatrixSummary().implemented).toBeGreaterThan(0);
    expect(controlMatrixMarkdown()).toMatch(/sem certificação/i);
    const binder = buildEvidenceBinder({ section28Extra: section28Phase12Report() });
    expect(binder.disclaimer).toMatch(/SOC2/);
    expect(binderToMarkdown(binder)).toMatch(/Evidence binder/);
    const blob = await binderToZipBlob(binder);
    expect(blob.size).toBeGreaterThan(100);
  });

  it("marketplace publish/import força re-lab e isolamento de tenant", () => {
    let scn = createScenarioDraft({
      workspaceId: "ws_a",
      obligationId: "efd-icms-ipi",
      periodKey: "2026-01",
      layoutVersion: "017",
      program: "pva_efd_icms_ipi",
      uf: "SP",
    });
    scn = applyLabResult(scn, {
      contentHash: "b".repeat(32),
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
      goldenPackVersion: "1.0.0-phase12",
    });
    expect(listing.status).toBe("published");
    expect(listing.contentFingerprint).toMatch(/…/);
    expect(listPublishedForTenant([listing], "t1")).toHaveLength(1);

    const { scenario, result } = importListingWithRelab({
      listing,
      targetWorkspaceId: "ws_b",
      tenantId: "t1",
    });
    expect(result.requiresRelab).toBe(true);
    expect(scenario.status).toBe("lab_pending");
    expect(scenario.homologationGrade).toBe(false);

    expect(() =>
      importListingWithRelab({ listing, targetWorkspaceId: "ws_b", tenantId: "other" }),
    ).toThrow(/tenant/);
    expect(retireListing(listing).status).toBe("retired");
  });

  it("golden versions por obrigação/UF", () => {
    expect(listGoldenVersions().length).toBeGreaterThan(GOLDEN_MIN());
    expect(resolveGoldenVersion("golden_efd_icms_sp")?.uf).toBe("SP");
  });

  it("Omie live gated — off por default; golden ok; HTTP bloqueado", async () => {
    const off = createOmieLivePilotAdapter({});
    expect(off.liveConnectionEnabled).toBe(false);
    expect(liveErpEnvAllowed({})).toBe(false);
    expect(runOmieLivePilotGolden({}).ok).toBe(true);
    expect(assertCatalogSafe({})).toBe(true);
    expect(getAdapter("omie_live_pilot", {})?.vendorId).toBe("omie_live_pilot");
    expect(listRegisteredAdapters({}).length).toBeGreaterThanOrEqual(6);

    const on = createOmieLivePilotAdapter({
      XFI_ALLOW_LIVE_ERP: "1",
      XFI_OMIE_APP_KEY: "key",
      XFI_OMIE_APP_SECRET: "secret",
    });
    expect(on.liveConnectionEnabled).toBe(true);
    expect(on.maturity).toBe("internal_beta");
    expect(
      assertCatalogSafe({
        XFI_ALLOW_LIVE_ERP: "1",
        XFI_OMIE_APP_KEY: "key",
        XFI_OMIE_APP_SECRET: "secret",
      }),
    ).toBe(true);

    await expect(fetchOmieLivePreviewBlocked()).rejects.toThrow(/não habilitado/);
  });

  it("legal status nunca auto-certifica; DPA/SLA só com evidence", () => {
    const d = defaultLegalStatus();
    expect(d.dpa).toBe("template_only");
    expect(d.sla).toBe("draft");
    expect(() => assertNoFakeCertification(d)).not.toThrow();
    const signed = applyLegalMilestones(d, { dpaSignedEvidenceRef: "contract/123" });
    expect(signed.dpa).toBe("signed");
    expect(signed.soc2Certified).toBe(false);
  });

  it("health + comercial sem production", () => {
    expect(ENTERPRISE_PLATFORM_MATURITY).toBe("official_validator_beta");
    const h = enterpriseHealth({});
    expect(h.omieGoldenOk).toBe(true);
    expect(h.anyObligationProduction).toBe(false);
    expect(section28Phase12Report()).toMatch(/Fase 12/);
    const matrix = buildCommercialSupportMatrix();
    expect(assertNoFalseProduction(matrix)).toBe(true);
    expect(matrix.some((r) => r.resource.includes("Marketplace"))).toBe(true);
    expect(
      Object.values(OBLIGATION_SUPPORT_PROFILES).every((p) => p.maturity !== "production"),
    ).toBe(true);
  });
});

function GOLDEN_MIN() {
  return 5;
}
