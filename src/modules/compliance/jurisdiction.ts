/**
 * Jurisdiction packs — BR documentado; foreign engines explicitamente fora.
 */

import type { JurisdictionPack } from "@/modules/compliance/types";

export const JURISDICTION_BR: JurisdictionPack = {
  id: "BR",
  title: "Brasil — SPED / obrigações suportadas pelo produto",
  officialProgramsNoted: [
    "PVA EFD ICMS/IPI",
    "PGE EFD-Contribuições",
    "Programa ECD",
    "Programa ECF",
    "Ambiente EFD-Reinf",
    "DCTFWeb (reconciliação)",
  ],
  outOfScope: [
    "Engines fiscais de outros países (sem fontes oficiais + fixtures)",
    "Inventar alíquotas/vencimentos",
    "Substituir programas oficiais da RFB",
    "Scraping RFB",
  ],
  maturityNote:
    "Jurisdição BR é a única com obrigações implementadas; maturities por obrigação — sem production global.",
};

export function listJurisdictionPacks(): JurisdictionPack[] {
  return [JURISDICTION_BR];
}

export function assertNoForeignTaxEngine(jurisdictionId: string): void {
  if (jurisdictionId !== "BR") {
    throw new Error(
      `Jurisdição ${jurisdictionId} sem engine fiscal — Fase 15 só documenta BR; multi-país exige fontes oficiais`,
    );
  }
}

export function jurisdictionMarkdown(pack: JurisdictionPack = JURISDICTION_BR): string {
  return [
    `# Jurisdição ${pack.id} — ${pack.title}`,
    "",
    pack.maturityNote,
    "",
    "## Programas oficiais notados",
    ...pack.officialProgramsNoted.map((p) => `- ${p}`),
    "",
    "## Fora de escopo",
    ...pack.outOfScope.map((p) => `- ${p}`),
    "",
  ].join("\n");
}
