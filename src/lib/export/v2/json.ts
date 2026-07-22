import type { ExportDatasetV2, ExportJsonProfile } from "@/lib/export/v2/types";

function omitEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export function buildJsonFromDataset(
  dataset: ExportDatasetV2,
  profile: ExportJsonProfile = "compact",
): string {
  if (profile === "jsonl") {
    return buildJsonlFromDataset(dataset);
  }
  if (profile === "flat") {
    return JSON.stringify(
      {
        schemaVersion: dataset.schemaVersion,
        manifest: dataset.manifest,
        documents: dataset.documents.map((d) => ({
          "_xfi.id": d.id,
          "_xfi.documentType": d.documentType,
          "_xfi.fileName": d.fileName,
          "_xfi.accessKey": d.accessKey,
          "_xfi.number": d.number,
          "_xfi.series": d.series,
          "_xfi.issueDate": d.issueDate,
          "_xfi.totalValue": d.totalValue,
          "_xfi.emitterDoc": d.emitterDoc,
          "_xfi.emitterName": d.emitterName,
          "_xfi.receiverDoc": d.receiverDoc,
          "_xfi.receiverName": d.receiverName,
          "_xfi.parseStatus": d.parseStatus,
          ...(d.flattenedJson || {}),
        })),
      },
      null,
      2,
    );
  }

  const compactDocs = dataset.documents.map((d) => {
    if (profile === "audit_full") {
      return d;
    }
    const rest = { ...d };
    delete rest.flattenedJson;
    delete rest.rawJson;
    return omitEmpty(rest as unknown as Record<string, unknown>);
  });
  const compactItems = dataset.items.map((i) => {
    if (profile === "audit_full") return i;
    const rest = { ...i };
    delete rest.taxJson;
    delete rest.flattenedJson;
    return omitEmpty(rest as unknown as Record<string, unknown>);
  });

  const payload = {
    schemaVersion: dataset.schemaVersion,
    manifest: dataset.manifest,
    summary: dataset.summary,
    privacy: dataset.privacy,
    selection: {
      foundCount: dataset.selection.foundIds.length,
      missingCount: dataset.selection.missingIds.length,
      filters: dataset.selection.filters,
      snappedAt: dataset.selection.snappedAt,
      // Avoid duplicating huge ID lists when counts already exist — include IDs for auditability
      foundIds: dataset.selection.foundIds,
      missingIds: dataset.selection.missingIds,
    },
    documents: compactDocs,
    items: compactItems,
    findings: dataset.findings,
    relationships: dataset.relationships,
    rawXmlAvailability: dataset.rawXmlAvailability,
    profile,
    note:
      profile === "audit_full"
        ? "Perfil audit_full: inclui estruturas brutas/achatadas intencionalmente (maior tamanho e sensibilidade)."
        : "Perfil compact: apenas campos normalizados; sem rawJson/flattenedJson.",
  };

  return JSON.stringify(payload, null, 2);
}

export function buildJsonlFromDataset(dataset: ExportDatasetV2): string {
  const lines: string[] = [];
  lines.push(
    JSON.stringify({
      _xfi: "header",
      schemaVersion: dataset.schemaVersion,
      generationId: dataset.manifest.generationId,
      summary: dataset.summary,
      privacy: dataset.privacy,
    }),
  );
  const itemsByDoc = new Map<string, typeof dataset.items>();
  for (const item of dataset.items) {
    const list = itemsByDoc.get(item.documentId) || [];
    list.push(item);
    itemsByDoc.set(item.documentId, list);
  }
  for (const d of dataset.documents) {
    const rest = { ...d };
    delete rest.flattenedJson;
    delete rest.rawJson;
    lines.push(
      JSON.stringify({
        _xfi: "document",
        ...rest,
        items: (itemsByDoc.get(d.id) || []).map((i) => {
          const ir = { ...i };
          delete ir.taxJson;
          delete ir.flattenedJson;
          return ir;
        }),
      }),
    );
  }
  return lines.join("\n") + "\n";
}
