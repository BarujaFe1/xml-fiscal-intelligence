import catalogJson from "@/modules/obligations/reinf/catalog/events-2026.1.json";

export type ReinfCatalogEvent = {
  code: string;
  series: string;
  label: string;
  implemented: boolean;
  requiresPeriod: boolean;
  candidateFromXml?: string;
};

export type ReinfCatalog = {
  version: string;
  sourceIds: string[];
  notes: string;
  events: ReinfCatalogEvent[];
};

export const REINF_CATALOG: ReinfCatalog = catalogJson as ReinfCatalog;

export function getCatalogEvent(code: string): ReinfCatalogEvent | undefined {
  return REINF_CATALOG.events.find((e) => e.code === code);
}

export function listImplementedEvents(): ReinfCatalogEvent[] {
  return REINF_CATALOG.events.filter((e) => e.implemented);
}
