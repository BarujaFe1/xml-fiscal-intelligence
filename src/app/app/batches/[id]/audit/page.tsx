"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBatchStore } from "@/lib/store/use-batch-store";
import type { FindingStatus } from "@/types";

const SEVERITY_TONE: Record<string, "info" | "warning" | "error" | "default"> = {
  info: "info",
  warning: "warning",
  error: "error",
  critical: "error",
};

export default function BatchAuditPage() {
  const params = useParams<{ id: string }>();
  const { store, setStore } = useBatchStore(params.id);
  const [severity, setSeverity] = useState("all");

  const findings = useMemo(() => store?.findings || [], [store?.findings]);
  const filtered = useMemo(() => {
    if (severity === "all") return findings;
    return findings.filter((f) => f.severity === severity);
  }, [findings, severity]);

  async function setStatus(id: string, status: FindingStatus) {
    if (!store) return;
    const next = {
      ...store,
      findings: (store.findings || []).map((f) => (f.id === id ? { ...f, status } : f)),
    };
    setStore(next);
    const { idbSaveBatchStore } = await import("@/lib/store/idb-store");
    await idbSaveBatchStore(next);
  }

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditoria · {store.batch.name}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {findings.length} achados · diagnóstico auxiliar (não é parecer fiscal)
        </p>
      </div>
      <BatchTabs batchId={store.batch.id} />

      <div className="flex flex-wrap gap-2">
        {["all", "critical", "error", "warning", "info"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverity(s)}
            className={`rounded-xl border px-3 py-1.5 text-sm ${
              severity === s
                ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((f) => (
          <Card key={f.id} className="bg-slate-900/40">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={SEVERITY_TONE[f.severity] || "default"}>{f.severity}</Badge>
                <Badge>{f.status}</Badge>
                <span className="text-xs font-mono text-slate-500">{f.code}</span>
              </div>
              <CardTitle className="text-base mt-2">{f.title}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-sm">
              {f.documentId && (
                <Link
                  href={`/app/batches/${store.batch.id}/documents/${f.documentId}`}
                  className="text-sky-300 hover:underline"
                >
                  Documento
                </Link>
              )}
              <button type="button" className="text-slate-400 hover:text-slate-200" onClick={() => setStatus(f.id, "reviewed")}>
                Revisado
              </button>
              <button type="button" className="text-slate-400 hover:text-slate-200" onClick={() => setStatus(f.id, "ignored")}>
                Ignorar
              </button>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-200"
                onClick={() => setStatus(f.id, "false_positive")}
              >
                Falso positivo
              </button>
            </CardContent>
          </Card>
        ))}
        {!filtered.length && (
          <Card>
            <CardContent className="p-6 text-slate-400">Sem achados neste filtro.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
