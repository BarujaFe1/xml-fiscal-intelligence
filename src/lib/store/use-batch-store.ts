"use client";

import { useEffect, useState } from "react";
import { idbGetBatchStore } from "@/lib/store/idb-store";
import type { BatchStore } from "@/types";

/** Load batch from IndexedDB first, then API (Vercel-safe). */
export function useBatchStore(batchId: string | undefined) {
  const [store, setStore] = useState<BatchStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const local = await idbGetBatchStore(batchId);
        if (!cancelled && local) {
          setStore(local);
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/batches/${batchId}`);
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok || data.error) {
            setStore(null);
            setError(data.error || "Lote não encontrado");
          } else {
            setStore(data as BatchStore);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar lote");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [batchId]);

  return { store, loading, error, setStore };
}
