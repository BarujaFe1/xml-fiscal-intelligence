"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FolderOpen, Upload, Activity, FileStack } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Batch } from "@/types";

export default function AppHomePage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/batches")
      .then((r) => r.json())
      .then((d) => setBatches(d.batches || []))
      .finally(() => setLoading(false));
  }, []);

  const totalDocs = batches.reduce((a, b) => a + b.validXml, 0);
  const totalValue = batches.reduce((a, b) => a + b.totalValue, 0);
  const avgScore = batches.length
    ? Math.round(batches.reduce((a, b) => a + b.healthScore, 0) / batches.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Visão geral
        </h1>
        <p className="text-slate-400 mt-1">Laboratório de análise de lotes XML fiscais.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Lotes", value: batches.length, icon: FolderOpen },
          { label: "Documentos válidos", value: totalDocs, icon: FileStack },
          { label: "Valor consolidado", value: formatCurrency(totalValue), icon: Activity },
          { label: "Score médio", value: avgScore || "—", icon: Activity },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 text-sm">
                {m.label}
                <m.icon className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-50">{loading ? "…" : m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lotes recentes</CardTitle>
            <CardDescription>Abra um lote para dashboard, busca e exportações.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!loading && batches.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-slate-400">
                Nenhum lote ainda. Envie um ZIP para começar.
                <div className="mt-4">
                  <Link href="/app/upload" className="text-sky-300 hover:underline">
                    Ir para upload
                  </Link>
                </div>
              </div>
            )}
            {batches.slice(0, 8).map((b) => (
              <Link
                key={b.id}
                href={`/app/batches/${b.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 hover:bg-white/5"
              >
                <div>
                  <div className="font-medium text-slate-100">{b.name}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(b.createdAt)} · {b.validXml} XMLs · score {b.healthScore}
                  </div>
                </div>
                <Badge tone={b.status === "completed" ? "success" : b.status === "failed" ? "error" : "warning"}>
                  {b.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/app/upload"
              className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sky-100"
            >
              <Upload className="h-4 w-4" /> Upload de ZIP
            </Link>
            <Link
              href="/app/search"
              className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-slate-200 hover:bg-white/5"
            >
              Busca global
            </Link>
            <Link
              href="/app/batches"
              className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-slate-200 hover:bg-white/5"
            >
              Histórico de lotes
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
