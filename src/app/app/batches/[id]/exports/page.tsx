"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildBatchWorkbook,
  buildDocumentsCsv,
  buildHtmlReport,
  buildItemsCsv,
} from "@/lib/export/excel";
import { useBatchStore } from "@/lib/store/use-batch-store";
import type { BatchStore } from "@/types";

const exportsList = [
  { type: "xlsx", label: "Excel completo (múltiplas abas)", desc: "Resumo, Documentos, Itens, Campos, Erros, Insights" },
  { type: "csv-documents", label: "CSV Documentos", desc: "Uma linha por documento" },
  { type: "csv-items", label: "CSV Itens", desc: "Uma linha por item" },
  { type: "json", label: "JSON completo", desc: "Store inteiro do lote" },
  { type: "json-flat", label: "JSON achatado", desc: "Documentos com flattened paths" },
  { type: "html", label: "Relatório HTML", desc: "Resumo executivo para compartilhar" },
] as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportClient(store: BatchStore, type: string) {
  const id = store.batch.id;
  if (type === "xlsx") {
    const buffer = await buildBatchWorkbook(store);
    downloadBlob(
      new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `lote-${id}.xlsx`,
    );
    return;
  }
  if (type === "csv-documents") {
    downloadBlob(new Blob([buildDocumentsCsv(store)], { type: "text/csv;charset=utf-8" }), `documentos-${id}.csv`);
    return;
  }
  if (type === "csv-items") {
    downloadBlob(new Blob([buildItemsCsv(store)], { type: "text/csv;charset=utf-8" }), `itens-${id}.csv`);
    return;
  }
  if (type === "json") {
    downloadBlob(new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }), `lote-${id}.json`);
    return;
  }
  if (type === "json-flat") {
    const flat = store.documents.map((d) => ({ id: d.id, type: d.documentType, ...d.flattenedJson }));
    downloadBlob(new Blob([JSON.stringify(flat, null, 2)], { type: "application/json" }), `flat-${id}.json`);
    return;
  }
  if (type === "html") {
    downloadBlob(new Blob([buildHtmlReport(store)], { type: "text/html;charset=utf-8" }), `relatorio-${id}.html`);
  }
}

export default function ExportsPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleExport(type: string) {
    if (!store) return;
    setBusy(type);
    try {
      await exportClient(store, type);
      toast.success("Download iniciado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na exportação");
    } finally {
      setBusy(null);
    }
  }

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Exportações</h1>
      <div className="flex flex-wrap gap-2">
        {[
          ["", "Dashboard"],
          ["/documents", "Documentos"],
          ["/items", "Itens"],
          ["/fields", "Campos"],
          ["/quality", "Quality"],
          ["/exports", "Exportações"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={`/app/batches/${params.id}${href}`}
            className={`rounded-xl px-3 py-1.5 text-sm border ${
              href === "/exports"
                ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {exportsList.map((item) => (
          <Card key={item.type}>
            <CardHeader>
              <CardTitle>{item.label}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                disabled={busy === item.type}
                onClick={() => handleExport(item.type)}
              >
                {busy === item.type ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}{" "}
                Baixar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
