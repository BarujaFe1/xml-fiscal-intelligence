/**
 * Golden packs — referências de testes CI por obrigação.
 */

import type { GoldenPack } from "@/modules/homologation/types";

export const GOLDEN_PACKS: GoldenPack[] = [
  {
    id: "golden_efd_icms",
    obligationId: "efd-icms-ipi",
    fixtureId: "sample_nfe_unit",
    description: "Geração EFD ICMS/IPI a partir de NF-e sintética",
    testHint: "tests/unit/obligations-all.test.ts",
    required: true,
  },
  {
    id: "golden_contrib_bloco_m",
    obligationId: "efd-contribuicoes",
    fixtureId: "contrib_domain_bloco_m",
    description: "Bloco M a partir do domínio (parcial)",
    testHint: "tests/unit/contrib-engine.test.ts",
    required: true,
  },
  {
    id: "golden_ecd_ledger",
    obligationId: "ecd",
    fixtureId: "ledger_synthetic",
    description: "ECD from ledger",
    testHint: "tests/unit/accounting-engine.test.ts",
    required: true,
  },
  {
    id: "golden_ecf_maps",
    obligationId: "ecf",
    fixtureId: "ecf_maps_official",
    description: "ECF J050 com mapas",
    testHint: "tests/unit/ecf-engine.test.ts",
    required: true,
  },
  {
    id: "golden_reinf_r1000",
    obligationId: "reinf",
    fixtureId: "reinf_r1000_draft",
    description: "Pacote R-1000 JSON",
    testHint: "tests/unit/obligations-all.test.ts",
    required: true,
  },
];

export function listGoldenPacks(obligationId?: string): GoldenPack[] {
  if (!obligationId) return GOLDEN_PACKS;
  return GOLDEN_PACKS.filter((g) => g.obligationId === obligationId);
}

export function goldenCoverageReport(): {
  required: number;
  listed: number;
  byObligation: Record<string, number>;
} {
  const byObligation: Record<string, number> = {};
  for (const g of GOLDEN_PACKS) {
    byObligation[g.obligationId] = (byObligation[g.obligationId] || 0) + 1;
  }
  return {
    required: GOLDEN_PACKS.filter((g) => g.required).length,
    listed: GOLDEN_PACKS.length,
    byObligation,
  };
}
