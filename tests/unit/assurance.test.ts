import { describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "fs/promises";
import os from "os";
import path from "path";
import {
  soc2ReadinessChecklist,
  readinessSummary,
  statementOfApplicabilityDraft,
  soaMarkdown,
} from "@/modules/assurance/soc2-readiness";
import { answerGroundedAssist } from "@/modules/assurance/grounded-assist";
import { pickGroundingSources, listApprovedOfficialSnippets } from "@/modules/assurance/official-snippets";
import {
  createSapLivePilotAdapter,
  runSapLivePilotGolden,
  fetchSapLiveHttpMinimal,
  sapSecretsPresent,
} from "@/modules/assurance/sap-live-pilot";
import {
  ASSURANCE_PLATFORM_MATURITY,
  assuranceHealth,
  section28Phase17Report,
} from "@/modules/assurance/platform";
import { exportAssuranceBinderCi } from "@/modules/assurance/binder-ci";
import { answerGuidedAssist } from "@/modules/growth/guided-assist";
import { assertCatalogSafe, getAdapter, listRegisteredAdapters } from "@/modules/continuous-ops/erp/registry";
import { buildCommercialSupportMatrix, assertNoFalseProduction } from "@/modules/ops/commercial-matrix";
import { defaultLegalStatus } from "@/modules/enterprise/legal-status";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { getFeatureFlags } from "@/lib/feature-flags";

describe("Assurance Fase 17", () => {
  it("SOC2 readiness: done/waived sem open; SoA draft; sem soc2Certified", () => {
    const items = soc2ReadinessChecklist();
    const s = readinessSummary(items);
    expect(s.open).toBe(0);
    expect(s.completeOrWaived).toBe(true);
    expect(items.some((i) => i.id === "no_fake_soc2" && i.status === "done")).toBe(true);
    const soa = statementOfApplicabilityDraft();
    expect(soa.length).toBeGreaterThan(3);
    expect(soaMarkdown()).toMatch(/Statement of Applicability/);
    expect(defaultLegalStatus().soc2Certified).toBe(false);
  });

  it("grounded assist: sourceIds; ban alíquota; flag default off", () => {
    expect(getFeatureFlags().guidedAssist).toBe(false);
    expect(listApprovedOfficialSnippets("efd-icms-ipi").length).toBeGreaterThan(0);
    const cites = pickGroundingSources({
      obligationId: "efd-icms-ipi",
      question: "homologar PVA",
    });
    expect(cites[0]?.sourceId).toMatch(/^official:/);

    const banned = answerGroundedAssist({
      question: "Qual a alíquota de PIS?",
      env: { FEATURE_GUIDED_ASSIST: "1" },
    });
    expect(banned.blocked).toBe(true);
    expect(banned.sourceIds.length).toBeGreaterThan(0);

    const ok = answerGroundedAssist({
      question: "Como homologar EFD ICMS no PVA?",
      obligationId: "efd-icms-ipi",
      env: { FEATURE_GUIDED_ASSIST: "1" },
    });
    expect(ok.ok).toBe(true);
    expect(ok.sourceIds.length).toBeGreaterThan(0);
    expect(ok.citations.every((c) => c.url.startsWith("http"))).toBe(true);

    const guided = answerGuidedAssist({
      question: "Como homologar EFD ICMS no PVA?",
      obligationId: "efd-icms-ipi",
      env: { FEATURE_GUIDED_ASSIST: "1" },
    });
    expect(guided.sourceIds?.length).toBeGreaterThan(0);
  });

  it("SAP live piloto gated + registry", async () => {
    expect(assertCatalogSafe({})).toBe(true);
    expect(getAdapter("sap_live_pilot", {})?.vendorId).toBe("sap_live_pilot");
    expect(getAdapter("sap_live_pilot", {})?.liveConnectionEnabled).toBe(false);
    const golden = runSapLivePilotGolden({});
    expect(golden.ok).toBe(true);
    expect(golden.live).toBe(false);

    const live = createSapLivePilotAdapter({
      XFI_ALLOW_LIVE_ERP: "1",
      XFI_SAP_OAUTH_TOKEN: "secret-not-committed",
    });
    expect(live.liveConnectionEnabled).toBe(true);
    expect(sapSecretsPresent({})).toBe(false);

    await expect(fetchSapLiveHttpMinimal({})).rejects.toThrow(/XFI_ALLOW_LIVE_ERP/);
    await expect(
      fetchSapLiveHttpMinimal({
        XFI_ALLOW_LIVE_ERP: "1",
        XFI_SAP_OAUTH_TOKEN: "tok",
      }),
    ).rejects.toThrow(/XFI_ERP_HTTP/);
    const http = await fetchSapLiveHttpMinimal({
      XFI_ALLOW_LIVE_ERP: "1",
      XFI_SAP_OAUTH_TOKEN: "tok",
      XFI_ERP_HTTP: "1",
    });
    expect(http.status).toBe("synth_ok");
    expect(listRegisteredAdapters({}).some((a) => a.vendorId === "sap_live_pilot")).toBe(true);
  });

  it("binder CI export + health + comercial", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xfi-assurance-"));
    try {
      const exp = await exportAssuranceBinderCi({ outDir: dir });
      expect(exp.files).toContain("soc2-readiness.md");
      expect(exp.files).toContain("statement-of-applicability.md");
      const md = await readFile(path.join(dir, "README.md"), "utf8");
      expect(md).toMatch(/Não constitui SOC2/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    expect(ASSURANCE_PLATFORM_MATURITY).toBe("official_validator_beta");
    const h = assuranceHealth({});
    expect(h.readinessCompleteOrWaived).toBe(true);
    expect(h.sapGoldenOk).toBe(true);
    expect(h.soc2Certified).toBe(false);
    expect(h.anyObligationProduction).toBe(false);
    expect(await section28Phase17Report()).toMatch(/Fase 17/);

    const matrix = buildCommercialSupportMatrix();
    expect(assertNoFalseProduction(matrix)).toBe(true);
    expect(matrix.some((r) => r.resource.includes("SAP live"))).toBe(true);
    expect(matrix.some((r) => r.resource.includes("SOC2"))).toBe(true);
    expect(
      Object.values(OBLIGATION_SUPPORT_PROFILES).every((p) => p.maturity !== "production"),
    ).toBe(true);
  });
});
