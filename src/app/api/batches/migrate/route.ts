import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getFeatureFlags } from "@/lib/feature-flags";

/**
 * Register local batch metadata into cloud registry.
 * Returns 503 when SaaS backend is not configured — client keeps IndexedDB as source of truth.
 */
export async function POST(req: Request) {
  const flags = getFeatureFlags();
  if (!flags.cloudProcessing && !isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Persistência em nuvem indisponível. Configure Supabase e FEATURE_CLOUD_PROCESSING=true.",
        code: "cloud_unavailable",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      workspaceId?: string;
      batch?: { id: string; name?: string };
      summary?: { documentCount?: number; hashes?: string[] };
    };

    if (!body.batch?.id) {
      return NextResponse.json({ error: "batch.id obrigatório" }, { status: 400 });
    }

    // Without live Supabase client wired for inserts, acknowledge idempotent dry-run path
    // so the wizard can validate payload shape. Real upsert lands when DB keys exist.
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error: "Supabase não configurado — migração completa bloqueada",
          code: "supabase_missing",
        },
        { status: 503 },
      );
    }

    // Placeholder acknowledgement — service-role upsert will replace this when keys are present.
    return NextResponse.json({
      ok: true,
      cloudBatchId: body.batch.id,
      duplicate: false,
      note: "Registro aceito no endpoint; aplique migrations e service role para persistência durable.",
      workspaceId: body.workspaceId,
      documentCount: body.summary?.documentCount || 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "migrate failed" },
      { status: 500 },
    );
  }
}
