import type { BatchStore } from "@/types";
import type { CapturedRawXml } from "@/lib/store/process-memory";

export type ImportWorkerInbound =
  | {
      type: "start";
      buffer: ArrayBuffer;
      fileName: string;
      name?: string;
      cnpjLabel?: string;
      month?: number;
      year?: number;
      workspaceId?: string;
      keepRawJson?: boolean;
      keepFields?: boolean;
      captureRawXml?: boolean;
      incremental?: boolean;
      knownHashes?: string[];
      knownHashIndex?: Record<string, { documentId: string; batchId: string }>;
    }
  | { type: "cancel" };

export type ImportWorkerOutbound =
  | { type: "progress"; processed: number; total: number; stage: string; percent: number }
  | { type: "warning"; warning: string }
  | { type: "error"; error: { message: string; code?: string } }
  | {
      type: "done";
      summary: { documentCount: number; itemCount: number; rawXmlCount: number };
      store: BatchStore;
      /** Original XML payloads — transferred once; caller must persist then discard. */
      rawXmls: CapturedRawXml[];
    };

export type WorkerMessage = ImportWorkerOutbound;
