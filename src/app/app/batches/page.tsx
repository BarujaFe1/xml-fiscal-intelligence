"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { idbDeleteBatch, mergeBatchLists } from "@/lib/store/idb-store";
import type { Batch } from "@/types";

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/batches");
        const data = await res.json();
        const merged = await mergeBatchLists(data.batches || []);
        if (!cancelled) setBatches(merged);
      } catch {
        const merged = await mergeBatchLists([]);
        if (!cancelled) setBatches(merged);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(id: string) {
    if (!confirm("Excluir este lote?")) return;
    await idbDeleteBatch(id);
    try {
      await fetch(`/api/batches/${id}`, { method: "DELETE" });
    } catch {
      // ignore
    }
    toast.success("Lote excluído");
    setBatches((prev) => (prev || []).filter((b) => b.id !== id));
  }

  const loading = batches === null;
  const list = batches || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            Histórico de lotes
          </h1>
          <p className="text-slate-400 mt-1">Abra, exporte ou exclua lotes processados.</p>
        </div>
        <Link href="/app/upload">
          <Button>Novo upload</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lotes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="skeleton h-24 rounded-xl" />}
          {!loading && list.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-slate-400">
              Nenhum lote processado.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Upload</th>
                  <th className="py-2 pr-3">XMLs</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className="border-b border-white/5">
                    <td className="py-3 pr-3">
                      <Link href={`/app/batches/${b.id}`} className="text-sky-300 hover:underline">
                        {b.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {b.cnpjLabel || "—"} {b.month && b.year ? `· ${b.month}/${b.year}` : ""}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-400">{formatDateTime(b.createdAt)}</td>
                    <td className="py-3 pr-3">
                      {b.validXml}/{b.totalXml}
                    </td>
                    <td className="py-3 pr-3">{b.healthScore == null ? "—" : b.healthScore}</td>
                    <td className="py-3 pr-3">{formatCurrency(b.totalValue)}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={b.status === "completed" ? "success" : b.status === "failed" ? "error" : "warning"}>
                        {b.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Link href={`/app/batches/${b.id}/exports`}>
                          <Button size="sm" variant="secondary">
                            Exportar
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => remove(b.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
