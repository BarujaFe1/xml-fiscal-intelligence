/**
 * Client-side obligation generation — avoids posting full BatchStore to the API
 * (Vercel/Next body limits cause non-JSON "Request Entity Too Large" → Unexpected token 'R').
 */
import { buildObligationContextFromBatch } from "@/modules/obligations/efd-icms-ipi/from-batch";
import {
  getObligationPlugin,
  isObligationId,
  type ObligationId,
} from "@/modules/obligations/registry";
import { runObligationPlugin } from "@/modules/obligations/core/pipe";
import type { RequiredDataResult, ValidationResult } from "@/modules/obligations/core/types";
import { EFD_ICMS_IPI_LAYOUT_2026 } from "@/modules/obligations/efd-icms-ipi/plugin";
import { EFD_CONTRIB_LAYOUT_2026 } from "@/modules/obligations/efd-contribuicoes/plugin";
import { ECD_LAYOUT_2026 } from "@/modules/obligations/ecd/plugin";
import { ECF_LAYOUT_2026 } from "@/modules/obligations/ecf/plugin";
import { REINF_LAYOUT_2026 } from "@/modules/obligations/reinf/plugin";
import type { BatchStore } from "@/types";

const LAYOUTS: Record<ObligationId, string> = {
  "efd-icms-ipi": EFD_ICMS_IPI_LAYOUT_2026,
  "efd-contribuicoes": EFD_CONTRIB_LAYOUT_2026,
  ecd: ECD_LAYOUT_2026,
  ecf: ECF_LAYOUT_2026,
  reinf: REINF_LAYOUT_2026,
};

const emptyReadiness = (): RequiredDataResult => ({
  items: [],
  canGenerate: false,
  blockingCount: 1,
});

export type LocalEstablishmentInput = {
  cnpj: string;
  ie?: string;
  uf: string;
  companyName: string;
  profile: "A" | "B" | "C";
  activityCode: string;
  purpose: "0" | "1";
  periodStart: string;
  periodEnd: string;
  codMun?: string;
  tradeName?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressCompl?: string;
  neighborhood?: string;
  phone?: string;
  email?: string;
  accountantName?: string;
  accountantCpf?: string;
  accountantCrc?: string;
  icmsCodRec?: string;
};

export type LocalGenerateResult = {
  ok: boolean;
  obligationId: ObligationId;
  readiness: RequiredDataResult;
  validation?: ValidationResult;
  manifest?: Record<string, unknown>;
  recordCount?: number;
  contentHash?: string;
  content?: string;
  lineageSample?: Array<Record<string, unknown>>;
  warnings?: string[];
  label: string;
  disclaimer: string;
  error?: string;
  /** Lifecycle honesty — never equal to official RFB transmission by itself. */
  generationStatus?: import("@/modules/obligations/efd-icms-ipi/status").EfdGenerationStatus;
};

export async function generateObligationLocal(input: {
  obligationId: string;
  store: BatchStore | null;
  establishment: LocalEstablishmentInput;
  workspaceId?: string;
  extras?: Record<string, unknown>;
}): Promise<LocalGenerateResult> {
  if (!isObligationId(input.obligationId)) {
    return {
      ok: false,
      obligationId: "efd-icms-ipi",
      readiness: emptyReadiness(),
      label: "pré-validação interna",
      disclaimer: "",
      error: "Obrigação desconhecida",
    };
  }
  const id = input.obligationId;
  const plugin = getObligationPlugin(id);
  if (!plugin) {
    return {
      ok: false,
      obligationId: id,
      readiness: emptyReadiness(),
      label: "pré-validação interna",
      disclaimer: "",
      error: "Plugin indisponível",
    };
  }

  const needsDocs = id === "efd-icms-ipi" || id === "efd-contribuicoes" || id === "reinf";
  if (needsDocs && !input.store?.documents?.length) {
    return {
      ok: false,
      obligationId: id,
      readiness: emptyReadiness(),
      label: "pré-validação interna",
      disclaimer: "",
      error: "BatchStore sem documentos",
    };
  }

  const store = input.store;
  const context = buildObligationContextFromBatch({
    establishment: {
      workspaceId: input.workspaceId || store?.batch.workspaceId || "ws_local",
      companyId: "co_local",
      establishmentId: "est_local",
      layoutVersion: LAYOUTS[id],
      ...input.establishment,
    },
    documents: store?.documents || [],
    items: store?.items || [],
  });
  if (input.extras) context.extras = { ...context.extras, ...input.extras };

  const result = await runObligationPlugin(plugin, context);
  if (!result.readiness.canGenerate || !result.serialized || !result.manifest) {
    return {
      ok: false,
      obligationId: id,
      readiness: result.readiness,
      validation: result.validation,
      warnings: result.build?.warnings,
      label: "pré-validação interna — conferir no ambiente oficial",
      disclaimer:
        "Pré-validação/prontidão apenas. Não é validação PVA nem parecer fiscal.",
      error: "Geração bloqueada por pendências",
      generationStatus: "readiness_blocked",
    };
  }

  const internallyOk = result.validation?.ok ?? false;
  return {
    ok: internallyOk,
    obligationId: id,
    readiness: result.readiness,
    validation: result.validation,
    manifest: result.manifest as unknown as Record<string, unknown>,
    recordCount: result.serialized.recordCount,
    contentHash: result.serialized.contentHash,
    content: result.serialized.content,
    lineageSample: (result.build?.lineage.slice(0, 20) || []).map((row) => ({
      ...row,
    })) as Array<Record<string, unknown>>,
    warnings: result.build?.warnings || [],
    label: "pré-validação interna — conferir no ambiente oficial",
    disclaimer: result.manifest.disclaimer,
    generationStatus: internallyOk
      ? "pva_validation_pending"
      : "txt_generated",
  };
}

/** Parse fetch body safely — surfaces body-limit / HTML errors instead of Unexpected token. */
export async function readJsonOrTextError(res: Response): Promise<{
  data: Record<string, unknown> | null;
  parseError?: string;
  rawHead?: string;
}> {
  const text = await res.text();
  if (!text) return { data: null };
  try {
    return { data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    const head = text.slice(0, 120).replace(/\s+/g, " ");
    const looksLikeBodyLimit = /request entity too large|payload too large|body.*limit|413/i.test(
      text,
    );
    return {
      data: null,
      rawHead: head,
      parseError: looksLikeBodyLimit
        ? "Lote grande demais para o servidor — a geração deve rodar no navegador."
        : `Resposta inválida do servidor (${res.status}): ${head}`,
    };
  }
}
