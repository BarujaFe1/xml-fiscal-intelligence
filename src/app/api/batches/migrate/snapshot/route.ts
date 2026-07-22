import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServiceClient, hasServiceRole } from "@/lib/auth/supabase-service";
import { getFeatureFlags } from "@/lib/feature-flags";
import { getStorageProvider } from "@/lib/storage/provider";
import { uuidFromLocalKey } from "@/lib/cloud/stable-uuid";
import { ensureWorkspace } from "@/modules/repositories/supabase-batch-repository";
import { requireApiSession } from "@/lib/auth/api-guard";
import { assertWorkspaceMembership } from "@/lib/auth/workspace-access";

const MAX_SNAPSHOT_CHARS = 12_000_000; // ~12MB JSON text

/**
 * Persist a privacy-aware batch snapshot (documents + items metadata) to private storage.
 * Does not require original ZIP; uses IndexedDB-derived JSON.
 */
export async function POST(req: Request) {
  const auth = await requireApiSession({ requireCloudAuth: true });
  if (!auth.ok) return auth.response;

  const flags = getFeatureFlags();
  if (!flags.cloudProcessing || !isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json(
      { error: "Snapshot cloud indisponível", code: "cloud_unavailable" },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as {
      workspaceId?: string;
      batchId?: string;
      period?: string;
      snapshot?: unknown;
    };
    if (!body.workspaceId || !body.batchId || body.snapshot == null) {
      return NextResponse.json(
        { error: "workspaceId, batchId e snapshot são obrigatórios" },
        { status: 400 },
      );
    }

    const workspaceId = await ensureWorkspace(body.workspaceId, "Workspace snapshot", {
      ownerUserId: auth.userId,
    });
    const membership = await assertWorkspaceMembership(auth.userId, workspaceId, [
      "owner",
      "admin",
      "accountant",
      "operator",
    ]);
    if (!membership.ok) return membership.response;

    const json = JSON.stringify(body.snapshot);
    if (json.length > MAX_SNAPSHOT_CHARS) {
      return NextResponse.json(
        { error: `Snapshot grande demais (${json.length} chars; máx ${MAX_SNAPSHOT_CHARS})` },
        { status: 413 },
      );
    }

    const cloudBatchId = uuidFromLocalKey("batch", body.batchId);
    const period = (body.period || new Date().toISOString().slice(0, 7)).replace(/[^\d-]/g, "");
    const key = `company/_/establishment/_/period/${period}/batches/${cloudBatchId}/snapshot.json`;

    const storage = getStorageProvider();
    const put = await storage.putObject({
      workspaceId,
      key,
      body: json,
      contentType: "application/json;charset=utf-8",
    });

    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("batches")
      .select("quality_json")
      .eq("id", cloudBatchId)
      .maybeSingle();
    const prev =
      existing?.quality_json && typeof existing.quality_json === "object"
        ? (existing.quality_json as Record<string, unknown>)
        : {};
    await supabase
      .from("batches")
      .update({
        quality_json: {
          ...prev,
          snapshotPath: put.path,
          snapshotBytes: Buffer.byteLength(json, "utf8"),
          snapshotAt: new Date().toISOString(),
          localBatchId: body.batchId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", cloudBatchId)
      .eq("workspace_id", workspaceId);

    return NextResponse.json({
      ok: true,
      path: put.path,
      cloudBatchId,
      workspaceId,
      bytes: Buffer.byteLength(json, "utf8"),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "snapshot failed" },
      { status: 500 },
    );
  }
}
