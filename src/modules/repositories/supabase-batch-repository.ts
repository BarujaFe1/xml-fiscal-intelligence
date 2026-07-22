/**
 * Supabase-backed batch registry (metadata). Source of truth when cloudProcessing is on.
 */
import type { Batch, BatchStore } from "@/types";
import { createServiceClient } from "@/lib/auth/supabase-service";
import { uuidFromLocalKey } from "@/lib/cloud/stable-uuid";
import type { BatchRepository } from "./contracts";

export function createSupabaseBatchRepository(): BatchRepository {
  return {
    async list(workspaceId) {
      const supabase = createServiceClient();
      const ws = uuidFromLocalKey("workspace", workspaceId);
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(rowToBatch);
    },
    async getStore(_workspaceId, _batchId) {
      // Full document store still local / storage — metadata-only listing for now.
      return null;
    },
    async saveStore(workspaceId, store) {
      const supabase = createServiceClient();
      const ws = uuidFromLocalKey("workspace", workspaceId || store.batch.workspaceId);
      const batchId = uuidFromLocalKey("batch", store.batch.id);
      const { error } = await supabase.from("batches").upsert(
        {
          id: batchId,
          workspace_id: ws,
          name: store.batch.name,
          cnpj_label: store.batch.cnpjLabel || null,
          uploaded_file_name: store.batch.uploadedFileName || store.batch.name,
          status: store.batch.status || "migrated_local",
          total_xml: store.documents.length,
          valid_xml: store.documents.filter((d) => d.parseStatus === "ok").length,
          quality_json: {
            source: "supabase_batch_repository",
            localBatchId: store.batch.id,
            documentCount: store.documents.length,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw new Error(error.message);
    },
    async delete(workspaceId, batchId) {
      const supabase = createServiceClient();
      const id = uuidFromLocalKey("batch", batchId);
      const ws = uuidFromLocalKey("workspace", workspaceId);
      const { error } = await supabase.from("batches").delete().eq("id", id).eq("workspace_id", ws);
      if (error) throw new Error(error.message);
    },
  };
}

function rowToBatch(row: Record<string, unknown>): Batch {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name || ""),
    uploadedFileName: String(row.uploaded_file_name || row.name || ""),
    status: String(row.status || "pending") as Batch["status"],
    totalFiles: Number(row.total_files || 0),
    totalXml: Number(row.total_xml || 0),
    validXml: Number(row.valid_xml || 0),
    invalidXml: Number(row.invalid_xml || 0),
    nfeCount: Number(row.nfe_count || 0),
    cteCount: Number(row.cte_count || 0),
    nfseCount: Number(row.nfse_count || 0),
    unknownCount: Number(row.unknown_count || 0),
    duplicateCount: 0,
    totalValue: Number(row.total_value || 0),
    healthScore: Number(row.health_score || 0),
    progress: 100,
    progressMessage: "cloud",
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    cnpjLabel: row.cnpj_label ? String(row.cnpj_label) : undefined,
    syncStatus: "synced",
    cloudBatchId: String(row.id),
  };
}

export async function ensureWorkspace(
  workspaceLocalKey: string,
  name: string,
  options?: { ownerUserId?: string },
): Promise<string> {
  const supabase = createServiceClient();
  const id = uuidFromLocalKey("workspace", workspaceLocalKey);
  const { data } = await supabase.from("workspaces").select("id").eq("id", id).maybeSingle();
  if (!data) {
    const { error } = await supabase.from("workspaces").insert({ id, name });
    if (error) throw new Error(error.message);
    if (options?.ownerUserId) {
      const { error: memErr } = await supabase.from("workspace_members").insert({
        workspace_id: id,
        user_id: options.ownerUserId,
        role: "owner",
      });
      if (memErr && !/duplicate|unique/i.test(memErr.message)) {
        throw new Error(memErr.message);
      }
    }
  } else if (options?.ownerUserId) {
    // Ensure creator has membership if missing (idempotent)
    const { data: mem } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", id)
      .eq("user_id", options.ownerUserId)
      .maybeSingle();
    if (!mem) {
      // Do not auto-join existing foreign workspaces — only attach when empty membership
      const { count } = await supabase
        .from("workspace_members")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", id);
      if ((count ?? 0) === 0) {
        await supabase.from("workspace_members").insert({
          workspace_id: id,
          user_id: options.ownerUserId,
          role: "owner",
        });
      }
    }
  }
  return id;
}
