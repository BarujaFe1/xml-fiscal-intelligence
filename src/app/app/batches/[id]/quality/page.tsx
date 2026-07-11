"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { evaluationStatusLabel, formatHealthScore } from "@/lib/quality";
import { reprocessAnalysis } from "@/lib/analysis/reprocess";
import { alertHref } from "@/lib/analytics";
import { useBatchStore } from "@/lib/store/use-batch-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function QualityPage() {
  const params = useParams<{ id: string }>();
  const { store, setStore } = useBatchStore(params.id);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;
  const q = store.batch.quality;
  const scoreLabel = formatHealthScore(store.batch.healthScore);
  const statusLabel = evaluationStatusLabel(q?.evaluationStatus);

  async function onReprocess() {
    if (!store) return;
    const next = reprocessAnalysis(store, "Reprocessamento manual na tela de qualidade");
    setStore(next);
    const { idbSaveBatchStore } = await import("@/lib/store/idb-store");
    await idbSaveBatchStore(next);
    toast.success("Análise reprocessada (nova geração imutável)");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Qualidade dos dados</p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Indicadores fiscais do lote
        </h1>
      </div>
      <BatchTabs batchId={params.id} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void onReprocess()}>
          Reprocessar análise (nova geração)
        </Button>
        {(store.reusedDocuments?.length || 0) > 0 && (
          <span className="text-xs text-slate-500 self-center">
            {store.reusedDocuments!.length} documentos reutilizados por hash neste import
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1 overflow-hidden">
          <CardContent className="p-6 text-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.15),transparent_60%)]" />
            <div className="relative">
              <div className="text-sm text-slate-400">Índice de saúde</div>
              <div className="mt-2 text-5xl font-bold text-sky-300">{scoreLabel}</div>
              <div className="mt-2 text-xs text-slate-500">{statusLabel}</div>
              {q?.formulaVersion && (
                <div className="mt-1 text-[10px] text-slate-600">fórmula {q.formulaVersion}</div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Componentes</CardTitle>
            <CardDescription>
              Pesos e status por dimensão — sem amostra = não avaliado (não é 100)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {q &&
              Object.entries(q.dimensions).map(([k, dim]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-500">{k}</div>
                  <div className="text-xl font-semibold">
                    {dim.score == null ? "—" : dim.score}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {dim.status}
                    {dim.denominator > 0 ? ` · ${dim.numerator}/${dim.denominator}` : ""}
                    {q.weights[k] != null ? ` · peso ${Math.round(q.weights[k] * 100)}%` : ""}
                  </div>
                  {dim.score != null && (
                    <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-sky-400" style={{ width: `${dim.score}%` }} />
                    </div>
                  )}
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

      {(store.reusedDocuments?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Documentos reutilizados (incremental)</CardTitle>
            <CardDescription>
              Linhagem local por hash — IDs canônicos só quando o lote anterior existe neste navegador
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Arquivo</th>
                  <th className="py-1 pr-3">Motivo</th>
                  <th className="py-1 pr-3">Doc canônico</th>
                  <th className="py-1">Lote canônico</th>
                </tr>
              </thead>
              <tbody>
                {store.reusedDocuments!.slice(0, 100).map((r, i) => (
                  <tr key={`${r.sourceFileHash}-${i}`} className="border-t border-white/5">
                    <td className="py-1.5 pr-3 font-mono">{r.sourceFileName}</td>
                    <td className="py-1.5 pr-3">{r.reason}</td>
                    <td className="py-1.5 pr-3 font-mono text-slate-400">
                      {r.canonicalDocumentId?.slice(0, 8) || "—"}
                    </td>
                    <td className="py-1.5 font-mono text-slate-400">
                      {r.canonicalBatchId?.slice(0, 8) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(store.reusedDocuments!.length > 100) && (
              <p className="mt-2 text-[10px] text-slate-600">
                Mostrando 100 de {store.reusedDocuments!.length}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
