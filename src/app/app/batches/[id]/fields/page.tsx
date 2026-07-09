"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { useBatchStore } from "@/lib/store/use-batch-store";

export default function FieldsPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);
  const [q, setQ] = useState("");

  const derivedFields = useMemo(() => {
    if (!store) return [];
    if (store.fields.length) return store.fields;
    // Client-import mode may omit fields[]; rebuild from flattenedJson
    return store.documents.flatMap((d) =>
      Object.entries(d.flattenedJson).map(([pathNormalized, value]) => ({
        id: `${d.id}:${pathNormalized}`,
        workspaceId: d.workspaceId,
        batchId: d.batchId,
        documentId: d.id,
        documentType: d.documentType,
        pathOriginal: pathNormalized,
        pathNormalized,
        fieldName: pathNormalized.split(".").pop() || pathNormalized,
        valueText: value === null || value === undefined ? undefined : String(value),
        inferredType:
          value === null || value === ""
            ? ("empty" as const)
            : typeof value === "number"
              ? ("number" as const)
              : typeof value === "boolean"
                ? ("boolean" as const)
                : ("string" as const),
        isEmpty: value === null || value === undefined || value === "",
      })),
    );
  }, [store]);

  const rows = useMemo(() => {
    const filtered = derivedFields.filter((f) => {
      if (!q) return true;
      return (
        f.pathNormalized.toLowerCase().includes(q.toLowerCase()) ||
        (f.valueText || "").toLowerCase().includes(q.toLowerCase())
      );
    });
    return filtered.slice(0, 500);
  }, [derivedFields, q]);

  const uniqueTags = useMemo(() => {
    return new Set(derivedFields.map((f) => f.pathNormalized)).size;
  }, [derivedFields]);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Campos / tags
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {uniqueTags} tags únicas · mostrando {rows.length}
        </p>
      </div>
      <BatchTabs batchId={params.id} />
      <Card>
        <CardHeader>
          <CardTitle>Mapa de campos</CardTitle>
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
