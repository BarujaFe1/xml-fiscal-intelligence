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
import type {
  AccountReferentialMap,
  EcfMode,
  EcfWorkspaceSnapshot,
  ElalurSnapshot,
  EcfPriorCanonical,
  ReferentialTableVersion,
} from "@/modules/ecf/types";
import { listOrphanAccounts } from "@/modules/ecf/mapper";
import { recoverEcdFromLedger } from "@/modules/ecf/recovery/ecd";
import { buildEcfFromWorkspace, ECF_LAYOUT_2026 } from "@/modules/obligations/ecf/from-workspace";
import { isEcfIrpjEngineEnabled } from "@/modules/ecf/irpj/engine";

export { ECF_LAYOUT_2026 };
export const ECF_SOURCE_ID = "official:sped:ecf:hub";

const DISCLAIMER =
  "ECF assistida (Fase 5). Depende de ECD/ledger. IRPJ/CSLL só com FEATURE_ECF_IRPJ_ENGINE + evidência Programa ECF. Não transmitir rascunho sem validação oficial.";

function ecfMode(context: ObligationContext): EcfMode {
  const m = String(context.extras?.ecfMode || "auto");
  if (m === "demo" || m === "official" || m === "auto") return m;
  return "auto";
}

function ledgerFromContext(context: ObligationContext): LedgerSnapshot | null {
  const raw = context.extras?.ecdLedger ?? context.extras?.ledger;
  if (!raw || typeof raw !== "object") return null;
  const snap = raw as LedgerSnapshot;
  if (!Array.isArray(snap.accounts) || !Array.isArray(snap.entries)) return null;
  return snap;
}

function mapsFromContext(context: ObligationContext): AccountReferentialMap[] {
  const raw = context.extras?.accountMaps;
  return Array.isArray(raw) ? (raw as AccountReferentialMap[]) : [];
}

function workspaceFromContext(context: ObligationContext): EcfWorkspaceSnapshot | null {
  const ledger = ledgerFromContext(context);
  if (!ledger) return null;
  return {
    ledger,
    maps: mapsFromContext(context),
    referentialTables: Array.isArray(context.extras?.referentialTables)
      ? (context.extras!.referentialTables as ReferentialTableVersion[])
      : [],
    elalur: context.extras?.elalur as ElalurSnapshot | undefined,
    priorEcf: context.extras?.priorEcf as EcfPriorCanonical | undefined,
  };
}

function detect(context: ObligationContext): RequiredDataResult {
  const mode = ecfMode(context);
  const ledger = ledgerFromContext(context);
  const wantsOfficial = mode === "official" || (mode === "auto" && ledger);
  const items: RequiredDataResult["items"] = [
    {
      id: "cnpj",
      label: "CNPJ",
      status: context.cnpj ? "complete" : "blocking",
    },
    {
      id: "period",
      label: "Ano-calendário / período",
      status: context.periodStart ? "complete" : "blocking",
    },
    {
      id: "regime",
      label: "Regime tributário",
      status: context.extras?.taxRegime ? "complete" : "manual",
      message: `Usando: ${String(context.extras?.taxRegime || "lucro_real (informado/demo)")}`,
    },
    {
      id: "no_xml_tax",
      label: "XML fiscal não calcula IRPJ/CSLL",
      status: "na",
      message: "Proposital",
    },
  ];

  if (wantsOfficial) {
    const recovery = ledger ? recoverEcdFromLedger(ledger) : null;
    items.push({
      id: "ecd_ledger",
      label: "ECD / ledger do período",
      status: ledger?.accounts?.length
        ? recovery?.fromDemo
          ? "blocking"
          : "complete"
        : "blocking",
      message: ledger?.accounts?.length
        ? `${ledger.accounts.length} contas · ${ledger.entries.length} lançamentos`
        : "Informe extras.ecdLedger (ou use /app/ecf)",
      remediation: "Importe ledger no motor contábil e recupere no cockpit ECF",
    });
    if (ledger && ledgerHasDemoAccounts(ledger.accounts)) {
      items.push({
        id: "demo_forbidden",
        label: "Contas DEMO no ledger",
        status: "blocking",
        message: "Modo oficial bloqueado com DEMO",
        remediation: "Remova DEMO ou use extras.ecfMode=demo",
      });
    }
    const maps = mapsFromContext(context);
    const orphans = ledger ? listOrphanAccounts(ledger.accounts, maps) : [];
    items.push({
      id: "referential_maps",
      label: "Mapa conta × referencial",
      status: orphans.length ? "blocking" : ledger ? "complete" : "blocking",
      message: orphans.length
        ? `${orphans.length} órfã(s) / não confirmada(s)`
        : maps.length
          ? `${maps.filter((m) => m.confirmedAt).length} mapa(s) confirmado(s)`
          : "Sem mapas",
      remediation: "Confirme mapas em /app/ecf (sugestões não auto-aplicam)",
    });
    items.push({
      id: "irpj_engine",
      label: "Motor IRPJ/CSLL",
      status: isEcfIrpjEngineEnabled() ? "review" : "na",
      message: isEcfIrpjEngineEnabled()
        ? "FEATURE_ECF_IRPJ_ENGINE on — validar Programa ECF"
        : "Flag off — L030 sem cálculo de imposto",
    });
  } else {
    items.push({
      id: "demo_skeleton",
      label: "Modo DEMO / esqueleto",
      status: "review",
      message: "extras.ecfMode=demo — não transmitir",
    });
  }

  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return { items, canGenerate: blockingCount === 0, blockingCount };
}

function buildDemo(context: ObligationContext): ObligationBuildResult {
  const warnings = [
    "ECF DEMO/esqueleto — sem ledger oficial.",
    "Sem cálculo de IRPJ/CSLL.",
  ];
  const year = context.periodStart.slice(0, 4);
  const records: ObligationRecord[] = [];
  const regime = String(context.extras?.taxRegime || "1");

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
  records.push({ type: "L030", fields: [year, "A00", "0", "0", "0", "0"] });
  warnings.push("L030 zerado (DEMO).");
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

function build(context: ObligationContext): ObligationBuildResult {
  const mode = ecfMode(context);
  const workspace = workspaceFromContext(context);
  const wantsOfficial = mode === "official" || (mode === "auto" && workspace);

  if (!wantsOfficial || !workspace) {
    return buildDemo(context);
  }

  return buildEcfFromWorkspace(context, workspace, {
    includeIrpj: isEcfIrpjEngineEnabled() || Boolean(context.extras?.forceIrpjForTest),
  });
}

function validate(buildResult: ObligationBuildResult): ValidationResult {
  const issues: ValidationResult["issues"] = [
    {
      code: "I_NO_XML_TAX",
      severity: "info",
      message: "IRPJ/CSLL nunca derivados de NF-e",
    },
  ];
  if (!buildResult.records.some((r) => r.type === "0000")) {
    issues.push({ code: "E_0000", severity: "error", message: "0000 ausente" });
  }
  if (buildResult.warnings.some((w) => /órfã/i.test(w))) {
    issues.push({
      code: "W_ORPHAN",
      severity: "warning",
      message: "Há contas sem mapa referencial no build",
    });
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
