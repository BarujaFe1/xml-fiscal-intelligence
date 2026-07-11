/**
 * Server-side request guards. Deny by default when session is required.
 * Workspace/company IDs from the body are never trusted as authorization alone.
 */

import { getSessionUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  assertPermission,
  type Permission,
  type WorkspaceRole,
} from "@/lib/auth/permissions";

export type AuthContext = {
  mode: "authenticated" | "privacy_local";
  userId: string | null;
  email: string | null;
  role: WorkspaceRole;
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export async function resolveAuthContext(options?: {
  requireAuth?: boolean;
}): Promise<AuthContext> {
  if (!isSupabaseConfigured()) {
    if (options?.requireAuth) {
      throw new AuthError("Autenticação indisponível — Supabase não configurado", 503);
    }
    return {
      mode: "privacy_local",
      userId: null,
      email: null,
      role: "owner",
    };
  }

  const user = await getSessionUser();
  if (!user) {
    if (options?.requireAuth) {
      throw new AuthError("Sessão necessária", 401);
    }
    return {
      mode: "privacy_local",
      userId: null,
      email: null,
      role: "viewer",
    };
  }

  return {
    mode: "authenticated",
    userId: user.id,
    email: user.email ?? null,
    // Membership lookup replaces this when DB is live.
    role: "operator",
  };
}

export function requirePermission(ctx: AuthContext, permission: Permission): void {
  assertPermission(ctx.role, permission);
}
