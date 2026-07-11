"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBatchStore } from "@/lib/store/use-batch-store";
import { explainConfidence } from "@/modules/reconciliation";

export default function BatchRelationshipsPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);
  const rels = store?.relationships || [];

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relacionamentos · {store.batch.name}</h1>
        <p className="text-slate-400 text-sm mt-1">{rels.length} vínculos inferidos</p>
      </div>
      <BatchTabs batchId={store.batch.id} />

      <div className="space-y-2">
        {rels.map((r) => {
          const source = store.documents.find((d) => d.id === r.sourceDocumentId);
          const target = store.documents.find((d) => d.id === r.targetDocumentId);
          return (
            <Card key={r.id} className="bg-slate-900/40">
              <CardHeader className="py-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge>{r.relationshipType}</Badge>
                  <span className="text-xs text-slate-500">
                    {(r.confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
                <CardTitle className="text-sm mt-2">
                  {source?.documentType} {source?.number || source?.fileName} →{" "}
                  {target?.documentType} {target?.number || target?.fileName}
                </CardTitle>
                <CardDescription className="flex gap-3">
                  {source && (
                    <Link
                      href={`/app/batches/${store.batch.id}/documents/${source.id}`}
                      className="text-sky-300 hover:underline"
                    >
                      origem
                    </Link>
                  )}
                  {target && (
                    <Link
                      href={`/app/batches/${store.batch.id}/documents/${target.id}`}
                      className="text-sky-300 hover:underline"
                    >
                      destino
                    </Link>
                  )}
                </CardDescription>
              </CardHeader>
              {r.evidence && (
                <CardContent className="text-xs text-slate-400 space-y-1">
                  <p className="font-medium text-slate-300">Cálculo da confiança</p>
                  <ul className="list-disc pl-4">
                    {explainConfidence(r.evidence).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          );
        })}
        {!rels.length && (
          <Card>
            <CardContent className="p-6 text-slate-400">Nenhum vínculo neste lote.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
