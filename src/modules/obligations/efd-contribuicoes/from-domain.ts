/**
 * Monta EFD-Contribuições a partir do domínio de apuração (+ XML opcional para A100).
 */

import type {
  ObligationBuildResult,
  ObligationContext,
  ObligationRecord,
  LineageEntry,
} from "@/modules/obligations/core/types";
import { appendSpedClosers } from "@/modules/obligations/core/pipe";
import type { ContribSnapshot } from "@/modules/contrib/types";
import { assertRegimeForPeriod } from "@/modules/contrib/regimes";
import { modeDisclaimer } from "@/modules/contrib/modes";
import { cataloguedRuleImpacts } from "@/modules/contrib/rule-sets";
import { buildBlocoMDrafts } from "@/modules/contrib/bloco-m";
import { findIllicitCredits } from "@/modules/contrib/books";

export const EFD_CONTRIB_LAYOUT_2026 = "EFD_CONTRIB_2026_DRAFT";

function yymm(periodStart: string): string {
  const [y, m] = periodStart.split("-");
  return `${m}${y}`;
}

export function buildContribFromDomain(
  context: ObligationContext,
  snap: ContribSnapshot,
): ObligationBuildResult {
  const warnings: string[] = [
    modeDisclaimer(snap.mode),
    "Bloco A (XML) permanece opcional; apuração Bloco M vem do domínio — sem soma silenciosa de A170.",
    ...cataloguedRuleImpacts(context.periodStart),
  ];
  const lineage: LineageEntry[] = [];
  const records: ObligationRecord[] = [];

  const regime = assertRegimeForPeriod(snap.regimeCode, context.periodStart);
  if (!regime.ok || !regime.profile) {
    warnings.push(regime.message || "Regime inválido");
  }
  const p = regime.profile;

  records.push({
    type: "0000",
    fields: [
      EFD_CONTRIB_LAYOUT_2026,
      "0",
      yymm(context.periodStart),
      context.periodStart.replace(/-/g, ""),
      context.periodEnd.replace(/-/g, ""),
      context.companyName.slice(0, 100),
      context.cnpj.replace(/\D/g, "").slice(0, 14),
      context.uf,
      "00",
      context.ie || "",
      "",
      "",
      context.purpose || "0",
      "1",
    ],
  });
  records.push({ type: "0001", fields: ["0"] });
  records.push({
    type: "0110",
    fields: [
      p?.indCodIncTrib || "1",
      p?.indAproCred || "1",
      p?.indTipoContri || "1",
      p?.indRegCum || "0",
    ],
  });
  warnings.push(
    p
      ? `0110 tipificado pelo regime ${p.code} (source ${p.sourceId})`
      : "0110 fallback — regime sem perfil",
  );
  records.push({
    type: "0140",
    fields: [
      context.establishmentId.slice(0, 60),
      context.companyName.slice(0, 100),
      context.cnpj.replace(/\D/g, "").slice(0, 14),
      context.uf,
      context.ie || "",
      "",
      "",
      "",
      "",
    ],
  });

  // XML docs still feed A100 when present
  const parties = new Map<string, { name: string; uf?: string }>();
  for (const d of context.documents) {
    if (d.emitterDoc) parties.set(d.emitterDoc, { name: d.emitterName || "", uf: d.emitterUf });
    if (d.receiverDoc) parties.set(d.receiverDoc, { name: d.receiverName || "", uf: d.receiverUf });
  }
  let partCode = 1;
  for (const [doc, party] of parties) {
    const cod = String(partCode++).padStart(4, "0");
    records.push({
      type: "0150",
      fields: [
        cod,
        party.name.slice(0, 100),
        "1058",
        "1",
        doc.replace(/\W/g, "").slice(0, 14),
        "",
        "",
        party.uf || "",
        "",
        "",
        "",
      ],
    });
  }
  records.push({ type: "0190", fields: ["UN", "UNIDADE"] });
  const itemsByCode = new Map<string, { desc: string; ncm?: string; unit?: string }>();
  for (const d of context.documents) {
    for (const it of d.items) {
      const code = it.code || `ITEM${it.itemNumber}`;
      if (!itemsByCode.has(code)) {
        itemsByCode.set(code, { desc: it.description || code, ncm: it.ncm, unit: it.unit || "UN" });
      }
    }
  }
  for (const [code, it] of itemsByCode) {
    records.push({
      type: "0200",
      fields: [code.slice(0, 60), it.desc.slice(0, 120), "", it.unit || "UN", "00", it.ncm || "", "", "", ""],
    });
  }
  records.push({
    type: "0990",
    fields: [String(2 + parties.size + 1 + itemsByCode.size + 2)],
  });

  records.push({ type: "A001", fields: [context.documents.length ? "0" : "1"] });
  if (context.documents.length) {
    records.push({ type: "A010", fields: [context.cnpj.replace(/\D/g, "").slice(0, 14)] });
    for (const d of context.documents) {
      records.push({
        type: "A100",
        fields: [
          d.indOper || "1",
          d.indEmit || "0",
          d.emitterDoc?.replace(/\W/g, "").slice(0, 14) || "",
          "01",
          d.codSit || "00",
          d.series || "0",
          d.number || "",
          d.accessKey || "",
          (d.issueDate || "").slice(0, 10).replace(/-/g, ""),
          (d.issueDate || "").slice(0, 10).replace(/-/g, ""),
          d.totalValue || "0",
          "0",
          d.discountValue || "0",
          "0",
          d.productsValue || d.totalValue || "0",
          "0",
          "0",
          "0",
        ],
      });
      lineage.push({
        record: "A100",
        field: "VL_DOC",
        value: d.totalValue || "0",
        sourceType: "xml",
        sourceRef: d.id,
        xmlPath: d.xmlPathHints?.vNF,
      });
      for (const it of d.items) {
        records.push({
          type: "A170",
          fields: [
            String(it.itemNumber),
            it.code || "",
            it.description?.slice(0, 120) || "",
            it.quantity || "0",
            it.unitValue || "0",
            it.totalValue || "0",
            it.discountValue || "0",
            it.tax.pis.cst || "",
            it.tax.pis.vBc || "0",
            it.tax.pis.pAliq || "0",
            it.tax.pis.vValor || "0",
            it.tax.cofins.cst || "",
            it.tax.cofins.vBc || "0",
            it.tax.cofins.pAliq || "0",
            it.tax.cofins.vValor || "0",
            it.cfop || "",
          ],
        });
      }
    }
  }
  const aCount = records.filter((r) => r.type.startsWith("A")).length + 1;
  records.push({ type: "A990", fields: [String(aCount)] });

  const illicit = findIllicitCredits(snap.entries);
  if (illicit.length) {
    warnings.push(`${illicit.length} crédito(s) ilícito(s) ignorados`);
  }

  const { drafts, warnings: mWarn } = buildBlocoMDrafts(snap);
  warnings.push(...mWarn);
  if (!drafts.length) {
    records.push({ type: "M001", fields: ["1"] });
    records.push({ type: "M990", fields: ["2"] });
  } else {
    records.push({ type: "M001", fields: ["0"] });
    for (const d of drafts) {
      records.push({ type: d.type, fields: d.fields });
      lineage.push({
        record: d.type,
        field: "APURACAO",
        value: d.fields.join("|"),
        sourceType: "manual",
        sourceRef: d.lineageNote,
        transformation: "domain_bloco_m",
      });
    }
    const mCount = records.filter((r) => r.type.startsWith("M")).length + 1;
    records.push({ type: "M990", fields: [String(mCount)] });
  }

  const closed = appendSpedClosers(records, warnings);
  return {
    obligationId: "efd-contribuicoes",
    layoutVersion: EFD_CONTRIB_LAYOUT_2026,
    records: closed,
    lineage,
    warnings,
  };
}
