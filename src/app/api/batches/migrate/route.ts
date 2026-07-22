import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServiceClient, hasServiceRole } from "@/lib/auth/supabase-service";
import { getFeatureFlags } from "@/lib/feature-flags";
import { uuidFromLocalKey } from "@/lib/cloud/stable-uuid";
import { ensureWorkspace } from "@/modules/repositories/supabase-batch-repository";
import type { CloudMigrationStatus } from "@/modules/obligations/efd-icms-ipi/status";
import { requireApiSession } from "@/lib/auth/api-guard";
import { assertWorkspaceMembership } from "@/lib/auth/workspace-access";

/**
 * Register local batch metadata into cloud registry.
 * Maps non-UUID local ids → deterministic UUIDs (bugfix for ws_local_demo).
 */
export async function POST(req: Request) {
  const auth = await requireApiSession({ requireCloudAuth: true });
  if (!auth.ok) return auth.response;

  const flags = getFeatureFlags();
  if (!flags.cloudProcessing || !isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Persistência em nuvem indisponível. Configure Supabase e FEATURE_CLOUD_PROCESSING=true.",
        code: "cloud_unavailable",
        migrationStatus: "failed" satisfies CloudMigrationStatus,
      },
      { status: 503 },
    );
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY ausente — migração cloud bloqueada",
        code: "service_role_missing",
        migrationStatus: "failed" satisfies CloudMigrationStatus,
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
      periodLabel?: string;
      batch?: { id: string; name?: string; uploadedFileName?: string };
      summary?: { documentCount?: number; hashes?: string[]; itemCount?: number };
      documents?: Array<{
        id: string;
        documentType?: string;
        accessKey?: string;
        protocol?: string;
        xmlHash?: string;
        number?: string;
        issueDate?: string;
        emitterDoc?: string;
        totalValue?: number;
        parseStatus?: string;
        fileName?: string;
      }>;
    };

    if (!body.batch?.id) {
      return NextResponse.json({ error: "batch.id obrigatório" }, { status: 400 });
    }
    if (!body.workspaceId) {
      return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
    }

    const localWs = body.workspaceId;
    const localBatchId = body.batch.id;
    const workspaceId = await ensureWorkspace(
      localWs,
      body.companyLabel || body.establishmentLabel || `Workspace ${localWs}`,
      { ownerUserId: auth.userId },
    );
    const membership = await assertWorkspaceMembership(auth.userId, workspaceId, [
      "owner",
      "admin",
      "accountant",
      "operator",
    ]);
    if (!membership.ok) return membership.response;
    const cloudBatchId = uuidFromLocalKey("batch", localBatchId);
    const docCount = body.summary?.documentCount || body.documents?.length || 0;

    const supabase = createServiceClient();
    const { data: existingBatch } = await supabase
      .from("batches")
      .select("id")
      .eq("id", cloudBatchId)
      .maybeSingle();
    const duplicate = Boolean(existingBatch);

    const batchName = body.batch.name || `Lote ${localBatchId.slice(0, 8)}`;
    const { error: upsertError } = await supabase.from("batches").upsert(
      {
        id: cloudBatchId,
        workspace_id: workspaceId,
        name: batchName,
        cnpj_label: body.companyLabel || null,
        uploaded_file_name: body.batch.uploadedFileName || batchName,
        status: "migrated_local",
        total_xml: docCount,
        valid_xml: docCount,
        quality_json: {
          source: "indexeddb_migrate",
          localBatchId,
          localWorkspaceKey: localWs,
          hashesSample: (body.summary?.hashes || []).slice(0, 20),
          establishmentLabel: body.establishmentLabel || null,
          periodLabel: body.periodLabel || null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (upsertError) throw new Error(upsertError.message);

    // Best-effort document metadata upsert (dedupe by id)
    let docsPersisted = 0;
    for (const d of (body.documents || []).slice(0, 2000)) {
      const docId = uuidFromLocalKey("document", d.id);
      const { error } = await supabase.from("documents").upsert(
        {
          id: docId,
          workspace_id: workspaceId,
          batch_id: cloudBatchId,
          document_type: d.documentType || "NFE",
          file_name: d.fileName || `${d.id}.xml`,
          access_key: d.accessKey || null,
          protocol: d.protocol || null,
          number: d.number || null,
          issue_date: d.issueDate || null,
          emitter_doc: d.emitterDoc || null,
          total_value: d.totalValue ?? null,
          status: d.parseStatus || null,
          parse_status: d.parseStatus || "ok",
          raw_json: { localId: d.id, xmlHash: d.xmlHash || null },
          flattened_json: {},
        },
        { onConflict: "id" },
      );
      if (!error) docsPersisted += 1;
    }

    return NextResponse.json({
      ok: true,
      cloudBatchId,
      localBatchId,
      duplicate,
      workspaceId,
      localWorkspaceKey: localWs,
      documentCount: docCount,
      docsPersisted,
      migrationStatus: "synchronized" satisfies CloudMigrationStatus,
      note: "Metadados + amostra de documentos. XML bruto permanece local até upload de storage.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "migrate failed",
        migrationStatus: "failed" satisfies CloudMigrationStatus,
      },
      { status: 500 },
    );
  }
}
