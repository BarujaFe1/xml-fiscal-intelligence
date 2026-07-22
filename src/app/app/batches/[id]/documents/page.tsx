"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { DocumentExportWorkspace } from "@/components/documents/document-export-workspace";
import { useBatchStore } from "@/lib/store/use-batch-store";

function DocumentsHub() {
  const params = useParams<{ id: string }>();
  const { store, loading, error } = useBatchStore(params.id);
  const stores = useMemo(() => (store ? [store] : []), [store]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Carregando documentos">
        <div className="skeleton h-16 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (!store) {
    return (
      <div
        className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-100"
        role="alert"
      >
        {error || "Lote não encontrado neste navegador. Importe o ZIP novamente."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BatchTabs batchId={params.id} />
      <p className="text-sm text-slate-400">
        Escopo: lote <strong className="text-slate-200">{store.batch.name}</strong>
        {" · "}
        <Link href="/app/documents" className="text-sky-300 underline-offset-2 hover:underline">
          Abrir visão multilote
        </Link>
      </p>
      <DocumentExportWorkspace
        scope={{ mode: "single_batch", batchIds: [store.batch.id] }}
        stores={stores}
        title="Documentos"
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
      <DocumentsHub />
    </Suspense>
  );
}
