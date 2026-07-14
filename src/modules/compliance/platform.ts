/**
 * Maturidade compliance (Fase 15).
 */

import type { ComplianceMaturity } from "@/modules/compliance/types";
import { buildCompliancePack, verifyPackHash, formatPackVersion } from "@/modules/compliance/pack";
import { DATA_MAP } from "@/modules/compliance/lgpd";
import { i18nCoverageReport } from "@/modules/compliance/i18n";
import { listJurisdictionPacks } from "@/modules/compliance/jurisdiction";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";

/** Prep official_validator_beta — pack exportável; obrigações permanecem honestas. */
export const COMPLIANCE_PLATFORM_MATURITY: ComplianceMaturity = "official_validator_beta";

export const COMPLIANCE_CAPABILITIES = [
  "compliance pack versionado + contentHash",
  "checklist pré-auditoria renovável",
  "data map LGPD + privacy export/erase honestos",
  "partner DSA template",
  "i18n pt-BR + en scaffold",
  "timezone/periodKey helpers",
  "jurisdiction pack BR (foreign engines fora)",
] as const;

export async function complianceHealth(): Promise<{
  maturity: ComplianceMaturity;
  noProductionClaim: true;
  packVersion: string;
  packHashOk: boolean;
  dataMapEntries: number;
  i18nLocales: number;
  jurisdictions: number;
  anyObligationProduction: boolean;
  anyForeignTaxEngine: false;
}> {
  const pack = await buildCompliancePack();
  return {
    maturity: COMPLIANCE_PLATFORM_MATURITY,
    noProductionClaim: true,
    packVersion: formatPackVersion(pack.version),
    packHashOk: await verifyPackHash(pack),
    dataMapEntries: DATA_MAP.length,
    i18nLocales: i18nCoverageReport().length,
    jurisdictions: listJurisdictionPacks().length,
    anyObligationProduction: Object.values(OBLIGATION_SUPPORT_PROFILES).some(
      (p) => p.maturity === "production",
    ),
    anyForeignTaxEngine: false,
  };
}

export async function section28Phase15Report(): Promise<string> {
  const h = await complianceHealth();
  return [
    "# Relatório §28 — Fase 15 (Compliance pack · LGPD · i18n)",
    "",
    `Maturidade plataforma: \`${COMPLIANCE_PLATFORM_MATURITY}\``,
    "",
    "## Capacidades",
    ...COMPLIANCE_CAPABILITIES.map((c) => `- ${c}`),
    "",
    "## Checks",
    `- pack ${h.packVersion} hashOk=${h.packHashOk}`,
    `- data map entries: ${h.dataMapEntries}`,
    `- locales: ${h.i18nLocales}`,
    `- jurisdictions: ${h.jurisdictions}`,
    `- foreign tax engine: ${h.anyForeignTaxEngine}`,
    "",
    "## Não claims",
    "- Sem SOC2/ISO emitido",
    "- Sem production global",
    "- Sem engines fiscais estrangeiros",
    "- Erase não apaga backups cloud automaticamente",
    "",
  ].join("\n");
}
