/// <reference lib="webworker" />
import { processZipBatchInMemory } from "@/lib/store/process-memory";
import type { ImportWorkerInbound, ImportWorkerOutbound } from "@/lib/import/worker-messages";

declare const self: DedicatedWorkerGlobalScope;

let canceled = false;

function post(msg: ImportWorkerOutbound) {
  self.postMessage(msg);
}

self.onmessage = async (event: MessageEvent<ImportWorkerInbound>) => {
  const data = event.data;
  if (data.type === "cancel") {
    canceled = true;
    return;
  }
  if (data.type !== "start") return;

  canceled = false;
  try {
    const store = await processZipBatchInMemory({
      buffer: data.buffer,
      fileName: data.fileName,
      name: data.name,
      cnpjLabel: data.cnpjLabel,
      month: data.month,
      year: data.year,
      workspaceId: data.workspaceId,
      keepRawJson: data.keepRawJson,
      keepFields: data.keepFields,
      incremental: data.incremental,
      knownHashes: data.knownHashes,
      onProgress: (percent, message) => {
        if (canceled) throw new Error("IMPORT_CANCELED");
        post({
          type: "progress",
          processed: percent,
          total: 100,
          stage: message,
          percent,
        });
      },
    });

    if (canceled) {
      post({ type: "error", error: { message: "Importação cancelada", code: "canceled" } });
      return;
    }

    post({
      type: "done",
      summary: {
        documentCount: store.documents.length,
        itemCount: store.items.length,
      },
      store,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no worker de importação";
    post({
      type: "error",
      error: {
        message: message === "IMPORT_CANCELED" ? "Importação cancelada" : message,
        code: message === "IMPORT_CANCELED" ? "canceled" : "worker_error",
      },
    });
  }
};
