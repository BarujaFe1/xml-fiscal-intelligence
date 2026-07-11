import type {
  FiscalObligationPlugin,
  ObligationBuildResult,
  ObligationContext,
  ObligationRecord,
  RequiredDataResult,
  ValidationResult,
} from "@/modules/obligations/core/types";
import {
  appendSpedClosers,
  defaultManifest,
  serializePipeRecords,
} from "@/modules/obligations/core/pipe";

export const EFD_CONTRIB_LAYOUT_2026 = "EFD_CONTRIB_2026_DRAFT";
export const EFD_CONTRIB_SOURCE_ID = "official:sped:efd-contribuicoes:pending-registry";

const DISCLAIMER =
  "Geração assistida de EFD-Contribuições (rascunho). Não é validação do PVA EFD-Contribuições, não cobre transição 2027 e não é parecer fiscal. Conferir CST PIS/COFINS e regime no PVA oficial.";

function yymm(periodStart: string): string {
  const [y, m] = periodStart.split("-");
  return `${m}${y}`;
}

function detect(context: ObligationContext): RequiredDataResult {
  const items = [
    {
      id: "cnpj",
      label: "CNPJ do contribuinte",
      status: context.cnpj ? ("complete" as const) : ("blocking" as const),
      remediation: "Informe o CNPJ do estabelecimento",
    },
    {
      id: "period",
      label: "Período de apuração",
      status: context.periodStart && context.periodEnd ? ("complete" as const) : ("blocking" as const),
    },
    {
      id: "docs",
      label: "Documentos NF-e/NFC-e no lote",
      status: context.documents.length ? ("complete" as const) : ("blocking" as const),
      message: `${context.documents.length} documento(s)`,
    },
    {
      id: "pis_cofins",
      label: "PIS/COFINS nos itens (quando presentes no XML)",
      status: "review" as const,
      message: "Valores ausentes ficam zerados — não inventamos alíquotas",
    },
    {
      id: "transition_2027",
      label: "Transição CBS/IBS 2027+",
      status: "unsupported" as const,
      message: "Fora do escopo deste layout draft",
    },
  ];
  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return { items, canGenerate: blockingCount === 0, blockingCount };
}

function build(context: ObligationContext): ObligationBuildResult {
  const warnings: string[] = [
    "Bloco M (apuração) omitido sem saldos/créditos manuais — preencher no PVA se necessário.",
    "Layout draft interno — não substitui Guia Prático oficial da RFB.",
  ];
  const records: ObligationRecord[] = [];
  const lineage = [];

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
    fields: ["1", "1", "1", "1"], // IND_COD_INC_TRIB etc — demo defaults marked in warning
  });
  warnings.push("0110 usa indicadores demo (1/1/1/1) — ajustar ao regime real da empresa.");
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

  const parties = new Map<string, { name: string; uf?: string }>();
  for (const d of context.documents) {
    if (d.emitterDoc) parties.set(d.emitterDoc, { name: d.emitterName || "", uf: d.emitterUf });
    if (d.receiverDoc) parties.set(d.receiverDoc, { name: d.receiverName || "", uf: d.receiverUf });
  }
  let partCode = 1;
  for (const [doc, p] of parties) {
    const cod = String(partCode++).padStart(4, "0");
    records.push({
      type: "0150",
      fields: [cod, p.name.slice(0, 100), "1058", "1", doc.replace(/\W/g, "").slice(0, 14), "", "", p.uf || "", "", "", ""],
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
  records.push({ type: "0990", fields: [String(2 + parties.size + 1 + itemsByCode.size + 2)] });

  // Bloco A — documentos (modelo 55 as mercadorias → also emit C-like via A100 simplified)
  records.push({ type: "A001", fields: ["0"] });
  records.push({ type: "A010", fields: [context.cnpj.replace(/\D/g, "").slice(0, 14)] });
  for (const d of context.documents) {
    const indOper = d.indOper || "1";
    records.push({
      type: "A100",
      fields: [
        indOper,
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
      sourceType: "xml" as const,
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
  records.push({ type: "A990", fields: [String(2 + context.documents.length + context.documents.reduce((n, d) => n + d.items.length, 0) + 1)] });

  records.push({ type: "M001", fields: ["1"] }); // bloco sem movimento de apuração
  records.push({ type: "M990", fields: ["2"] });

  const closed = appendSpedClosers(records, warnings);
  return {
    obligationId: "efd-contribuicoes",
    layoutVersion: EFD_CONTRIB_LAYOUT_2026,
    records: closed,
    lineage,
    warnings,
  };
}

function validate(build: ObligationBuildResult): ValidationResult {
  const issues = [];
  if (!build.records.some((r) => r.type === "0000")) {
    issues.push({
      code: "E_0000",
      severity: "error" as const,
      message: "Registro 0000 ausente",
    });
  }
  if (!build.records.some((r) => r.type === "A100") && !build.records.some((r) => r.type === "C100")) {
    issues.push({
      code: "W_NO_DOCS",
      severity: "warning" as const,
      message: "Nenhum documento A100/C100 gerado",
    });
  }
  return { level: 1, ok: !issues.some((i) => i.severity === "error"), issues };
}

export const efdContribuicoesPlugin: FiscalObligationPlugin = {
  id: "efd-contribuicoes",
  name: "EFD-Contribuições",
  jurisdiction: "federal",
  supportedVersions: [EFD_CONTRIB_LAYOUT_2026],
  async resolveVersion() {
    return { layoutVersion: EFD_CONTRIB_LAYOUT_2026, sourceId: EFD_CONTRIB_SOURCE_ID };
  },
  async detectRequiredData(context) {
    return detect(context);
  },
  async build(context) {
    return build(context);
  },
  async validate(buildResult) {
    return validate(buildResult);
  },
  async serialize(buildResult) {
    return serializePipeRecords(buildResult.records);
  },
  async createManifest(buildResult, serialized, context, validation) {
    return defaultManifest({
      obligationId: "efd-contribuicoes",
      build: buildResult,
      serialized,
      context,
      validation,
      disclaimer: DISCLAIMER,
    });
  },
};
