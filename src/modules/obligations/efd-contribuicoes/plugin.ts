import type {
  FiscalObligationPlugin,
  ObligationBuildResult,
  ObligationContext,
  RequiredDataResult,
  ValidationResult,
} from "@/modules/obligations/core/types";
import {
  defaultManifest,
  serializePipeRecords,
} from "@/modules/obligations/core/pipe";
import type {
  ContribMode,
  ContribRegimeCode,
  ContribSnapshot,
  ContribEntry,
  RateioLine,
} from "@/modules/contrib/types";
import { assertRegimeForPeriod } from "@/modules/contrib/regimes";
import { parseContribMode, listSupportedModes } from "@/modules/contrib/modes";
import { findIllicitCredits } from "@/modules/contrib/books";
import { validateRateio } from "@/modules/contrib/rateio";
import {
  buildContribFromDomain,
  EFD_CONTRIB_LAYOUT_2026,
} from "@/modules/obligations/efd-contribuicoes/from-domain";

export { EFD_CONTRIB_LAYOUT_2026 };
export const EFD_CONTRIB_SOURCE_ID = "official:sped:efd-contribuicoes:hub";

const DISCLAIMER =
  "EFD-Contribuições assistida (Fase 6). Domínio próprio + Bloco M explícito. Não é PGE. Modos dual preservados (nunca apagar histórico). NTs 11/12/2026 catalogadas (não auto-ativadas). FEATURE_CONTRIB_SIMULATOR off por padrão.";

function snapshotFromContext(context: ObligationContext): ContribSnapshot | null {
  const raw = context.extras?.contribSnapshot;
  if (raw && typeof raw === "object") {
    const s = raw as ContribSnapshot;
    if (Array.isArray(s.entries) && s.regimeCode && s.mode && s.periodKey) return s;
  }
  const entries = context.extras?.contribEntries;
  if (!Array.isArray(entries) || !entries.length) return null;
  const periodKey =
    String(context.extras?.periodKey || context.periodStart.slice(0, 7));
  return {
    entries: entries as ContribEntry[],
    rateio: Array.isArray(context.extras?.rateio)
      ? (context.extras!.rateio as RateioLine[])
      : [],
    regimeCode: (context.extras?.regimeCode as ContribRegimeCode) || "non_cumulative",
    mode: parseContribMode(context.extras?.contribMode),
    periodKey,
  };
}

function detect(context: ObligationContext): RequiredDataResult {
  const snap = snapshotFromContext(context);
  const mode: ContribMode = snap?.mode || parseContribMode(context.extras?.contribMode);
  const regimeCode = (snap?.regimeCode ||
    context.extras?.regimeCode ||
    "non_cumulative") as ContribRegimeCode;
  const regime = assertRegimeForPeriod(regimeCode, context.periodStart);
  const wantsDomain = Boolean(snap) || context.extras?.contribMode === "domain" || Boolean(context.extras?.requireDomain);

  const items: RequiredDataResult["items"] = [
    {
      id: "cnpj",
      label: "CNPJ do contribuinte",
      status: context.cnpj ? "complete" : "blocking",
      remediation: "Informe o CNPJ do estabelecimento",
    },
    {
      id: "period",
      label: "Período de apuração",
      status: context.periodStart && context.periodEnd ? "complete" : "blocking",
    },
    {
      id: "regime",
      label: `Regime ${regimeCode}`,
      status: regime.ok ? "complete" : "blocking",
      message: regime.ok
        ? `${regime.profile!.label} · ${regime.profile!.sourceId}`
        : regime.message,
      remediation: "Informe extras.regimeCode com perfil vigente",
    },
    {
      id: "dual_modes",
      label: "Modos dual suportados",
      status: "na",
      message: listSupportedModes().join(" | "),
    },
    {
      id: "mode",
      label: "Modo da geração",
      status: "complete",
      message: mode,
    },
  ];

  if (wantsDomain || snap) {
    items.push({
      id: "domain",
      label: "Domínio de apuração",
      status: snap?.entries?.length ? "complete" : "blocking",
      message: snap?.entries?.length
        ? `${snap.entries.length} lançamento(s)`
        : "Informe extras.contribSnapshot ou contribEntries",
      remediation: "Use /app/contrib — créditos só com creditExplicit",
    });
    if (snap) {
      const illicit = findIllicitCredits(snap.entries);
      if (illicit.length) {
        items.push({
          id: "illicit_credit",
          label: "Créditos sem creditExplicit",
          status: "blocking",
          message: `${illicit.length} crédito(s) inválido(s)`,
          remediation: "Remova ou marque creditExplicit=true com evidência",
        });
      }
      const rateioIssues = validateRateio(snap.rateio);
      if (rateioIssues.some((i) => i.severity === "error")) {
        items.push({
          id: "rateio",
          label: "Rateio",
          status: "blocking",
          message: rateioIssues[0]?.message,
        });
      }
    }
    items.push({
      id: "docs_optional",
      label: "XML NF-e (opcional p/ A100)",
      status: context.documents.length ? "complete" : "na",
      message: `${context.documents.length} documento(s) — não substituem o domínio`,
    });
  } else {
    items.push({
      id: "docs",
      label: "Documentos NF-e/NFC-e no lote",
      status: context.documents.length ? "complete" : "blocking",
      message: `${context.documents.length} documento(s) — Bloco M ficará sem movimento sem domínio`,
    });
    items.push({
      id: "domain_hint",
      label: "Domínio de apuração",
      status: "review",
      message: "Sem contribSnapshot — geração XML-only (legado); prefira /app/contrib",
    });
  }

  items.push({
    id: "transition_2027",
    label: "Histórico 2027+ preservado",
    status: "na",
    message: "historical_and_credit_management permanece (NT 11/2026 catalogada, não ativada)",
  });

  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return { items, canGenerate: blockingCount === 0, blockingCount };
}

function buildXmlLegacy(context: ObligationContext): ObligationBuildResult {
  // Delegate empty domain → from-domain with empty entries (M001=1) + docs
  const periodKey = context.periodStart.slice(0, 7);
  return buildContribFromDomain(context, {
    entries: [],
    rateio: [],
    regimeCode: (context.extras?.regimeCode as ContribRegimeCode) || "non_cumulative",
    mode: parseContribMode(context.extras?.contribMode),
    periodKey,
  });
}

function build(context: ObligationContext): ObligationBuildResult {
  const snap = snapshotFromContext(context);
  if (snap) return buildContribFromDomain(context, snap);
  return buildXmlLegacy(context);
}

function validate(buildResult: ObligationBuildResult): ValidationResult {
  const issues: ValidationResult["issues"] = [];
  if (!buildResult.records.some((r) => r.type === "0000")) {
    issues.push({
      code: "E_0000",
      severity: "error",
      message: "Registro 0000 ausente",
    });
  }
  if (
    !buildResult.records.some((r) => r.type === "A100") &&
    !buildResult.records.some((r) => r.type === "M100" || r.type === "M200")
  ) {
    issues.push({
      code: "W_NO_MOV",
      severity: "warning",
      message: "Sem A100 e sem M100/M200 — rascunho estrutural",
    });
  }
  if (buildResult.records.some((r) => r.type === "M100" || r.type === "M200")) {
    issues.push({
      code: "I_BLOCO_M",
      severity: "info",
      message: "Bloco M gerado a partir do domínio (validar COD_CRED no PGE)",
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
