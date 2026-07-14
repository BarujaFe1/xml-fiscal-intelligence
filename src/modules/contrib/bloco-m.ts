/**
 * Bloco M — créditos/débitos com lineage; sem soma silenciosa M100/M500.
 */

import type { BlocoMRecordDraft, ContribSnapshot } from "@/modules/contrib/types";
import { findIllicitCredits, sumByKind } from "@/modules/contrib/books";
import { applyRateio, validateRateio } from "@/modules/contrib/rateio";

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/**
 * Gera rascunho M100/M500 a partir de somas **explícitas** do domínio.
 * Não agrega valores de A170 automaticamente.
 */
export function buildBlocoMDrafts(snap: ContribSnapshot): {
  drafts: BlocoMRecordDraft[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const illicit = findIllicitCredits(snap.entries);
  if (illicit.length) {
    warnings.push(
      `${illicit.length} crédito(s) sem creditExplicit — omitidos do Bloco M (não inventar)`,
    );
  }

  const rateioIssues = validateRateio(snap.rateio);
  for (const i of rateioIssues) warnings.push(i.message);

  const entries = snap.entries.filter(
    (e) => e.periodKey === snap.periodKey || snap.mode === "historical_and_credit_management",
  );
  const safe = entries.filter((e) => e.kind !== "credit" || e.creditExplicit);

  const credit = sumByKind(safe, "credit");
  const debit = sumByKind(safe, "debit");
  const revenue = sumByKind(safe, "revenue");
  const retention = sumByKind(safe, "retention");
  const adjustment = sumByKind(safe, "adjustment");
  const cprb = sumByKind(safe, "cprb");

  if (credit === 0 && debit === 0 && revenue === 0) {
    return {
      drafts: [],
      warnings: [
        ...warnings,
        "Sem movimentos de apuração no domínio — Bloco M sem movimento (M001=1)",
      ],
    };
  }

  const drafts: BlocoMRecordDraft[] = [];

  // M100 — crédito PIS (estrutura draft)
  if (credit > 0) {
    let slices: ReturnType<typeof applyRateio>;
    try {
      slices = applyRateio(credit, snap.rateio, "pis_credit");
    } catch (e) {
      warnings.push(String(e));
      slices = [{ label: "integral", amount: credit, weight: 1 }];
    }
    for (const s of slices) {
      drafts.push({
        type: "M100",
        fields: [
          "101", // COD_CRED tipificado demo — conferir tabela oficial
          "0",
          fmt(s.amount),
          "0",
          "0",
          fmt(s.amount),
          "0",
          "0",
        ],
        lineageNote: `crédito domínio rateio=${s.label} weight=${s.weight} — COD_CRED conferir PGE`,
      });
    }
    warnings.push("M100 COD_CRED=101 é marcador de rascunho — validar no PGE");
  }

  // M500 — crédito COFINS (espelho estrutural)
  if (credit > 0) {
    drafts.push({
      type: "M500",
      fields: ["101", "0", fmt(credit), "0", "0", fmt(credit), "0", "0"],
      lineageNote: "crédito domínio espelho COFINS — sem soma silenciosa de A170",
    });
  }

  // M200 / M600 — contribuição a recolher (débito − crédito), só com débitos explícitos
  const toPayPis = Math.max(0, debit + revenue * 0 - credit);
  // Use explicit debit entries only for "a recolher" base — revenue alone does NOT invent tax
  if (debit > 0 || credit > 0) {
    const pisPay = Math.max(0, debit - credit);
    drafts.push({
      type: "M200",
      fields: [fmt(debit), fmt(credit), fmt(pisPay), "0", "0", fmt(pisPay)],
      lineageNote: `débito=${debit} crédito=${credit} a_recolher=${pisPay} — sem alíquota inventada sobre revenue`,
    });
    drafts.push({
      type: "M600",
      fields: [fmt(debit), fmt(credit), fmt(pisPay), "0", "0", fmt(pisPay)],
      lineageNote: "espelho COFINS estrutural a partir dos mesmos totais explícitos",
    });
    void toPayPis;
  }

  if (retention > 0) {
    drafts.push({
      type: "M350",
      fields: [fmt(retention)],
      lineageNote: "retenções explícitas no domínio",
    });
  }
  if (adjustment !== 0) {
    drafts.push({
      type: "M110",
      fields: [adjustment >= 0 ? "0" : "1", fmt(Math.abs(adjustment)), "ajuste domínio"],
      lineageNote: "ajuste explícito (NT 12/2026: não inventar redução)",
    });
  }
  if (cprb > 0) {
    drafts.push({
      type: "M700",
      fields: [fmt(cprb)],
      lineageNote: "CPRB explícita no domínio",
    });
  }

  return { drafts, warnings };
}
