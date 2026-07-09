"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BatchStore } from "@/types";

export default function FieldsPage() {
  const params = useParams<{ id: string }>();
  const [store, setStore] = useState<BatchStore | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`/api/batches/${params.id}`)
      .then((r) => r.json())
      .then((d) => setStore(d.error ? null : d));
  }, [params.id]);

  const rows = useMemo(() => {
    if (!store) return [];
    const filtered = store.fields.filter((f) => {
      if (!q) return true;
      return (
        f.pathNormalized.toLowerCase().includes(q.toLowerCase()) ||
        (f.valueText || "").toLowerCase().includes(q.toLowerCase())
      );
    });
    return filtered.slice(0, 500);
  }, [store, q]);

  const uniqueTags = useMemo(() => {
    if (!store) return 0;
    return new Set(store.fields.map((f) => f.pathNormalized)).size;
  }, [store]);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{store.batch.name} · Campos / tags</h1>
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
              href === "/fields"
                ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            Mapa de campos · {uniqueTags} tags únicas · mostrando {rows.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar path ou valor..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md"
          />
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-950">
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Path</th>
                  <th className="py-2">Valor</th>
                  <th className="py-2">Tipo inferido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} className="border-b border-white/5">
                    <td className="py-2 text-slate-400">{f.documentType}</td>
                    <td className="py-2 font-mono text-xs text-sky-200">
                      <Link href={`/app/batches/${params.id}/documents/${f.documentId}`}>
                        {f.pathNormalized}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-300 max-w-md truncate">{f.valueText || "—"}</td>
                    <td className="py-2 text-slate-500">{f.inferredType}</td>
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
