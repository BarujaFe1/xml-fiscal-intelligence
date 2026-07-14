/**
 * SoD — preparador ≠ aprovador quando política exigir.
 */

import type { ClosingTask, SodPolicy, AuditDecision } from "@/modules/ops/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export const DEFAULT_SOD_POLICY = (workspaceId: string): SodPolicy => ({
  workspaceId,
  requireDistinctApprover: true,
  updatedAt: new Date().toISOString(),
});

export function canApprove(opts: {
  policy: SodPolicy;
  task: ClosingTask;
  actorId: string;
}): { ok: boolean; reason?: string } {
  if (opts.task.status === "done" || opts.task.status === "cancelled") {
    return { ok: false, reason: "tarefa já encerrada" };
  }
  if (opts.policy.requireDistinctApprover) {
    const preparer = opts.task.preparerId;
    if (preparer && preparer === opts.actorId) {
      return {
        ok: false,
        reason: "SoD: preparador não pode aprovar a própria geração",
      };
    }
  }
  return { ok: true };
}

export function createClosingTask(input: {
  workspaceId: string;
  companyId: string;
  periodKey: string;
  obligationId: ObligationId;
  title: string;
  preparerId?: string;
  generationId?: string;
}): ClosingTask {
  const now = new Date().toISOString();
  const audit: AuditDecision[] = [
    { at: now, actorId: input.preparerId || "system", action: "create" },
  ];
  return {
    id: `task_${input.companyId}_${input.obligationId}_${input.periodKey}_${Date.now()}`,
    workspaceId: input.workspaceId,
    companyId: input.companyId,
    periodKey: input.periodKey,
    obligationId: input.obligationId,
    title: input.title,
    status: "open",
    preparerId: input.preparerId,
    generationId: input.generationId,
    createdAt: now,
    updatedAt: now,
    audit,
  };
}

export function appendAudit(task: ClosingTask, decision: AuditDecision): ClosingTask {
  return {
    ...task,
    updatedAt: decision.at,
    audit: [...task.audit, decision],
  };
}

export function approveTask(
  task: ClosingTask,
  policy: SodPolicy,
  actorId: string,
  note?: string,
): ClosingTask {
  const gate = canApprove({ policy, task, actorId });
  if (!gate.ok) throw new Error(gate.reason || "aprovação bloqueada");
  const at = new Date().toISOString();
  return appendAudit(
    {
      ...task,
      status: "done",
      approverId: actorId,
    },
    { at, actorId, action: "approve", note },
  );
}
