import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServiceClient, hasServiceRole } from "@/lib/auth/supabase-service";
import { getFeatureFlags } from "@/lib/feature-flags";

/**
 * Register local batch metadata into cloud registry.
 * Returns 503 when SaaS backend is not configured — client keeps IndexedDB as source of truth.
 * Does not upload raw XML by default (metadata + counts only).
 */
export async function POST(req: Request) {
  const flags = getFeatureFlags();
  if (!flags.cloudProcessing || !isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Persistência em nuvem indisponível. Configure Supabase e FEATURE_CLOUD_PROCESSING=true.",
        code: "cloud_unavailable",
      },
      { status: 503 },
    );
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY ausente — migração cloud bloqueada",
        code: "service_role_missing",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      workspaceId?: string;
      companyLabel?: string;
      establishmentLabel?: string;
      batch?: { id: string; name?: string };
      summary?: { documentCount?: number; hashes?: string[] };
    };

    if (!body.batch?.id) {
      return NextResponse.json({ error: "batch.id obrigatório" }, { status: 400 });
    }
    if (!body.workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const workspaceId = body.workspaceId;
    const batchId = body.batch.id;
    const batchName = body.batch.name || `Lote ${batchId.slice(0, 8)}`;
    const docCount = body.summary?.documentCount || 0;

    const { data: existingWs, error: wsLookupError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsLookupError) {
      throw new Error(wsLookupError.message);
    }

    if (!existingWs) {
      const { error: wsInsertError } = await supabase.from("workspaces").insert({
        id: workspaceId,
        name: body.companyLabel || body.establishmentLabel || "Workspace migrado",
      });
      if (wsInsertError) throw new Error(wsInsertError.message);
    }

    const { data: existingBatch } = await supabase
      .from("batches")
      .select("id")
      .eq("id", batchId)
      .maybeSingle();

    const duplicate = Boolean(existingBatch);

    const { error: upsertError } = await supabase.from("batches").upsert(
      {
        id: batchId,
        workspace_id: workspaceId,
        name: batchName,
        cnpj_label: body.companyLabel || null,
        uploaded_file_name: batchName,
        status: "migrated_local",
        total_xml: docCount,
        valid_xml: docCount,
        quality_json: {
          source: "indexeddb_migrate",
          hashesSample: (body.summary?.hashes || []).slice(0, 20),
          establishmentLabel: body.establishmentLabel || null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (upsertError) throw new Error(upsertError.message);

    return NextResponse.json({
      ok: true,
      cloudBatchId: batchId,
      duplicate,
      workspaceId,
      documentCount: docCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "migrate failed" },
      { status: 500 },
    );
  }
}
