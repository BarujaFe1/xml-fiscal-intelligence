import { DEFAULT_WORKSPACE_ID, saveBatchStore, saveRawXml } from "@/lib/store/fs-store";
import { processZipBatchInMemory } from "@/lib/store/process-memory";
import type { BatchStore } from "@/types";

export interface ProcessZipInput {
  buffer: ArrayBuffer | Buffer;
  fileName: string;
  name?: string;
  cnpjLabel?: string;
  month?: number;
  year?: number;
  workspaceId?: string;
  /** Filesystem tenant scope (auth user id). Required for server persist. */
  ownerKey?: string;
  onProgress?: (progress: number, message: string) => Promise<void> | void;
}

/** Server-side ZIP processing with filesystem persistence (local / small uploads). */
export async function processZipBatch(input: ProcessZipInput): Promise<BatchStore> {
  const ownerKey = input.ownerKey || "local-dev";
  const { store, rawXmls } = await processZipBatchInMemory({
    ...input,
    workspaceId: input.workspaceId || DEFAULT_WORKSPACE_ID,
    keepRawJson: true,
    keepFields: true,
    captureRawXml: true,
    onProgress: async (progress, message) => {
      await input.onProgress?.(progress, message);
    },
  });

  for (const raw of rawXmls) {
    const doc = store.documents.find((d) => d.id === raw.documentId);
    if (!doc) continue;
    try {
      doc.rawXmlPath = await saveRawXml(ownerKey, store.batch.id, raw.fileName, raw.content);
    } catch {
      // non-fatal
    }
  }

  await saveBatchStore(ownerKey, store);
  return store;
}
