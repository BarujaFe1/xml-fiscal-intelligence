import { NextResponse } from "next/server";
import { createServiceClient, hasServiceRole } from "@/lib/auth/supabase-service";

export type WorkspaceRole = "owner" | "admin" | "accountant" | "operator" | "readonly";

export type MembershipResult =
  | { ok: true; role: WorkspaceRole }
  | { ok: false; response: NextResponse };

/**
 * Verify the user is a member of the workspace with an allowed role.
 * Uses service role only after caller already authenticated the user id.
 * Does not reveal whether the workspace exists to outsiders (404).
 */
export async function assertWorkspaceMembership(
  userId: string,
  workspaceId: string,
  allowedRoles: WorkspaceRole[],
): Promise<MembershipResult> {
  if (!hasServiceRole()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Autorização indisponível", code: "service_role_missing" },
        { status: 503 },
      ),
    };
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Não encontrado" }, { status: 404 }),
    };
  }
  const role = data.role as WorkspaceRole;
  if (!allowedRoles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sem permissão" }, { status: 403 }),
    };
  }
  return { ok: true, role };
}
