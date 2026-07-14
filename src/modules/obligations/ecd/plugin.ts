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
import type { LedgerSnapshot } from "@/modules/accounting/types";
import { ledgerHasDemoAccounts } from "@/modules/accounting/rules";
import { buildEcdFromLedger, ECD_LAYOUT_2026 } from "@/modules/obligations/ecd/from-ledger";

export { ECD_LAYOUT_2026 };
export const ECD_SOURCE_ID = "official:sped:ecd:hub";

const DISCLAIMER =
  "ECD assistida. Modo ledger: I050/I200 a partir do motor contábil. Modo DEMO: apenas demos (`extras.ecdMode=demo`). XML fiscal NÃO gera lançamentos.";

type DemoAccount = { code: string; name: string; nature: "01" | "02" | "03" | "04" | "05" | "09" };

const DEMO_CHART: DemoAccount[] = [
  { code: "1", name: "ATIVO", nature: "01" },
  { code: "1.1", name: "ATIVO CIRCULANTE", nature: "01" },
  { code: "1.1.1", name: "CAIXA E EQUIVALENTES (DEMO)", nature: "01" },
  { code: "2", name: "PASSIVO", nature: "02" },
  { code: "3", name: "PATRIMONIO LIQUIDO (DEMO)", nature: "03" },
  { code: "4", name: "RECEITAS (DEMO)", nature: "04" },
  { code: "5", name: "CUSTOS E DESPESAS (DEMO)", nature: "04" },
];

function ecdMode(context: ObligationContext): "demo" | "ledger" | "auto" {
  const m = context.extras?.ecdMode;
  if (m === "demo" || m === "ledger") return m;
  return "auto";
}

function ledgerFromContext(context: ObligationContext): LedgerSnapshot | null {
  const raw = context.extras?.ledger;
  if (!raw || typeof raw !== "object") return null;
  const snap = raw as LedgerSnapshot;
  if (!Array.isArray(snap.accounts) || !Array.isArray(snap.entries)) return null;
  return snap;
}

function detect(context: ObligationContext): RequiredDataResult {
  const hasAccountant = Boolean(context.accountantName && context.accountantCpf);
  const mode = ecdMode(context);
  const ledger = ledgerFromContext(context);
  const wantsOfficial = mode === "ledger" || (mode === "auto" && ledger);
  const items: RequiredDataResult["items"] = [
    {
      id: "cnpj",
      label: "CNPJ",
      status: context.cnpj ? "complete" : "blocking",
    },
    {
      id: "period",
      label: "Período contábil",
      status: context.periodStart && context.periodEnd ? "complete" : "blocking",
    },
    {
      id: "accountant",
      label: "Contador (nome + CPF)",
      status: hasAccountant ? "complete" : "blocking",
      remediation: "Informe contador responsável",
    },
    {
      id: "xml_not_source",
      label: "XML fiscal não é origem de I200",
      status: "na",
      message: "Proposital — use o motor contábil",
    },
  ];

  if (wantsOfficial) {
    items.push({
      id: "ledger",
      label: "Ledger contábil",
      status: ledger?.accounts?.length
        ? ledgerHasDemoAccounts(ledger.accounts)
          ? "review"
          : "complete"
        : "blocking",
      message: ledger?.accounts?.length
        ? `${ledger.accounts.length} contas · ${ledger.entries.length} lançamentos`
        : "Informe extras.ledger ou use /app/ledger",
      remediation: "Importe plano + lançamentos no motor contábil",
    });
    if (ledger && ledgerHasDemoAccounts(ledger.accounts)) {
      items.push({
        id: "demo_forbidden",
        label: "Contas DEMO no ledger",
        status: "blocking",
        message: "Modo oficial bloqueado enquanto houver DEMO no plano",
        remediation: "Remova contas DEMO ou use extras.ecdMode=demo",
      });
    }
  } else {
    items.push({
      id: "demo_chart",
      label: "Modo DEMO explícito",
      status: "review",
      message: "extras.ecdMode=demo — não transmitir",
    });
  }

  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return { items, canGenerate: blockingCount === 0, blockingCount };
}

function buildDemo(context: ObligationContext): ObligationBuildResult {
  const warnings = [
    "Plano de contas DEMO — não usar em produção (extras.ecdMode=demo).",
    "Sem lançamentos I200 a partir de NF-e (proposital).",
  ];
  const records: ObligationRecord[] = [];
  const dtIni = context.periodStart.replace(/-/g, "");
  const dtFin = context.periodEnd.replace(/-/g, "");

  records.push({
    type: "0000",
    fields: [
      "LECD",
      ECD_LAYOUT_2026,
      "0",
      dtIni,
      dtFin,
      context.companyName.slice(0, 100),
      context.cnpj.replace(/\D/g, "").slice(0, 14),
      context.uf,
      context.ie || "",
      "",
      "0",
      "0",
      context.purpose || "0",
    ],
  });
  records.push({ type: "0001", fields: ["0"] });
  records.push({ type: "0007", fields: [context.uf, context.ie || ""] });
  records.push({ type: "0990", fields: ["4"] });
  records.push({ type: "I001", fields: ["0"] });
  records.push({ type: "I010", fields: ["G", "1.00"] });
  records.push({
    type: "I030",
    fields: [
      "1",
      "0",
      "1",
      context.companyName.slice(0, 100),
      context.cnpj.replace(/\D/g, "").slice(0, 14),
      "DEMO",
      dtIni,
      "1",
      dtFin,
      "",
      context.uf,
      "",
      context.ie || "",
      "",
      "",
      context.accountantName || "",
      context.accountantCpf || "",
      "",
      "0",
    ],
  });
  for (const acc of DEMO_CHART) {
    records.push({
      type: "I050",
      fields: [dtIni, "S", "1", acc.nature, acc.code, acc.name, "", ""],
    });
  }
  records.push({ type: "I150", fields: [dtIni.slice(0, 6), dtIni, dtFin] });
  for (const acc of DEMO_CHART.filter((a) => a.code.includes("."))) {
    records.push({
      type: "I155",
      fields: [acc.code, "", "0", "D", "0", "D", "0", "D", "0", "D"],
    });
  }
  records.push({
    type: "I990",
    fields: [
      String(3 + DEMO_CHART.length + 1 + DEMO_CHART.filter((a) => a.code.includes(".")).length + 1),
    ],
  });
  records.push({ type: "J001", fields: ["1"] });
  records.push({ type: "J990", fields: ["2"] });
  const closed = appendSpedClosers(records, warnings);
  return {
    obligationId: "ecd",
    layoutVersion: ECD_LAYOUT_2026,
    records: closed,
    lineage: [
      {
        record: "I050",
        field: "COD_CTA",
        value: "DEMO",
        sourceType: "manual",
        transformation: "demo_chart",
      },
    ],
    warnings,
  };
}

function build(context: ObligationContext): ObligationBuildResult {
  const mode = ecdMode(context);
  const ledger = ledgerFromContext(context);
  if (mode === "demo") return buildDemo(context);
  if (mode === "ledger" || (mode === "auto" && ledger)) {
    if (!ledger) throw new Error("ecdMode=ledger exige extras.ledger");
    if (ledgerHasDemoAccounts(ledger.accounts) && mode === "ledger") {
      throw new Error("Modo ledger oficial bloqueado: contas DEMO presentes");
    }
    return buildEcdFromLedger(context, ledger);
  }
  // default auto without ledger → DEMO with warning path (legacy demos)
  return buildDemo({
    ...context,
    extras: { ...context.extras, ecdMode: "demo" },
  });
}

function validate(build: ObligationBuildResult): ValidationResult {
  const issues = [];
  if (!build.records.some((r) => r.type === "I050")) {
    issues.push({ code: "E_I050", severity: "error" as const, message: "Sem plano de contas" });
  }
  const isDemo = build.warnings.some((w) => /DEMO/i.test(w));
  if (isDemo) {
    issues.push({
      code: "I_DEMO",
      severity: "info" as const,
      message: "Arquivo contém modo DEMO — não transmitir",
    });
  }
  return { level: 1, ok: !issues.some((i) => i.severity === "error"), issues };
}

export const ecdPlugin: FiscalObligationPlugin = {
  id: "ecd",
  name: "ECD",
  jurisdiction: "federal",
  supportedVersions: [ECD_LAYOUT_2026],
  async resolveVersion() {
    return { layoutVersion: ECD_LAYOUT_2026, sourceId: ECD_SOURCE_ID };
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
      obligationId: "ecd",
      build: buildResult,
      serialized,
      context,
      validation,
      disclaimer: DISCLAIMER,
    });
  },
};
