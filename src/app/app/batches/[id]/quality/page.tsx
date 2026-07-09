"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { alertHref } from "@/lib/analytics";
import { useBatchStore } from "@/lib/store/use-batch-store";

export default function QualityPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;
  const q = store.batch.quality;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Data Quality</p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Fiscal Insights
        </h1>
      </div>
      <BatchTabs batchId={params.id} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1 overflow-hidden">
          <CardContent className="p-6 text-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.15),transparent_60%)]" />
            <div className="relative">
              <div className="text-sm text-slate-400">Health Score</div>
              <div className="mt-2 text-5xl font-bold text-sky-300">{store.batch.healthScore}</div>
              <div className="mt-2 text-xs text-slate-500">0–100 · ver README</div>
            </div>
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
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-sky-400" style={{ width: `${v}%` }} />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alertas acionáveis</CardTitle>
            <CardDescription>Abre a tabela de documentos com o filtro do alerta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(q?.warnings || []).map((w) => (
              <Link
                key={w.code}
                href={alertHref(params.id, w.code)}
                className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm hover:border-sky-400/30 hover:bg-sky-500/5"
              >
                <span>
                  <Badge tone={w.severity === "error" ? "error" : w.severity === "warning" ? "warning" : "info"}>
                    {w.severity}
                  </Badge>{" "}
                  {w.message}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
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
            {!(q?.metrics.topMissingFields || []).length && (
              <div className="text-slate-500 text-sm">
                Campos detalhados indisponíveis neste modo (import client). Use alertas e tabelas principais.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Métricas fiscais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Sem chave", q?.metrics.withoutKey, "NO_KEY"],
              ["Sem protocolo", q?.metrics.withoutProtocol, "NO_PROTOCOL"],
              ["Itens s/ NCM", q?.metrics.itemsWithoutNcm, "NO_NCM"],
              ["Itens s/ CFOP", q?.metrics.itemsWithoutCfop, "NO_CFOP"],
              ["Fora do período", q?.metrics.outsidePeriod, "OUTSIDE_PERIOD"],
              ["Divergência soma", q?.metrics.itemSumDivergences, "ITEM_SUM_DIVERGENCE"],
              ["Outliers valor", q?.metrics.valueOutliers, ""],
              ["CNPJ formato", q?.metrics.invalidCnpjFormat, ""],
            ].map(([label, value, code]) => {
              const inner = (
                <>
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="text-lg font-semibold">{(value as number) ?? 0}</div>
                </>
              );
              return code ? (
                <Link
                  key={String(label)}
                  href={alertHref(params.id, String(code))}
                  className="rounded-xl bg-slate-950/50 border border-white/10 p-3 hover:border-sky-400/30"
                >
                  {inner}
                </Link>
              ) : (
                <div key={String(label)} className="rounded-xl bg-slate-950/50 border border-white/10 p-3">
                  {inner}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
