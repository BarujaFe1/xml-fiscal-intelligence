/**
 * Golden packs versionados por obrigação/UF (marketplace + CI).
 */

import { GOLDEN_PACKS } from "@/modules/homologation/golden-packs";
import type { GoldenPackVersion } from "@/modules/enterprise/types";

/** Versões estáveis — bump só com mudança de fixture. */
export const GOLDEN_PACK_VERSIONS: GoldenPackVersion[] = GOLDEN_PACKS.map((g) => ({
  packId: g.id,
  obligationId: g.obligationId,
  version: "1.0.0-phase12",
  fixtureId: g.fixtureId,
  notes: g.description,
}));

/** Extensões por UF (campanhas) — ainda apontam fixtures sintéticas. */
export const GOLDEN_UF_VERSIONS: GoldenPackVersion[] = [
  {
    packId: "golden_efd_icms_sp",
    obligationId: "efd-icms-ipi",
    uf: "SP",
    version: "1.0.0-phase12",
    fixtureId: "sample_nfe_unit",
    notes: "Célula SP — revalidar PVA antes de validated_scope",
  },
  {
    packId: "golden_contrib_pj",
    obligationId: "efd-contribuicoes",
    uf: "BR",
    version: "1.0.0-phase12",
    fixtureId: "contrib_domain_bloco_m",
    notes: "PGE por cenário",
  },
];

export function listGoldenVersions(obligationId?: string): GoldenPackVersion[] {
  const all = [...GOLDEN_PACK_VERSIONS, ...GOLDEN_UF_VERSIONS];
  if (!obligationId) return all;
  return all.filter((v) => v.obligationId === obligationId);
}

export function resolveGoldenVersion(packId: string): GoldenPackVersion | undefined {
  return listGoldenVersions().find((v) => v.packId === packId);
}
