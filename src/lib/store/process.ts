import { DEFAULT_WORKSPACE_ID, saveBatchStore, saveRawXml } from "@/lib/store/fs-store";
import { processZipBatchInMemory } from "@/lib/store/process-memory";
import { extractXmlFromZip } from "@/lib/zip/extract";
import type { BatchStore } from "@/types";

export interface ProcessZipInput {
  buffer: ArrayBuffer | Buffer;
  fileName: string;
  name?: string;
  cnpjLabel?: string;
  month?: number;
  year?: number;
  workspaceId?: string;
  onProgress?: (progress: number, message: string) => Promise<void> | void;
}

/** Server-side ZIP processing with filesystem persistence (local / small uploads). */
export async function processZipBatch(input: ProcessZipInput): Promise<BatchStore> {
  const store = await processZipBatchInMemory({
    ...input,
    workspaceId: input.workspaceId || DEFAULT_WORKSPACE_ID,
    keepRawJson: true,
    keepFields: true,
    onProgress: async (progress, message) => {
      // Persist lightweight progress snapshot when possible
      await input.onProgress?.(progress, message);
    },
  });

  // Persist raw XMLs for download
  try {
    const extracted = await extractXmlFromZip(input.buffer);
    for (const file of extracted.xmlFiles) {
      const doc = store.documents.find((d) => d.fileName === file.fileName);
      if (!doc) continue;
      try {
        doc.rawXmlPath = await saveRawXml(store.batch.id, file.fileName, file.content);
      } catch {
        // non-fatal
      }
    }
  } catch {
    // non-fatal
  }

  await saveBatchStore(store);
  return store;
}
