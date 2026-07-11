import { NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/config";

/**
 * OAuth / magic-link / password-recovery callback.
 * Exchanges code for session cookies via @supabase/ssr.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/app";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=auth_unconfigured`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
