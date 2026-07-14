/**
 * Parceiros contábeis — convites + link read/prepare + white-label preview.
 */

import type { PartnerInvite, PartnerWorkspaceLink } from "@/modules/ecosystem/types";
import type { WorkspaceRoleBinding } from "@/modules/governance/types";
import { bindRole, assertCanAct, canAct } from "@/modules/governance/rbac";

export function createPartnerInvite(input: {
  tenantId: string;
  hostWorkspaceId: string;
  partnerEmail: string;
  whiteLabelPreview?: boolean;
  actorBindings: WorkspaceRoleBinding[];
  actorUserId: string;
}): PartnerInvite {
  assertCanAct({
    bindings: input.actorBindings,
    workspaceId: input.hostWorkspaceId,
    userId: input.actorUserId,
    action: "invite_partner",
  });
  const email = input.partnerEmail.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("email inválido");
  const now = new Date().toISOString();
  return {
    id: `pinv_${Date.now()}`,
    tenantId: input.tenantId,
    hostWorkspaceId: input.hostWorkspaceId,
    partnerEmail: email.slice(0, 120),
    role: "partner_auditor",
    status: "pending",
    whiteLabelPreview: Boolean(input.whiteLabelPreview),
    createdAt: now,
    updatedAt: now,
  };
}

export function acceptPartnerInvite(input: {
  invite: PartnerInvite;
  partnerUserId: string;
  partnerWorkspaceId: string;
}): {
  invite: PartnerInvite;
  link: PartnerWorkspaceLink;
  binding: WorkspaceRoleBinding;
} {
  if (input.invite.status !== "pending") throw new Error("convite não está pending");
  const now = new Date().toISOString();
  const invite: PartnerInvite = {
    ...input.invite,
    status: "accepted",
    acceptedUserId: input.partnerUserId,
    updatedAt: now,
  };
  const link: PartnerWorkspaceLink = {
    id: `plink_${Date.now()}`,
    tenantId: invite.tenantId,
    hostWorkspaceId: invite.hostWorkspaceId,
    partnerWorkspaceId: input.partnerWorkspaceId,
    partnerUserId: input.partnerUserId,
    mode: "read_prepare",
    createdAt: now,
  };
  const binding = bindRole({
    workspaceId: invite.hostWorkspaceId,
    userId: input.partnerUserId,
    role: "partner_auditor",
  });
  return { invite, link, binding };
}

export function revokePartnerInvite(invite: PartnerInvite): PartnerInvite {
  return { ...invite, status: "revoked", updatedAt: new Date().toISOString() };
}

/** Lança se o ator puder transmitir — parceiro puro não pode. */
export function assertPartnerCannotTransmit(opts: {
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
  userId: string;
}): void {
  const isPartner = opts.bindings.some(
    (b) =>
      b.workspaceId === opts.workspaceId &&
      b.userId === opts.userId &&
      b.role === "partner_auditor",
  );
  if (!isPartner) throw new Error("assertPartnerCannotTransmit: usuário não é partner_auditor");
  const g = canAct({ ...opts, action: "transmit" });
  if (g.ok) throw new Error("partner_auditor não pode transmitir");
}

export function partnerMayPrepare(opts: {
  bindings: WorkspaceRoleBinding[];
  workspaceId: string;
  userId: string;
}): boolean {
  return canAct({ ...opts, action: "partner_prepare" }).ok;
}

export function whiteLabelCommercialRow(preview: boolean): {
  resource: string;
  claimAllowed: false;
  banner: string;
} {
  return {
    resource: preview ? "White-label preview (parceiro)" : "White-label (off)",
    claimAllowed: false,
    banner: "Preview sem produção global · sem marca RFB · maturidade espelhada do host",
  };
}
