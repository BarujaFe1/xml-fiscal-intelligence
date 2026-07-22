"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { DocumentExportWorkspace } from "@/components/documents/document-export-workspace";
import ClassicDocuments from "./documents-inner";
import { useBatchStore } from "@/lib/store/use-batch-store";

function DocumentsHub() {
  const params = useParams<{ id: string }>();
  const { store, loading, error } = useBatchStore(params.id);
  const [legacy, setLegacy] = useState(false);
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

  if (legacy) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="text-xs text-sky-300 underline-offset-2 hover:underline"
          onClick={() => setLegacy(false)}
        >
          ← Voltar ao workspace com facetas e campos XML
        </button>
        <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
          <ClassicDocuments />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BatchTabs batchId={params.id} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <p>
          Escopo: lote <strong className="text-slate-200">{store.batch.name}</strong>
          {" · "}
          <Link href="/app/documents" className="text-sky-300 underline-offset-2 hover:underline">
            Abrir visão multilote
          </Link>
        </p>
        <button
          type="button"
          className="text-xs text-slate-500 underline-offset-2 hover:underline"
          onClick={() => setLegacy(true)}
        >
          Tabela clássica (legado)
        </button>
      </div>
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
