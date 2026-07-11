/**
 * Workspace roles — authorization must be enforced server-side + RLS.
 * Never trust client-only role checks.
 */
export const WORKSPACE_ROLES = [
  "owner",
  "admin",
  "accountant",
  "fiscal_analyst",
  "operator",
  "viewer",
  "billing_manager",
  "support_readonly",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export type Permission =
  | "workspace:read"
  | "workspace:manage"
  | "members:manage"
  | "companies:manage"
  | "imports:create"
  | "imports:read"
  | "documents:read"
  | "audit:read"
  | "audit:triage"
  | "obligations:read"
  | "obligations:generate"
  | "obligations:override"
  | "exports:create"
  | "billing:manage"
  | "admin:support";

const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: [
    "workspace:read",
    "workspace:manage",
    "members:manage",
    "companies:manage",
    "imports:create",
    "imports:read",
    "documents:read",
    "audit:read",
    "audit:triage",
    "obligations:read",
    "obligations:generate",
    "obligations:override",
    "exports:create",
    "billing:manage",
  ],
  admin: [
    "workspace:read",
    "workspace:manage",
    "members:manage",
    "companies:manage",
    "imports:create",
    "imports:read",
    "documents:read",
    "audit:read",
    "audit:triage",
    "obligations:read",
    "obligations:generate",
    "obligations:override",
    "exports:create",
  ],
  accountant: [
    "workspace:read",
    "companies:manage",
    "imports:create",
    "imports:read",
    "documents:read",
    "audit:read",
    "audit:triage",
    "obligations:read",
    "obligations:generate",
    "obligations:override",
    "exports:create",
  ],
  fiscal_analyst: [
    "workspace:read",
    "imports:read",
    "documents:read",
    "audit:read",
    "audit:triage",
    "obligations:read",
    "exports:create",
  ],
  operator: [
    "workspace:read",
    "imports:create",
    "imports:read",
    "documents:read",
    "audit:read",
    "obligations:read",
    "exports:create",
  ],
  viewer: ["workspace:read", "imports:read", "documents:read", "audit:read", "obligations:read"],
  billing_manager: ["workspace:read", "billing:manage"],
  support_readonly: ["workspace:read", "imports:read", "documents:read", "audit:read", "admin:support"],
};

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(role: WorkspaceRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: role ${role} lacks ${permission}`);
  }
}
