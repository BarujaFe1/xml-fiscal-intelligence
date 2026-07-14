/**
 * Checklist de transmissão / certificado — gate antes de qualquer submit.
 */

import type { TransmissionChecklistItem } from "@/modules/homologation/types";
import type { ClosingTask, SodPolicy } from "@/modules/ops/types";
import type { WorkspaceRoleBinding } from "@/modules/governance/types";
import { assertTransmitRbac } from "@/modules/governance/rbac";
import { isFeatureEnabled } from "@/lib/feature-flags";

export function buildTransmissionChecklist(input: {
  obligationId: string;
  certType?: "A1" | "A3" | "none";
  localAgentReady?: boolean;
  featureSubmitEnabled?: boolean;
  sodApproved?: boolean;
  distinctApprover?: boolean;
  environment?: "restricted" | "production_claimed";
}): TransmissionChecklistItem[] {
  const submitFlag =
    input.featureSubmitEnabled ??
    (input.obligationId === "reinf" ? isFeatureEnabled("reinfSubmit") : false);

  return [
    {
      id: "feature_flag",
      label: "Feature de transmissão habilitada",
      required: true,
      ok: Boolean(submitFlag),
      detail: submitFlag ? "flag on" : "FEATURE_* submit off — bloqueado",
    },
    {
      id: "cert",
      label: "Certificado A1/A3 disponível",
      required: true,
      ok: input.certType === "A1" || input.certType === "A3",
      detail: input.certType || "none",
    },
    {
      id: "local_agent",
      label: "Agente local de assinatura",
      required: input.obligationId === "reinf",
      ok: input.obligationId !== "reinf" || Boolean(input.localAgentReady),
      detail: "Assinatura só fora do browser",
    },
    {
      id: "sod",
      label: "SoD: aprovação distinta do preparador",
      required: true,
      ok: Boolean(input.sodApproved && input.distinctApprover),
      detail: "Preparador ≠ aprovador para transmitir",
    },
    {
      id: "env",
      label: "Ambiente restrito (não claim production global)",
      required: true,
      ok: input.environment !== "production_claimed",
      detail: input.environment || "restricted",
    },
  ];
}

export function transmissionAllowed(items: TransmissionChecklistItem[]): {
  ok: boolean;
  missing: string[];
} {
  const missing = items.filter((i) => i.required && !i.ok).map((i) => i.id);
  return { ok: missing.length === 0, missing };
}

export function assertTransmitSoD(opts: {
  policy: SodPolicy;
  task: ClosingTask;
  actorId: string;
}): void {
  if (opts.task.status !== "done") {
    throw new Error("tarefa deve estar aprovada (done) antes de transmitir");
  }
  if (opts.policy.requireDistinctApprover) {
    if (opts.task.preparerId && opts.task.preparerId === opts.actorId) {
      throw new Error("SoD: preparador não pode transmitir a própria geração");
    }
    if (opts.task.approverId && opts.task.approverId !== opts.actorId) {
      // allow transmitter to be the approver OR a third ops role — preparer still blocked
    }
  }
  // Transmissor típico = aprovador (já distinto do preparador)
  if (
    opts.policy.requireDistinctApprover &&
    opts.task.preparerId &&
    opts.task.approverId === opts.task.preparerId
  ) {
    throw new Error("SoD inconsistente: aprovador = preparador");
  }
}

/** SoD + RBAC (transmit) — gate completo Fase 11. */
export function assertTransmitGates(opts: {
  policy: SodPolicy;
  task: ClosingTask;
  actorId: string;
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
}): void {
  assertTransmitSoD({
    policy: opts.policy,
    task: opts.task,
    actorId: opts.actorId,
  });
  assertTransmitRbac({
    bindings: opts.bindings,
    workspaceId: opts.workspaceId,
    userId: opts.actorId,
  });
}
