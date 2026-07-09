import { v4 as uuidv4 } from "uuid";
import type { DocumentItem, DocumentRelationship, DocumentSummary, RelationshipType } from "@/types";

function rel(
  partial: Omit<DocumentRelationship, "id" | "createdAt">,
): DocumentRelationship {
  return {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Infer document relationships within a batch (NF-e ↔ CT-e, duplicates, etc.).
 */
export function buildDocumentRelationships(input: {
  workspaceId: string;
  documents: DocumentSummary[];
  items: DocumentItem[];
}): DocumentRelationship[] {
  const { workspaceId, documents, items } = input;
  const out: DocumentRelationship[] = [];
  const byKey = new Map<string, DocumentSummary>();
  for (const d of documents) {
    if (d.accessKey) byKey.set(d.accessKey, d);
  }

  // CT-e items referencing NF-e keys
  for (const d of documents.filter((x) => x.documentType === "CTE")) {
    const linked = items.filter((i) => i.documentId === d.id);
    for (const item of linked) {
      const keyCandidate =
        (item.code && item.code.replace(/\D/g, "").length === 44 ? item.code.replace(/\D/g, "") : undefined) ||
        (item.description || "").match(/\b(\d{44})\b/)?.[1];
      if (!keyCandidate) continue;
      const nfe = byKey.get(keyCandidate);
      if (!nfe) continue;
      out.push(
        rel({
          workspaceId,
          sourceDocumentId: d.id,
          targetDocumentId: nfe.id,
          relationshipType: "cte_to_nfe",
          confidenceScore: 0.92,
          evidence: { accessKey: keyCandidate, via: "infDoc/item" },
        }),
      );
      out.push(
        rel({
          workspaceId,
          sourceDocumentId: nfe.id,
          targetDocumentId: d.id,
          relationshipType: "nfe_to_cte",
          confidenceScore: 0.92,
          evidence: { accessKey: keyCandidate, via: "infDoc/item" },
        }),
      );
    }
  }

  // Hash / key duplicates
  const hashGroups = new Map<string, DocumentSummary[]>();
  for (const d of documents) {
    if (!d.xmlHash) continue;
    const g = hashGroups.get(d.xmlHash) || [];
    g.push(d);
    hashGroups.set(d.xmlHash, g);
  }
  for (const [, group] of hashGroups) {
    if (group.length < 2) continue;
    for (let i = 1; i < group.length; i++) {
      out.push(
        rel({
          workspaceId,
          sourceDocumentId: group[0].id,
          targetDocumentId: group[i].id,
          relationshipType: "duplicate",
          confidenceScore: 1,
          evidence: { xmlHash: group[0].xmlHash },
        }),
      );
    }
  }

  // Possible return: CFOP devolução + same emitter/receiver pair near date
  const nfeDocs = documents.filter((d) => d.documentType === "NFE");
  for (const d of nfeDocs) {
    if (d.operationClassification !== "devolucao") continue;
    const candidates = nfeDocs.filter(
      (o) =>
        o.id !== d.id &&
        o.operationClassification === "venda" &&
        o.emitterDoc &&
        d.receiverDoc &&
        o.emitterDoc === d.receiverDoc,
    );
    for (const c of candidates.slice(0, 3)) {
      out.push(
        rel({
          workspaceId,
          sourceDocumentId: d.id,
          targetDocumentId: c.id,
          relationshipType: "nfe_to_return",
          confidenceScore: 0.45,
          evidence: {
            rule: "devolucao_vs_venda_cnpj",
            note: "Heurística fraca — revisar manualmente",
          },
        }),
      );
    }
  }

  return out;
}

export function relationshipLabel(type: RelationshipType): string {
  const map: Record<RelationshipType, string> = {
    nfe_to_cte: "NF-e → CT-e",
    cte_to_nfe: "CT-e → NF-e",
    nfe_to_cancellation: "NF-e → Cancelamento",
    nfe_to_correction_letter: "NF-e → CC-e",
    nfe_to_event: "NF-e → Evento",
    nfe_to_return: "NF-e → Devolução (possível)",
    duplicate: "Duplicata",
    possible_duplicate: "Possível duplicata",
    manual_link: "Vínculo manual",
  };
  return map[type] || type;
}
