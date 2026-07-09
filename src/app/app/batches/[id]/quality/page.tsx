"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBatchStore } from "@/lib/store/use-batch-store";

export default function QualityPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;
  const q = store.batch.quality;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Data Quality & Fiscal Insights</h1>
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
              href === "/quality"
                ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardContent className="p-6 text-center">
            <div className="text-sm text-slate-400">Health Score</div>
            <div className="mt-2 text-5xl font-bold text-sky-300">{store.batch.healthScore}</div>
            <div className="mt-2 text-xs text-slate-500">0–100 · ver README</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
            <CardDescription>Componentes ponderados do score</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {q &&
              Object.entries(q.breakdown).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-500">{k}</div>
                  <div className="text-xl font-semibold">{v}</div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(q?.warnings || []).map((w) => (
              <div key={w.code} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                <Badge tone={w.severity === "error" ? "error" : w.severity === "warning" ? "warning" : "info"}>
                  {w.severity}
                </Badge>{" "}
                {w.message}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recomendações</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-slate-300 space-y-2">
              {(q?.recommendations || []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campos mais ausentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(q?.metrics.topMissingFields || []).map((f) => (
              <div key={f.path} className="flex justify-between border-b border-white/5 py-1">
                <span className="font-mono text-xs text-slate-400 truncate mr-3">{f.path}</span>
                <span>{f.missingPct}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Métricas fiscais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Sem chave", q?.metrics.withoutKey],
              ["Sem protocolo", q?.metrics.withoutProtocol],
              ["Itens s/ NCM", q?.metrics.itemsWithoutNcm],
              ["Itens s/ CFOP", q?.metrics.itemsWithoutCfop],
              ["Fora do período", q?.metrics.outsidePeriod],
              ["Divergência soma", q?.metrics.itemSumDivergences],
              ["Outliers valor", q?.metrics.valueOutliers],
              ["CNPJ formato", q?.metrics.invalidCnpjFormat],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-950/50 border border-white/10 p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="text-lg font-semibold">{value ?? 0}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
