"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, typeTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { formatCurrency } from "@/lib/utils";
import { useBatchStore } from "@/lib/store/use-batch-store";

export default function ItemsPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Itens
        </h1>
        <p className="text-sm text-slate-400 mt-1">{store.items.length} itens / documentos vinculados</p>
      </div>
      <BatchTabs batchId={params.id} />
      <Card>
        <CardHeader>
          <CardTitle>Tabela de itens</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-950">
              <tr className="text-left text-slate-500 border-b border-white/10">
                <th className="py-2">Tipo</th>
                <th className="py-2">#</th>
                <th className="py-2">Código</th>
                <th className="py-2">Descrição</th>
                <th className="py-2">NCM</th>
                <th className="py-2">CFOP</th>
                <th className="py-2">Qtd</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {store.items.slice(0, 1000).map((i) => (
                <tr key={i.id} className="border-b border-white/5 hover:bg-white/[0.03]">
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
                  <td className="py-2">
                    {i.ncm ? (
                      <Link
                        href={`/app/batches/${params.id}/documents?ncm=${encodeURIComponent(i.ncm)}`}
                        className="hover:text-sky-300"
                      >
                        {i.ncm}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2">
                    {i.cfop ? (
                      <Link
                        href={`/app/batches/${params.id}/documents?cfop=${encodeURIComponent(i.cfop)}`}
                        className="hover:text-sky-300"
                      >
                        {i.cfop}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2">
                    {i.quantity ?? "—"} {i.unit || ""}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(i.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {store.items.length > 1000 && (
            <div className="p-3 text-xs text-slate-500">Mostrando 1000 de {store.items.length}.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
