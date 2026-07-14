import { describe, expect, it } from "vitest";
import {
  buildCompliancePack,
  packManifestJson,
  packToMarkdown,
  verifyPackHash,
  checklistMarkdown,
  formatPackVersion,
} from "@/modules/compliance/pack";
import {
  DATA_MAP,
  dataMapMarkdown,
  createPrivacyRequest,
  advancePrivacyRequest,
  fulfillEraseHonest,
  fulfillExport,
  partnerDsaTemplateMarkdown,
} from "@/modules/compliance/lgpd";
import { t, normalizeLocale, i18nCoverageReport, listLocales } from "@/modules/compliance/i18n";
import { periodKeyMonthly, periodKeyAnnual, timezoneHelpersMarkdown } from "@/modules/compliance/timezone";
import {
  JURISDICTION_BR,
  assertNoForeignTaxEngine,
  jurisdictionMarkdown,
  listJurisdictionPacks,
} from "@/modules/compliance/jurisdiction";
import {
  COMPLIANCE_PLATFORM_MATURITY,
  complianceHealth,
  section28Phase15Report,
} from "@/modules/compliance/platform";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { buildCommercialSupportMatrix, assertNoFalseProduction } from "@/modules/ops/commercial-matrix";

describe("Compliance Fase 15", () => {
  it("compliance pack versionado com hash verificável e sem selo", async () => {
    const pack = await buildCompliancePack();
    expect(formatPackVersion(pack.version)).toMatch(/phase15/);
    expect(pack.soc2Certified).toBe(false);
    expect(pack.iso27001Certified).toBe(false);
    expect(pack.contentHash).toHaveLength(64);
    expect(await verifyPackHash(pack)).toBe(true);
    expect(packManifestJson(pack)).toMatch(/content fingerprint/i);
    expect(packToMarkdown(pack)).toMatch(/Compliance pack/);
    expect(checklistMarkdown()).toMatch(/pré-auditoria/i);
  });

  it("data map + privacy export/erase honestos", () => {
    expect(DATA_MAP.length).toBeGreaterThan(5);
    expect(dataMapMarkdown()).toMatch(/partner_share/);
    let exp = createPrivacyRequest({
      workspaceId: "w",
      type: "export",
      requesterId: "u",
    });
    exp = fulfillExport(exp);
    expect(exp.status).toBe("fulfilled");
    expect(exp.cloudBackupOutOfScope).toBe(true);

    let erase = createPrivacyRequest({
      workspaceId: "w",
      type: "erase",
      requesterId: "u",
    });
    erase = fulfillEraseHonest(erase);
    expect(erase.status).toBe("fulfilled_partial");
    expect(erase.notes).toMatch(/cloud/i);

    expect(() => advancePrivacyRequest(exp, "in_review")).toThrow(/inválida/);
    expect(partnerDsaTemplateMarkdown()).toMatch(/partner_auditor/);
  });

  it("i18n scaffold pt-BR/en + timezone helpers", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("pt")).toBe("pt-BR");
    expect(t("app.compliance.title", "pt-BR")).toMatch(/Compliance/);
    expect(t("app.compliance.title", "en")).toMatch(/Phase 15/);
    expect(listLocales()).toEqual(["pt-BR", "en"]);
    expect(i18nCoverageReport().every((r) => r.keys > 0)).toBe(true);
    expect(periodKeyMonthly(new Date("2026-07-14T15:00:00Z"))).toMatch(/^\d{4}-\d{2}$/);
    expect(periodKeyAnnual(new Date("2026-07-14T15:00:00Z"))).toMatch(/^\d{4}$/);
    expect(timezoneHelpersMarkdown()).toMatch(/America\/Sao_Paulo/);
  });

  it("jurisdição BR ok; foreign engine bloqueado", () => {
    expect(listJurisdictionPacks()).toHaveLength(1);
    expect(JURISDICTION_BR.id).toBe("BR");
    expect(() => assertNoForeignTaxEngine("BR")).not.toThrow();
    expect(() => assertNoForeignTaxEngine("US")).toThrow(/sem engine fiscal/);
    expect(jurisdictionMarkdown()).toMatch(/Brasil/);
  });

  it("health + comercial sem production", async () => {
    expect(COMPLIANCE_PLATFORM_MATURITY).toBe("official_validator_beta");
    const h = await complianceHealth();
    expect(h.packHashOk).toBe(true);
    expect(h.anyForeignTaxEngine).toBe(false);
    expect(h.anyObligationProduction).toBe(false);
    expect(await section28Phase15Report()).toMatch(/Fase 15/);
    const matrix = buildCommercialSupportMatrix();
    expect(assertNoFalseProduction(matrix)).toBe(true);
    expect(matrix.some((r) => r.resource.includes("Compliance pack"))).toBe(true);
    expect(
      Object.values(OBLIGATION_SUPPORT_PROFILES).every((p) => p.maturity !== "production"),
    ).toBe(true);
  });
});
