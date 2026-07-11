import { processZipBatchInMemory, type ProcessZipMemoryInput } from "@/lib/store/process-memory";
import type { BatchStore } from "@/types";
import type { ImportWorkerInbound, ImportWorkerOutbound } from "@/lib/import/worker-messages";

export interface RunImportOptions extends Omit<
  ProcessZipMemoryInput,
  "knownHashes" | "knownHashIndex" | "onProgress"
> {
  knownHashes?: Set<string> | string[];
  knownHashIndex?:
    | Map<string, { documentId: string; batchId: string }>
    | Record<string, { documentId: string; batchId: string }>;
  onProgress?: (progress: number, message: string) => void;
  signal?: AbortSignal;
  /** Force main-thread processing (tests / unsupported browsers). */
  forceMainThread?: boolean;
}

function serializeHashIndex(
  index: RunImportOptions["knownHashIndex"],
): Record<string, { documentId: string; batchId: string }> | undefined {
  if (!index) return undefined;
  if (index instanceof Map) return Object.fromEntries(index);
  return index;
}

/**
 * Prefer Web Worker for ZIP parse so the UI stays responsive.
 * Falls back to main-thread `processZipBatchInMemory` when Worker is unavailable.
 */
export async function runImportPipeline(options: RunImportOptions): Promise<BatchStore> {
  const knownHashes = Array.from(
    options.knownHashes instanceof Set ? options.knownHashes : options.knownHashes || [],
  );
  const knownHashIndex = serializeHashIndex(options.knownHashIndex);

  if (options.forceMainThread || typeof Worker === "undefined" || typeof window === "undefined") {
    return processZipBatchInMemory({
      ...options,
      knownHashes,
      knownHashIndex,
      onProgress: options.onProgress,
    });
  }

  return new Promise<BatchStore>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" });
    } catch {
      processZipBatchInMemory({
        ...options,
        knownHashes,
        knownHashIndex,
        onProgress: options.onProgress,
      }).then(resolve, reject);
      return;
    }

    const cleanup = () => {
      options.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    };

    const onAbort = () => {
      worker.postMessage({ type: "cancel" } satisfies ImportWorkerInbound);
      cleanup();
      reject(new DOMException("Importação cancelada", "AbortError"));
    };

    if (options.signal?.aborted) {
      cleanup();
      reject(new DOMException("Importação cancelada", "AbortError"));
      return;
    }
    options.signal?.addEventListener("abort", onAbort);

    worker.onmessage = (event: MessageEvent<ImportWorkerOutbound>) => {
      const msg = event.data;
      if (msg.type === "progress") {
        options.onProgress?.(msg.percent, msg.stage);
        return;
      }
      if (msg.type === "warning") {
        options.onProgress?.(0, msg.warning);
        return;
      }
      if (msg.type === "error") {
        cleanup();
        reject(new Error(msg.error.message));
        return;
      }
      if (msg.type === "done") {
        cleanup();
        resolve(msg.store);
      }
    };

    worker.onerror = (err) => {
      cleanup();
      processZipBatchInMemory({
        ...options,
        knownHashes,
        knownHashIndex,
        onProgress: options.onProgress,
      }).then(resolve, reject);
      void err;
    };

    let buffer: ArrayBuffer;
    if (options.buffer instanceof ArrayBuffer) {
      buffer = options.buffer.slice(0);
    } else {
      const view = options.buffer;
      buffer = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
    }

    const start: ImportWorkerInbound = {
      type: "start",
      buffer,
      fileName: options.fileName,
      name: options.name,
      cnpjLabel: options.cnpjLabel,
      month: options.month,
      year: options.year,
      workspaceId: options.workspaceId,
      keepRawJson: options.keepRawJson,
      keepFields: options.keepFields,
      incremental: options.incremental,
      knownHashes,
      knownHashIndex,
    };
    worker.postMessage(start, [buffer]);
  });
}
