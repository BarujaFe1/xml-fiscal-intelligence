"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { idbGetBatchStore, idbListBatches } from "@/lib/store/idb-store";
import type { DocumentRelationship } from "@/types";

export default function RelationshipsPage() {
  const [rows, setRows] = useState<
    Array<DocumentRelationship & { batchName?: string; batchId: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const batches = await idbListBatches();
      const all: Array<DocumentRelationship & { batchName?: string; batchId: string }> = [];
      for (const b of batches.slice(0, 20)) {
        const store = await idbGetBatchStore(b.id);
        for (const r of store?.relationships || []) {
          all.push({ ...r, batchName: b.name, batchId: b.id });
        }
      }
      setRows(all);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Relacionamentos
        </h1>
        <p className="text-slate-400 mt-1">
          Vínculos inferidos (NF-e ↔ CT-e, duplicatas, devoluções heurísticas).
        </p>
      </div>

      {!rows.length ? (
        <Card>
          <CardContent className="p-6 text-slate-400">
            Nenhum vínculo ainda. Importe um lote com NF-e e CT-e vinculados.{" "}
            <Link href="/app/upload" className="text-sky-300 hover:underline">
              Upload
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 300).map((r) => (
            <Card key={r.id} className="bg-slate-900/40">
              <CardHeader className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{r.relationshipType}</Badge>
                  <span className="text-xs text-slate-500">
                    confiança {(r.confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
                <CardTitle className="text-sm font-mono mt-1">
                  {r.sourceDocumentId.slice(0, 8)} → {r.targetDocumentId.slice(0, 8)}
                </CardTitle>
                <CardDescription>
                  {r.batchName} ·{" "}
                  <Link href={`/app/batches/${r.batchId}/relationships`} className="text-sky-300">
                    ver lote
                  </Link>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
