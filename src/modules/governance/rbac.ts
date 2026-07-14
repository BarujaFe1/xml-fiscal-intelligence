/**
 * RBAC fino — owner / preparer / approver / auditor.
 * Complementa SoD (preparer ≠ approver), não substitui.
 */

import {
  ROLE_PERMISSIONS,
  type GovernanceAction,
  type GovernanceRole,
  type WorkspaceRoleBinding,
} from "@/modules/governance/types";

export function bindRole(input: {
  workspaceId: string;
  userId: string;
  role: GovernanceRole;
}): WorkspaceRoleBinding {
  return {
    workspaceId: input.workspaceId,
    userId: input.userId,
    role: input.role,
    updatedAt: new Date().toISOString(),
  };
}

export function roleAllows(role: GovernanceRole, action: GovernanceAction): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

export function canAct(opts: {
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
  userId: string;
  action: GovernanceAction;
}): { ok: boolean; role?: GovernanceRole; reason?: string } {
  const mine = opts.bindings.filter(
    (b) => b.workspaceId === opts.workspaceId && b.userId === opts.userId,
  );
  if (mine.length === 0) {
    return { ok: false, reason: "sem papel no workspace" };
  }
  for (const b of mine) {
    if (roleAllows(b.role, opts.action)) {
      return { ok: true, role: b.role };
    }
  }
  return {
    ok: false,
    role: mine[0]?.role,
    reason: `papel ${mine.map((m) => m.role).join("+")} sem permissão ${opts.action}`,
  };
}

/** Gate explícito — usado por transmit / NT activate / export §28. */
export function assertCanAct(opts: {
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
  userId: string;
  action: GovernanceAction;
}): void {
  const g = canAct(opts);
  if (!g.ok) throw new Error(g.reason || "RBAC bloqueado");
}

export function assertTransmitRbac(opts: {
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
  userId: string;
}): void {
  assertCanAct({ ...opts, action: "transmit" });
}

export function assertNtActivateRbac(opts: {
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
  userId: string;
}): void {
  assertCanAct({ ...opts, action: "nt_activate" });
}

export function assertExportSection28Rbac(opts: {
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
  userId: string;
}): void {
  assertCanAct({ ...opts, action: "export_section28" });
}
