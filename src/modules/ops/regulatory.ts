/**
 * Catálogo regulatório — identified → reviewed → published; sem auto-ativar regras.
 */

import type { RegulatoryCatalogItem } from "@/modules/ops/types";
import { OFFICIAL_SOURCE_CATALOG } from "@/modules/obligations/core/sources/catalog";

export function seedRegulatoryFromOfficialSources(): RegulatoryCatalogItem[] {
  const now = new Date().toISOString();
  return OFFICIAL_SOURCE_CATALOG.map((s) => ({
    id: `reg_${s.id}`,
    sourceId: s.id,
    title: s.title,
    obligationId: (s.obligation as RegulatoryCatalogItem["obligationId"]) || "platform",
    status: "identified" as const,
    activatesRuleSet: false as const,
    notes: "Publicar só após revisão humana; nunca auto-ativa rule_set",
    updatedAt: now,
  }));
}

export function advanceRegulatoryStatus(
  item: RegulatoryCatalogItem,
  to: RegulatoryCatalogItem["status"],
): RegulatoryCatalogItem {
  const order = { identified: 0, reviewed: 1, published: 2 };
  if (order[to] < order[item.status]) {
    throw new Error("não regride status do catálogo");
  }
  if (to === "published" && item.activatesRuleSet) {
    throw new Error("publicado não pode ativar rule_set automaticamente");
  }
  return {
    ...item,
    status: to,
    activatesRuleSet: false,
    updatedAt: new Date().toISOString(),
  };
}
