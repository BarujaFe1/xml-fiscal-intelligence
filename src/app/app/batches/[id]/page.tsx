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
import { Badge, typeTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useBatchStore } from "@/lib/store/use-batch-store";

const tabs = [
  { href: "", label: "Dashboard" },
  { href: "/documents", label: "Documentos" },
  { href: "/items", label: "Itens" },
  { href: "/fields", label: "Campos" },
  { href: "/quality", label: "Quality" },
  { href: "/exports", label: "Exportações" },
];

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

  if (!store) {
    return <div className="skeleton h-64 rounded-2xl" />;
  }

  const { batch, documents } = store;
  const q = batch.quality;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            {batch.name}
          </h1>
          <p className="text-slate-400 mt-1">
            {batch.uploadedFileName} · {formatDateTime(batch.createdAt)}
          </p>
        </div>
        <Badge tone={batch.healthScore >= 80 ? "success" : batch.healthScore >= 60 ? "warning" : "error"}>
          Health Score {batch.healthScore}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={`/app/batches/${batch.id}${t.href}`}
            className={`rounded-xl px-3 py-1.5 text-sm border ${
              t.href === ""
                ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "XMLs", value: batch.totalXml },
          { label: "Válidos", value: batch.validXml },
          { label: "Inválidos", value: batch.invalidXml },
          { label: "Valor total", value: formatCurrency(batch.totalValue) },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <div className="text-sm text-slate-400">{m.label}</div>
              <div className="mt-1 text-2xl font-semibold">{m.value}</div>
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
            <CardTitle>Alertas automáticos</CardTitle>
            <CardDescription>Sinais de qualidade do lote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(q?.warnings || []).length === 0 && (
              <div className="text-sm text-slate-400">Nenhum alerta crítico.</div>
            )}
            {(q?.warnings || []).map((w) => (
              <div
                key={w.code}
                className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm"
              >
                <Badge tone={w.severity === "error" ? "error" : w.severity === "warning" ? "warning" : "info"}>
                  {w.severity}
                </Badge>
                <span className="ml-2 text-slate-300">{w.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top emitentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(q?.metrics.topEmitters || []).slice(0, 5).map((e) => (
              <div key={e.doc} className="flex justify-between text-sm border-b border-white/5 py-2">
                <div>
                  <div className="text-slate-200">{e.name}</div>
                  <div className="text-xs text-slate-500">{e.doc} · {e.count} docs</div>
                </div>
                <div className="text-slate-300">{formatCurrency(e.total)}</div>
              </div>
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
                <div key={x.value} className="flex justify-between py-1">
                  <span>{x.value}</span>
                  <span className="text-slate-500">{x.count}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-2">NCM</div>
              {(q?.metrics.topNcm || []).slice(0, 5).map((x) => (
                <div key={x.value} className="flex justify-between py-1">
                  <span>{x.value}</span>
                  <span className="text-slate-500">{x.count}</span>
                </div>
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
