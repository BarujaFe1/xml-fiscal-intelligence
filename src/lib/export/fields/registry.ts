import catalogSeed from "@/lib/export/fields/catalog-seed.json";
import { defaultFieldDefinitions } from "@/lib/export/fields/defaults";
import type { ExportFieldDefinition } from "@/lib/export/fields/types";
import type { BatchStore, DocumentSummary } from "@/types";

type SeedField = {
  fieldId: string;
  technicalLabel: string;
  humanLabelPtBr: string;
  xmlPaths: string[];
  indexedExample?: string;
  scope: string;
  dataType: string;
  cardinality: string;
  defaultAggregation?: string;
  defaultSelected: boolean;
  defaultOrder?: number;
  catalogVersion: string;
  translationStatus: string;
  coverageHint?: { docs?: number; pct?: string; maxOcc?: number };
};

function normalizePathKey(path: string): string {
  return path
    .replace(/^\/+/, "")
    .replace(/\//g, ".")
    .replace(/\[(\d+)\]/g, "[$1]")
    .replace(/\.@/g, ".@_");
}

function pathVariants(xmlPath: string): string[] {
  const dotted = normalizePathKey(xmlPath);
  const noIndex = dotted.replace(/\[\d+\]/g, "");
  const tail = noIndex.split(".").slice(-3).join(".");
  const tag = noIndex.split(".").pop() || noIndex;
  return [...new Set([dotted, noIndex, tail, tag].filter(Boolean))];
}

/**
 * Merge curated defaults + inventory seed + fields discovered in selected stores.
 */
export function buildFieldRegistry(stores: BatchStore[]): ExportFieldDefinition[] {
  const byId = new Map<string, ExportFieldDefinition>();

  for (const d of defaultFieldDefinitions()) {
    byId.set(d.fieldId, d);
  }

  const seedFields = (catalogSeed as { fields: SeedField[] }).fields || [];
  for (const f of seedFields) {
    if (byId.has(f.fieldId)) continue;
    // Skip if logical default already covers same primary path
    const paths = (f.xmlPaths || []).flatMap(pathVariants);
    byId.set(f.fieldId, {
      fieldId: f.fieldId,
      technicalLabel: f.technicalLabel,
      humanLabelPtBr: f.humanLabelPtBr,
      xmlPaths: paths.length ? paths : [f.technicalLabel],
      indexedExample: f.indexedExample,
      scope: f.scope,
      dataType: f.dataType,
      cardinality: f.cardinality === "many" ? "many" : "optional",
      defaultAggregation: f.defaultAggregation as ExportFieldDefinition["defaultAggregation"],
      defaultSelected: false,
      defaultOrder: f.defaultOrder,
      catalogVersion: f.catalogVersion || "inventory-202606-nfe",
      translationStatus:
        f.translationStatus === "oficial" || f.translationStatus === "official"
          ? "official"
          : f.translationStatus === "curated"
            ? "curated"
            : "generated",
      coverageHint: f.coverageHint,
    });
  }

  // Index curated paths once — O(fields), not O(docs × paths × fields).
  const coveredExact = new Set<string>();
  const coveredTags = new Set<string>();
  for (const def of byId.values()) {
    for (const p of def.xmlPaths) {
      coveredExact.add(p);
      const tag = p.split(".").pop();
      if (tag) coveredTags.add(tag);
    }
  }

  // Discover unknown flattened paths from selected stores (bounded).
  const DISCOVER_CAP = 2500;
  let discovered = 0;
  for (const store of stores) {
    if (discovered >= DISCOVER_CAP) break;
    for (const doc of store.documents) {
      if (discovered >= DISCOVER_CAP) break;
      discovered += discoverFromDoc(doc, byId, coveredExact, coveredTags, DISCOVER_CAP - discovered);
    }
  }

  return [...byId.values()].sort((a, b) => {
    const ao = a.defaultOrder ?? 9999;
    const bo = b.defaultOrder ?? 9999;
    if (ao !== bo) return ao - bo;
    return a.humanLabelPtBr.localeCompare(b.humanLabelPtBr, "pt-BR");
  });
}

function discoverFromDoc(
  doc: DocumentSummary,
  byId: Map<string, ExportFieldDefinition>,
  coveredExact: Set<string>,
  coveredTags: Set<string>,
  remaining: number,
): number {
  let added = 0;
  for (const path of Object.keys(doc.flattenedJson || {})) {
    if (added >= remaining) break;
    const id = `discovered:${path}`;
    if (byId.has(id)) continue;
    const tag = path.split(".").pop() || path;
    if (coveredExact.has(path) || coveredTags.has(tag)) continue;
    byId.set(id, {
      fieldId: id,
      technicalLabel: path,
      humanLabelPtBr: tag,
      xmlPaths: [path],
      scope: "other",
      dataType: "text",
      cardinality: /\[\d+\]/.test(path) ? "many" : "optional",
      defaultSelected: false,
      catalogVersion: "discovered",
      translationStatus: "review_needed",
    });
    coveredExact.add(path);
    added += 1;
  }
  return added;
}

export function searchFieldRegistry(
  fields: ExportFieldDefinition[],
  query: string,
): ExportFieldDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return fields;
  return fields.filter(
    (f) =>
      f.humanLabelPtBr.toLowerCase().includes(q) ||
      f.technicalLabel.toLowerCase().includes(q) ||
      f.fieldId.toLowerCase().includes(q) ||
      f.xmlPaths.some((p) => p.toLowerCase().includes(q)) ||
      (f.requestedHeader || "").toLowerCase().includes(q),
  );
}

export function catalogStats() {
  const seed = catalogSeed as { counts?: Record<string, number>; fields?: unknown[] };
  return {
    seedFieldCount: seed.fields?.length || 0,
    counts: seed.counts || {},
  };
}
