"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBatchStore } from "@/lib/store/use-batch-store";
import { buildSpedPreviewTree, type SpedNode } from "@/modules/sped/preview";

function SpedTree({ node, depth = 0 }: { node: SpedNode; depth?: number }) {
  const tone =
    node.status === "ok"
      ? "success"
      : node.status === "missing"
        ? "error"
        : node.status === "warning"
          ? "warning"
          : node.status === "derived"
            ? "info"
            : "default";
  return (
    <div className={depth ? "ml-4 border-l border-white/10 pl-3 mt-2" : ""}>
      <div className="flex flex-wrap items-center gap-2 py-1">
        <Badge tone={tone}>{node.status}</Badge>
        <span className="text-sm text-slate-200">{node.label}</span>
        {node.xmlPath && <span className="text-xs font-mono text-slate-500">{node.xmlPath}</span>}
      </div>
      {node.notes && <p className="text-xs text-slate-500 mb-1">{node.notes}</p>}
      {node.children?.map((c) => (
        <SpedTree key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function BatchSpedPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);

  const tree = useMemo(() => {
    if (!store) return null;
    return buildSpedPreviewTree({
      hasNfe: store.documents.some((d) => d.documentType === "NFE" || d.documentType === "NFCE"),
      hasItems: store.items.length > 0,
      hasCfop: store.items.some((i) => !!i.cfop) || store.documents.some((d) => !!d.cfopMain),
      hasNcm: store.items.some((i) => !!i.ncm),
      companyConfigured: !!store.batch.cnpjLabel,
    });
  }, [store]);

  if (!store || !tree) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SPED preview · {store.batch.name}</h1>
        <p className="text-amber-200/70 text-sm mt-1">
          Diagnóstico/simulação — não é escrituração oficial nem substitui o PVA.
        </p>
      </div>
      <BatchTabs batchId={store.batch.id} />
      <Card className="bg-slate-900/40">
        <CardHeader>
          <CardTitle>Árvore e lineage</CardTitle>
        </CardHeader>
        <CardContent>
          <SpedTree node={tree} />
        </CardContent>
      </Card>
    </div>
  );
}
