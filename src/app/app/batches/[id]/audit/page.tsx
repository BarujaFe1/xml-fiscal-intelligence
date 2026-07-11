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

const WORKFLOW: { status: FindingStatus; label: string }[] = [
  { status: "open", label: "Aberto" },
  { status: "in_review", label: "Em revisão" },
  { status: "assigned", label: "Atribuído" },
  { status: "resolved", label: "Resolvido" },
  { status: "accepted_risk", label: "Risco aceito" },
  { status: "false_positive", label: "Falso positivo" },
  { status: "ignored_with_reason", label: "Ignorado" },
  { status: "reopened", label: "Reaberto" },
];

export default function BatchAuditPage() {
  const params = useParams<{ id: string }>();
  const { store, setStore } = useBatchStore(params.id);
  const [severity, setSeverity] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const findings = useMemo(() => store?.findings || [], [store?.findings]);
  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (severity !== "all" && f.severity !== severity) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      return true;
    });
  }, [findings, severity, statusFilter]);

  async function setStatus(id: string, status: FindingStatus, note?: string) {
    if (!store) return;
    const next = {
      ...store,
      findings: (store.findings || []).map((f) => {
        if (f.id !== id) return f;
        const from = f.status;
        const history = [
          ...(f.statusHistory || []),
          { at: new Date().toISOString(), from, to: status, note },
        ];
        return {
          ...f,
          status,
          statusHistory: history,
          updatedAt: new Date().toISOString(),
          assignee: status === "assigned" ? f.assignee || "operador_local" : f.assignee,
        };
      }),
    };
    setStore(next);
    const { idbSaveBatchStore } = await import("@/lib/store/idb-store");
    await idbSaveBatchStore(next);
  }

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  const reused = store.reusedDocuments?.length || 0;
  const generations = store.analysisGenerations || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditoria · {store.batch.name}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {findings.length} achados · diagnóstico auxiliar (não é parecer fiscal)
          {reused > 0 ? ` · ${reused} reutilizados no import` : ""}
        </p>
      </div>
      <BatchTabs batchId={store.batch.id} />

      {generations[0] && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Geração de análise</CardTitle>
            <CardDescription>
              {generations[0].id.slice(0, 8)}… · parser {generations[0].parserVersion} · regras{" "}
              {generations[0].ruleSetVersion}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro de severidade">
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
            {s === "all" ? "todas" : s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro de status">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-xl border px-3 py-1.5 text-sm ${
            statusFilter === "all"
              ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
              : "border-white/10 text-slate-400"
          }`}
        >
          todos status
        </button>
        {WORKFLOW.map((w) => (
          <button
            key={w.status}
            type="button"
            onClick={() => setStatusFilter(w.status)}
            className={`rounded-xl border px-3 py-1.5 text-sm ${
              statusFilter === w.status
                ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-slate-400"
            }`}
          >
            {w.label}
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
                {f.ruleSource?.ruleSetVersion && (
                  <span className="text-[10px] text-slate-600">{f.ruleSource.ruleSetVersion}</span>
                )}
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
              {WORKFLOW.filter((w) => w.status !== f.status).slice(0, 6).map((w) => (
                <button
                  key={w.status}
                  type="button"
                  className="text-slate-400 hover:text-slate-200"
                  onClick={() => setStatus(f.id, w.status)}
                >
                  {w.label}
                </button>
              ))}
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
