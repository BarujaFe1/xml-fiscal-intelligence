import type { BatchStore } from "@/types";

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
      incremental?: boolean;
      knownHashes?: string[];
      knownHashIndex?: Record<string, { documentId: string; batchId: string }>;
    }
  | { type: "cancel" };

export type ImportWorkerOutbound =
  | { type: "progress"; processed: number; total: number; stage: string; percent: number }
  | { type: "warning"; warning: string }
  | { type: "error"; error: { message: string; code?: string } }
  | { type: "done"; summary: { documentCount: number; itemCount: number }; store: BatchStore };

export type WorkerMessage = ImportWorkerOutbound;
