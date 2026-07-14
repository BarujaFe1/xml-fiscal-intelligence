/**
 * Extração honesta de hints RTC do XML — nunca inventa alíquota/valor.
 * Estende observeRtcTags com fatos parciais quando atributos explícitos existem.
 */

import { observeRtcTags } from "@/lib/parser/rtc-observe";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { RtcFact, RtcTaxKind } from "@/modules/rtc/types";
import { resolveRtcPeriodSplit } from "@/modules/rtc/period";

export type RtcExtractResult = {
  parsingEnabled: boolean;
  observation: ReturnType<typeof observeRtcTags>;
  facts: RtcFact[];
  warnings: string[];
};

function parseExplicitAmount(raw: string | undefined): string | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  return String(raw).trim();
}

/**
 * Tenta ler pares tag≈valor em XML simplificado (não é XSD oficial).
 * Só preenche rate/tax quando o número aparece ao lado da tag no texto.
 */
export function extractRtcFactsFromXml(input: {
  workspaceId: string;
  companyId: string;
  periodKey: string;
  documentRef?: string;
  rawXml?: string;
  flattened?: Record<string, string>;
}): RtcExtractResult {
  const parsingEnabled = isFeatureEnabled("rtcParsing");
  const warnings: string[] = [];
  const observation = observeRtcTags({
    flattenedKeys: input.flattened ? Object.keys(input.flattened) : undefined,
    rawXml: input.rawXml,
  });

  if (!parsingEnabled) {
    return {
      parsingEnabled: false,
      observation,
      facts: [],
      warnings: ["FEATURE_RTC_PARSING off — observação disponível, fatos não materializados"],
    };
  }

  const now = new Date().toISOString();
  const split = resolveRtcPeriodSplit(input.periodKey).split;
  const facts: RtcFact[] = [];
  const sourceId = "official:reforma:consumo-2026";

  const kindHints: Array<{ re: RegExp; kind: RtcTaxKind }> = [
    { re: /\b(p|v)?CBS\b/i, kind: "CBS" },
    { re: /\b(p|v)?IBS\b/i, kind: "IBS_UF" },
    { re: /\bCRTB\b/i, kind: "CRTB" },
    { re: /\b(p|v)?IS\b|impostoSeletivo/i, kind: "IS" },
  ];

  if (input.flattened) {
    for (const [key, val] of Object.entries(input.flattened)) {
      for (const h of kindHints) {
        if (!h.re.test(key)) continue;
        const amount = parseExplicitAmount(val);
        const looksLikeRate = /pCBS|pIBS|aliq|rate|percent/i.test(key);
        facts.push({
          id: `rtc_xml_${h.kind}_${key}_${facts.length}`,
          workspaceId: input.workspaceId,
          companyId: input.companyId,
          periodKey: input.periodKey,
          split,
          documentRef: input.documentRef,
          taxKind: h.kind,
          rateExplicit: looksLikeRate ? amount : undefined,
          taxAmountExplicit: !looksLikeRate ? amount : undefined,
          creditExplicit: false,
          origin: "xml_observed",
          sourceId,
          lineageNote: `flatten:${key}` + (amount ? "" : " (sem valor numérico — não inventado)"),
          createdAt: now,
          updatedAt: now,
        });
        if (!amount) {
          warnings.push(`Tag/campo ${key} observado sem valor numérico — fato sem alíquota/imposto`);
        }
      }
    }
  } else if (observation.hasRtcHints) {
    warnings.push(
      "Hints RTC no XML sem flatten tipificado — fatos vazios (não inventar). Use flattened keys quando disponíveis.",
    );
  }

  return { parsingEnabled, observation, facts, warnings };
}
