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

export const ECF_LAYOUT_2026 = "ECF_2026_DRAFT";
export const ECF_SOURCE_ID = "official:sped:ecf:pending-registry";

const DISCLAIMER =
  "ECF assistida (esqueleto estrutural). IRPJ/CSLL e partes B/LALUR NÃO são calculados a partir de XML. Requer ECD e apuração real. Não transmitir este rascunho.";

function detect(context: ObligationContext): RequiredDataResult {
  const regime = String(context.extras?.taxRegime || "lucro_real");
  const items = [
    {
      id: "cnpj",
      label: "CNPJ",
      status: context.cnpj ? ("complete" as const) : ("blocking" as const),
    },
    {
      id: "period",
      label: "Ano-calendário / período",
      status: context.periodStart ? ("complete" as const) : ("blocking" as const),
    },
    {
      id: "regime",
      label: "Regime tributário",
      status: "manual" as const,
      message: `Usando: ${regime} (informado/demo)`,
    },
    {
      id: "ecd",
      label: "ECD do período",
      status: "review" as const,
      message: "ECF real depende de ECD validada — aqui só esqueleto",
    },
    {
      id: "assessment",
      label: "Apuração IRPJ/CSLL",
      status: "pending" as const,
      message: "Não calculada a partir de NF-e",
    },
  ];
  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return { items, canGenerate: blockingCount === 0, blockingCount };
}

function build(context: ObligationContext): ObligationBuildResult {
  const warnings = [
    "Sem cálculo de IRPJ/CSLL.",
    "Blocos de apuração com indicadores pendentes.",
    "Gerar apenas para demonstração de pipeline / prontidão.",
  ];
  const year = context.periodStart.slice(0, 4);
  const records: ObligationRecord[] = [];
  const regime = String(context.extras?.taxRegime || "1"); // 1=lucro real demo

  records.push({
    type: "0000",
    fields: [
      "LECF",
      ECF_LAYOUT_2026,
      "0",
      context.companyName.slice(0, 100),
      context.cnpj.replace(/\D/g, "").slice(0, 14),
      year,
      "0",
      context.purpose || "0",
      "0",
      regime,
      "0",
      "0",
      "N",
      "N",
    ],
  });
  records.push({ type: "0001", fields: ["0"] });
  records.push({
    type: "0010",
    fields: [regime, "N", "N", "N", "N", "N", "N", "N"],
  });
  records.push({
    type: "0020",
    fields: [context.periodStart.replace(/-/g, ""), context.periodEnd.replace(/-/g, ""), "0"],
  });
  records.push({ type: "0030", fields: [context.uf, "", "", "", "", ""] });
  records.push({ type: "0990", fields: ["6"] });

  records.push({ type: "C001", fields: ["1"] });
  records.push({ type: "C990", fields: ["2"] });

  records.push({ type: "E001", fields: ["1"] });
  records.push({ type: "E990", fields: ["2"] });

  records.push({ type: "J001", fields: ["1"] });
  records.push({ type: "J990", fields: ["2"] });

  records.push({ type: "K001", fields: ["1"] });
  records.push({ type: "K990", fields: ["2"] });

  records.push({ type: "L001", fields: ["1"] });
  records.push({
    type: "L030",
    fields: [year, "A00", "0", "0", "0", "0"],
  });
  warnings.push("L030 com valores zerados (pendente apuração manual).");
  records.push({ type: "L990", fields: ["3"] });

  records.push({ type: "X001", fields: ["1"] });
  records.push({ type: "X990", fields: ["2"] });

  records.push({ type: "Y001", fields: ["1"] });
  records.push({ type: "Y990", fields: ["2"] });

  const closed = appendSpedClosers(records, warnings);
  return {
    obligationId: "ecf",
    layoutVersion: ECF_LAYOUT_2026,
    records: closed,
    lineage: [],
    warnings,
  };
}

function validate(build: ObligationBuildResult): ValidationResult {
  const issues: ValidationResult["issues"] = [
    {
      code: "I_NO_TAX",
      severity: "info",
      message: "Sem apuração IRPJ/CSLL — esperado neste modo assistido",
    },
  ];
  if (!build.records.some((r) => r.type === "0000")) {
    issues.push({ code: "E_0000", severity: "error", message: "0000 ausente" });
  }
  return { level: 1, ok: !issues.some((i) => i.severity === "error"), issues };
}

export const ecfPlugin: FiscalObligationPlugin = {
  id: "ecf",
  name: "ECF",
  jurisdiction: "federal",
  supportedVersions: [ECF_LAYOUT_2026],
  async resolveVersion() {
    return { layoutVersion: ECF_LAYOUT_2026, sourceId: ECF_SOURCE_ID };
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
      obligationId: "ecf",
      build: buildResult,
      serialized,
      context,
      validation,
      disclaimer: DISCLAIMER,
    });
  },
};
