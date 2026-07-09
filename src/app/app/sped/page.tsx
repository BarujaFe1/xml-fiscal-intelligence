"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildSpedPreviewTree, type SpedNode } from "@/modules/sped/preview";
import { idbGetBatchStore, idbListBatches } from "@/lib/store/idb-store";
import type { Batch } from "@/types";

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

export default function SpedPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [stats, setStats] = useState({ hasNfe: false, hasItems: false, hasCfop: false, hasNcm: false });

  useEffect(() => {
    (async () => {
      const list = await idbListBatches();
      setBatches(list);
      if (list[0]) setSelected(list[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const store = await idbGetBatchStore(selected);
      if (!store) return;
      setStats({
        hasNfe: store.documents.some((d) => d.documentType === "NFE" || d.documentType === "NFCE"),
        hasItems: store.items.length > 0,
        hasCfop: store.items.some((i) => !!i.cfop) || store.documents.some((d) => !!d.cfopMain),
        hasNcm: store.items.some((i) => !!i.ncm),
      });
    })();
  }, [selected]);

  const tree = useMemo(
    () =>
      buildSpedPreviewTree({
        ...stats,
        companyConfigured: !!batches.find((b) => b.id === selected)?.cnpjLabel,
      }),
    [stats, batches, selected],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          SPED Fiscal — preview
        </h1>
        <p className="text-amber-200/80 text-sm mt-2 border border-amber-500/20 rounded-xl px-3 py-2 bg-amber-500/5 max-w-3xl">
          Simulação e diagnóstico de lineage XML → registros. <strong>Não substitui</strong> o PVA/SPED
          oficial nem gera escrituração completa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lote de referência</CardTitle>
          <CardDescription>Escolha um lote IndexedDB para montar a árvore.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!batches.length ? (
            <p className="text-slate-400">
              Sem lotes. <Link href="/app/upload" className="text-sky-300">Importe um ZIP</Link>.
            </p>
          ) : (
            <select
              className="w-full max-w-md rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {selected && (
            <Link href={`/app/batches/${selected}/sped`} className="text-sm text-sky-300 hover:underline">
              Abrir SPED do lote →
            </Link>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/40">
        <CardHeader>
          <CardTitle>Árvore SPED (diagnóstico)</CardTitle>
        </CardHeader>
        <CardContent>
          <SpedTree node={tree} />
        </CardContent>
      </Card>
    </div>
  );
}
