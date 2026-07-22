"use client";

import { useEffect, useState } from "react";
import { DocumentExportWorkspace } from "@/components/documents/document-export-workspace";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import { idbListBatches, idbGetBatchStore } from "@/lib/store/idb-store";
import type { BatchStore } from "@/types";

export default function GlobalDocumentsPage() {
  const [stores, setStores] = useState<BatchStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const batches = await idbListBatches();
        const loaded: BatchStore[] = [];
        for (const b of batches) {
          const s = await idbGetBatchStore(b.id);
          if (s) loaded.push(s);
        }
        if (!cancelled) setStores(loaded);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar lotes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <LocalPersistenceBanner compact />
      {loading && (
        <div className="skeleton h-64 rounded-2xl" aria-busy="true" aria-label="Carregando documentos" />
      )}
      {error && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100" role="alert">
          {error}
        </div>
      )}
      {!loading && !error && (
        <DocumentExportWorkspace
          scope={{ mode: "multi_batch", batchIds: stores.map((s) => s.batch.id) }}
          stores={stores}
          title="Documentos (multilote)"
        />
      )}
    </div>
  );
}
