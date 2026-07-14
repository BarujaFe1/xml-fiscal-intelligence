/**
 * NT activation gate — ainda não ativa rule set; só autoriza pedir review/activate path.
 */

import type { NtInboxItem } from "@/modules/continuous-ops/types";
import type { WorkspaceRoleBinding } from "@/modules/governance/types";
import { assertNtActivateRbac } from "@/modules/governance/rbac";

/**
 * Caminho honesto: ruleSetActivated permanece false.
 * Exige owner RBAC + status ready_for_review + fixture.
 * Ativação real de regras continua no pipeline F9 (fixture + testes).
 */
export function requestNtActivationReview(opts: {
  item: NtInboxItem;
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
  userId: string;
}): NtInboxItem {
  assertNtActivateRbac({
    bindings: opts.bindings,
    workspaceId: opts.workspaceId,
    userId: opts.userId,
  });
  if (opts.item.status !== "ready_for_review") {
    throw new Error("NT activate só a partir de ready_for_review");
  }
  if (!opts.item.fixtureId) {
    throw new Error("NT activate exige fixtureId");
  }
  if (opts.item.ruleSetActivated) {
    throw new Error("rule set já marcado activated — estado inválido no inbox");
  }
  return {
    ...opts.item,
    reviewerId: opts.userId,
    notes: `${opts.item.notes || ""} | activation_requested (ainda ruleSetActivated=false)`.trim(),
    updatedAt: new Date().toISOString(),
    ruleSetActivated: false,
  };
}
