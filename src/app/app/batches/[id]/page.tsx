"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge, typeTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { alertHref } from "@/lib/analytics";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { evaluationStatusLabel, formatHealthScore } from "@/lib/quality";
import { useBatchStore } from "@/lib/store/use-batch-store";

export default function BatchDashboardPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);

  const typeData = useMemo(() => {
    if (!store) return [];
    return [
      { name: "NF-e", value: store.batch.nfeCount },
      { name: "CT-e", value: store.batch.cteCount },
      { name: "NFS-e", value: store.batch.nfseCount },
      { name: "Outros", value: store.batch.unknownCount },
    ];
  }, [store]);

  const daily = useMemo(() => {
    if (!store) return [];
    const map = new Map<string, { day: string; count: number; value: number }>();
    for (const d of store.documents) {
      if (!d.issueDate) continue;
      const day = d.issueDate.slice(0, 10);
      const cur = map.get(day) || { day, count: 0, value: 0 };
      cur.count += 1;
      cur.value += d.totalValue || 0;
      map.set(day, cur);
    }
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-31);
  }, [store]);

  if (!store) {
    return <div className="skeleton h-64 rounded-2xl" />;
  }

  const { batch, documents } = store;
  const q = batch.quality;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(600px 200px at 10% 0%, rgba(56,189,248,0.18), transparent), radial-gradient(400px 160px at 90% 20%, rgba(52,211,153,0.12), transparent)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs text-sky-300/90 mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Dashboard do lote
            </div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display), sans-serif" }}>
              {batch.name}
            </h1>
            <p className="text-slate-400 mt-1">
              {batch.uploadedFileName} · {formatDateTime(batch.createdAt)}
              {batch.month && batch.year ? ` · ${batch.month}/${batch.year}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              tone={
                batch.healthScore == null
                  ? "info"
                  : batch.healthScore >= 80
                    ? "success"
                    : batch.healthScore >= 60
                      ? "warning"
                      : "error"
              }
            >
              {batch.healthScore == null
                ? evaluationStatusLabel(batch.quality?.evaluationStatus)
                : `Índice de saúde ${formatHealthScore(batch.healthScore)}`}
            </Badge>
            <div className="flex gap-2">
              <Link
                href={`/app/batches/${batch.id}/parties`}
                className="text-xs text-slate-400 hover:text-sky-300"
              >
                Partes
              </Link>
              <Link
                href={`/app/batches/${batch.id}/compare`}
                className="text-xs text-slate-400 hover:text-sky-300"
              >
                Comparar
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BatchTabs batchId={batch.id} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "XMLs", value: batch.totalXml },
          { label: "Válidos", value: batch.validXml },
          { label: "Itens", value: store.items.length },
          { label: "Valor total", value: formatCurrency(batch.totalValue) },
        ].map((m) => (
          <Card key={m.label} className="bg-slate-900/40">
            <CardContent className="p-5">
              <div className="text-sm text-slate-400">{m.label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documentos por tipo</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas acionáveis</CardTitle>
            <CardDescription>Clique para abrir documentos já filtrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(q?.warnings || []).length === 0 && (
              <div className="text-sm text-slate-400">Nenhum alerta crítico.</div>
            )}
            {(q?.warnings || []).map((w) => (
              <Link
                key={w.code}
                href={alertHref(batch.id, w.code)}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm hover:border-sky-400/30 hover:bg-sky-500/5 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Badge tone={w.severity === "error" ? "error" : w.severity === "warning" ? "warning" : "info"}>
                    {w.severity}
                  </Badge>
                  <span className="text-slate-300 truncate">{w.message}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {daily.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Emissões no período</CardTitle>
            <CardDescription>Quantidade de documentos por dia</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickFormatter={(v) => String(v).slice(8)} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
                  formatter={(value) => [String(value ?? ""), "docs"]}
                />
                <Bar dataKey="count" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top emitentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(q?.metrics.topEmitters || []).slice(0, 5).map((e) => (
              <Link
                key={e.doc}
                href={`/app/batches/${batch.id}/documents?emitter=${encodeURIComponent(e.doc)}`}
                className="flex justify-between text-sm border-b border-white/5 py-2 hover:bg-white/[0.03] rounded-lg px-1"
              >
                <div>
                  <div className="text-slate-200">{e.name}</div>
                  <div className="text-xs text-slate-500">{e.doc} · {e.count} docs</div>
                </div>
                <div className="text-slate-300">{formatCurrency(e.total)}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top CFOP / NCM</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-2">CFOP</div>
              {(q?.metrics.topCfop || []).slice(0, 5).map((x) => (
                <Link
                  key={x.value}
                  href={`/app/batches/${batch.id}/documents?cfop=${encodeURIComponent(x.value)}`}
                  className="flex justify-between py-1 hover:text-sky-300"
                >
                  <span>{x.value}</span>
                  <span className="text-slate-500">{x.count}</span>
                </Link>
              ))}
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-2">NCM</div>
              {(q?.metrics.topNcm || []).slice(0, 5).map((x) => (
                <Link
                  key={x.value}
                  href={`/app/batches/${batch.id}/documents?ncm=${encodeURIComponent(x.value)}`}
                  className="flex justify-between py-1 hover:text-sky-300"
                >
                  <span>{x.value}</span>
                  <span className="text-slate-500">{x.count}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentos recentes do lote</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/10">
                <th className="py-2">Tipo</th>
                <th className="py-2">Número</th>
                <th className="py-2">Emitente</th>
                <th className="py-2">Valor</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {documents.slice(0, 12).map((d) => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="py-2">
                    <Badge tone={typeTone(d.documentType)}>{d.documentType}</Badge>
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/app/batches/${batch.id}/documents/${d.id}`}
                      className="text-sky-300 hover:underline"
                    >
                      {d.number || d.accessKey || d.fileName}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-300">{d.emitterName || "—"}</td>
                  <td className="py-2">{formatCurrency(d.totalValue)}</td>
                  <td className="py-2 text-slate-400">{d.parseStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
