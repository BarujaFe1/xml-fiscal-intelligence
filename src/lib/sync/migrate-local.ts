import type { Batch, BatchStore, SyncStatus } from "@/types";
import {
  idbGetBatchStore,
  idbListBatches,
  idbSaveBatchStore,
  idbDeleteBatch,
} from "@/lib/store/idb-store";
import { buildMigrateSnapshot } from "@/lib/sync/build-migrate-snapshot";

export interface LocalBatchInventoryItem {
  id: string;
  name: string;
  documents: number;
  items: number;
  approxBytes: number;
  syncStatus: SyncStatus;
  createdAt: string;
}

export interface MigrationPlan {
  batchIds: string[];
  workspaceId: string;
  companyLabel?: string;
  establishmentLabel?: string;
  keepLocalCopy: boolean;
  /** Upload privacy-aware JSON snapshot to private storage after metadata upsert. */
  uploadSnapshot?: boolean;
}

export interface MigrationBatchResult {
  batchId: string;
  ok: boolean;
  syncStatus: SyncStatus;
  message: string;
  cloudBatchId?: string;
  snapshotPath?: string;
}

function approxStoreBytes(store: BatchStore): number {
  try {
    return new Blob([JSON.stringify(store)]).size;
  } catch {
    return store.documents.length * 4000 + store.items.length * 800;
  }
}

export async function inventoryLocalBatches(): Promise<{
  items: LocalBatchInventoryItem[];
  totalApproxBytes: number;
}> {
  const batches = await idbListBatches();
  const items: LocalBatchInventoryItem[] = [];
  let totalApproxBytes = 0;
  for (const b of batches) {
    const store = await idbGetBatchStore(b.id);
    if (!store) continue;
    const approxBytes = approxStoreBytes(store);
    totalApproxBytes += approxBytes;
    items.push({
      id: b.id,
      name: b.name,
      documents: store.documents.length,
      items: store.items.length,
      approxBytes,
      syncStatus: b.syncStatus || "local",
      createdAt: b.createdAt,
    });
  }
  return { items, totalApproxBytes };
}

async function patchBatchSync(
  batchId: string,
  patch: Partial<Pick<Batch, "syncStatus" | "syncError" | "syncedAt" | "cloudBatchId">>,
): Promise<void> {
  const store = await idbGetBatchStore(batchId);
  if (!store) return;
  store.batch = {
    ...store.batch,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await idbSaveBatchStore(store);
}

/**
 * Attempt cloud registry of batch metadata (not full XML dump by default).
 * Safe when SaaS API is unavailable — marks error and keeps local copy.
 */
export async function migrateLocalBatches(plan: MigrationPlan): Promise<{
  results: MigrationBatchResult[];
  cloudConfigured: boolean;
}> {
  const results: MigrationBatchResult[] = [];
  let cloudConfigured = true;

  for (const batchId of plan.batchIds) {
    const store = await idbGetBatchStore(batchId);
    if (!store) {
      results.push({
        batchId,
        ok: false,
        syncStatus: "error",
        message: "Lote não encontrado no IndexedDB",
      });
      continue;
    }

    await patchBatchSync(batchId, { syncStatus: "syncing", syncError: undefined });

    try {
      const res = await fetch("/api/batches/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          workspaceId: plan.workspaceId,
          companyLabel: plan.companyLabel,
          establishmentLabel: plan.establishmentLabel,
          batch: {
            ...store.batch,
            workspaceId: plan.workspaceId,
            syncStatus: "syncing",
          },
          summary: {
            documentCount: store.documents.length,
            itemCount: store.items.length,
            hashes: store.documents.map((d) => d.xmlHash).filter(Boolean).slice(0, 5000),
          },
          // Structured metadata only — raw XML stays local unless cloud processing is enabled.
          documents: store.documents.map((d) => ({
            id: d.id,
            documentType: d.documentType,
            accessKey: d.accessKey,
            protocol: d.protocol,
            xmlHash: d.xmlHash,
            number: d.number,
            issueDate: d.issueDate,
            emitterDoc: d.emitterDoc,
            totalValue: d.totalValue,
            parseStatus: d.parseStatus,
          })),
        }),
      });

      if (res.status === 503 || res.status === 501) {
        cloudConfigured = false;
        const message =
          "Nuvem não configurada (Supabase/storage). Lote permanece somente local.";
        await patchBatchSync(batchId, { syncStatus: "local", syncError: message });
        results.push({ batchId, ok: false, syncStatus: "local", message });
        continue;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const message = data.error || `Falha HTTP ${res.status}`;
        await patchBatchSync(batchId, { syncStatus: "error", syncError: message });
        results.push({ batchId, ok: false, syncStatus: "error", message });
        continue;
      }

      const data = (await res.json()) as { cloudBatchId?: string; duplicate?: boolean };
      const syncedAt = new Date().toISOString();
      await patchBatchSync(batchId, {
        syncStatus: "synced",
        syncedAt,
        cloudBatchId: data.cloudBatchId || batchId,
        syncError: undefined,
      });

      let snapshotPath: string | undefined;
      if (plan.uploadSnapshot !== false) {
        try {
          const snap = buildMigrateSnapshot(store);
          const period =
            store.batch.year && store.batch.month
              ? `${store.batch.year}-${String(store.batch.month).padStart(2, "0")}`
              : undefined;
          const snapRes = await fetch("/api/batches/migrate/snapshot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId: plan.workspaceId,
              batchId,
              period,
              snapshot: snap,
            }),
          });
          if (snapRes.ok) {
            const snapData = (await snapRes.json()) as { path?: string };
            snapshotPath = snapData.path;
          }
        } catch {
          // Metadata already synced — snapshot is best-effort.
        }
      }

      results.push({
        batchId,
        ok: true,
        syncStatus: "synced",
        message: data.duplicate
          ? `Já existia na nuvem${snapshotPath ? " · snapshot atualizado" : ""}`
          : `Metadados na nuvem${snapshotPath ? " · snapshot storage" : " · XML/ZIP bruto ainda local"}`,
        cloudBatchId: data.cloudBatchId || batchId,
        snapshotPath,
      });
    } catch (err) {
      cloudConfigured = false;
      const message = err instanceof Error ? err.message : "Falha de rede";
      await patchBatchSync(batchId, { syncStatus: "error", syncError: message });
      results.push({ batchId, ok: false, syncStatus: "error", message });
    }
  }

  return { results, cloudConfigured };
}

export async function removeLocalAfterSync(batchId: string): Promise<void> {
  const store = await idbGetBatchStore(batchId);
  if (!store) return;
  if (store.batch.syncStatus !== "synced") {
    throw new Error("Só remova cópia local após syncStatus=synced");
  }
  await idbDeleteBatch(batchId);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
