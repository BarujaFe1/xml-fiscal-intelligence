"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, typeTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { BatchStore } from "@/types";

export default function ItemsPage() {
  const params = useParams<{ id: string }>();
  const [store, setStore] = useState<BatchStore | null>(null);

  useEffect(() => {
    fetch(`/api/batches/${params.id}`)
      .then((r) => r.json())
      .then((d) => setStore(d.error ? null : d));
  }, [params.id]);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{store.batch.name} · Itens</h1>
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
              href === "/items"
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
          <CardTitle>{store.items.length} itens / documentos vinculados</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/10">
                <th className="py-2">Tipo</th>
                <th className="py-2">#</th>
                <th className="py-2">Código</th>
                <th className="py-2">Descrição</th>
                <th className="py-2">NCM</th>
                <th className="py-2">CFOP</th>
                <th className="py-2">Qtd</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {store.items.map((i) => (
                <tr key={i.id} className="border-b border-white/5">
                  <td className="py-2">
                    <Badge tone={typeTone(i.documentType)}>{i.documentType}</Badge>
                  </td>
                  <td className="py-2">{i.itemNumber}</td>
                  <td className="py-2">{i.code || "—"}</td>
                  <td className="py-2">
                    <Link
                      href={`/app/batches/${params.id}/documents/${i.documentId}`}
                      className="text-sky-300 hover:underline"
                    >
                      {i.description || "—"}
                    </Link>
                  </td>
                  <td className="py-2">{i.ncm || "—"}</td>
                  <td className="py-2">{i.cfop || "—"}</td>
                  <td className="py-2">
                    {i.quantity ?? "—"} {i.unit || ""}
                  </td>
                  <td className="py-2">{formatCurrency(i.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
