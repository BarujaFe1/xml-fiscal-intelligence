/**
 * IndexedDB batch adapter — offline/cache only. Not the SaaS source of truth.
 */
import {
  idbDeleteBatch,
  idbGetBatchStore,
  idbListBatches,
  idbSaveBatchStore,
} from "@/lib/store/idb-store";
import type { BatchRepository } from "./contracts";

export function createIndexedDbBatchRepository(): BatchRepository {
  return {
    async list(_workspaceId) {
      // Local mode has soft workspace filter later; today returns all browser batches.
      return idbListBatches();
    },
    async getStore(_workspaceId, batchId) {
      return idbGetBatchStore(batchId);
    },
    async saveStore(_workspaceId, store) {
      await idbSaveBatchStore(store);
    },
    async delete(_workspaceId, batchId) {
      await idbDeleteBatch(batchId);
    },
  };
}
