import { NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";

export type ApiAuthResult =
  | { ok: true; userId: string; mode: "authenticated" | "local_dev" }
  | { ok: false; response: NextResponse };

/**
 * Gate for server routes that touch shared filesystem or privileged ops.
 *
 * - Supabase configured → require a real session (401 otherwise).
 * - Production without Supabase → reject privileged fs APIs (503): durable
 *   source of truth must not be anonymous /tmp.
 * - Local/dev without Supabase → allow `local_dev` for IndexedDB-first demos.
 */
export async function requireApiSession(options?: {
  /** When true, even local_dev is rejected (migrate/sync/service-role paths). */
  requireCloudAuth?: boolean;
}): Promise<ApiAuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(url && anon);
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  if (configured) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.id) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Não autenticado", code: "unauthenticated" },
            { status: 401 },
          ),
        };
      }
      return { ok: true, userId: data.user.id, mode: "authenticated" };
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Falha ao validar sessão", code: "auth_error" },
          { status: 401 },
        ),
      };
    }
  }

  if (options?.requireCloudAuth || isProd) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "API de armazenamento compartilhado indisponível sem autenticação. Use o modo local no navegador ou configure Supabase.",
          code: "cloud_auth_required",
        },
        { status: 503 },
      ),
    };
  }

  return { ok: true, userId: "local-dev", mode: "local_dev" };
}
