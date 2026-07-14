/**
 * Índice de snippets aprovados a partir do OFFICIAL_SOURCE_CATALOG.
 * Sem alíquotas/vencimentos — apenas metadados oficiais + orientação de processo.
 */

import {
  getOfficialSource,
  listOfficialSourcesByObligation,
  OFFICIAL_SOURCE_CATALOG,
  type OfficialSourceRecord,
} from "@/modules/obligations/core/sources/catalog";
import type { OfficialSnippet } from "@/modules/assurance/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

function toSnippet(rec: OfficialSourceRecord): OfficialSnippet {
  const parts = [
    rec.title,
    rec.versionLabel ? `versão documentada: ${rec.versionLabel}` : undefined,
    rec.layoutVersion ? `layout: ${rec.layoutVersion}` : undefined,
    rec.notes,
    "Consulte a URL oficial; não invente alíquotas ou vencimentos a partir deste assistente.",
  ].filter(Boolean);
  return {
    sourceId: rec.id,
    title: rec.title,
    url: rec.url,
    snippet: parts.join(" — "),
    obligation: rec.obligation,
  };
}

/** Snippets aprovados = projeção do catálogo oficial (sem texto inventado de tributo). */
export function listApprovedOfficialSnippets(obligationId?: ObligationId): OfficialSnippet[] {
  const rows = obligationId
    ? listOfficialSourcesByObligation(obligationId)
    : OFFICIAL_SOURCE_CATALOG.slice(0, 8);
  return rows.map(toSnippet);
}

export function resolveCitation(sourceId: string): OfficialSnippet | undefined {
  const rec = getOfficialSource(sourceId);
  return rec ? toSnippet(rec) : undefined;
}

export function pickGroundingSources(input: {
  obligationId?: ObligationId;
  question: string;
}): OfficialSnippet[] {
  const byObligation = input.obligationId
    ? listApprovedOfficialSnippets(input.obligationId)
    : [];
  if (byObligation.length) return byObligation.slice(0, 4);

  // Fallback: portal SPED + downloads genéricos
  const fallbackIds = [
    "official:sped:portal",
    "official:sped:rfb",
    "official:sped:downloads",
  ];
  return fallbackIds
    .map((id) => resolveCitation(id))
    .filter((s): s is OfficialSnippet => Boolean(s));
}

export function citationsMarkdown(snippets: OfficialSnippet[]): string {
  return snippets.map((s) => `- [${s.sourceId}] ${s.title}: ${s.url}`).join("\n");
}
