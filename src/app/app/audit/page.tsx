"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { groupFindingsByCode } from "@/modules/audit/rule-anomaly";
import { getAuditRuleByCode } from "@/modules/audit/rule-catalog";
import { idbListBatches, idbGetBatchStore, idbSaveBatchStore } from "@/lib/store/idb-store";
import type { AuditFinding, Batch, FindingStatus } from "@/types";
import { toast } from "sonner";

const SEVERITY_TONE: Record<string, "info" | "warning" | "error" | "default"> = {
  info: "info",
  warning: "warning",
  error: "error",
  critical: "error",
};

const STATUS_OPTIONS: FindingStatus[] = [
  "open",
  "in_review",
  "resolved",
  "ignored",
  "false_positive",
  "reopened",
];

export default function AuditPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [findings, setFindings] = useState<Array<AuditFinding & { batchName?: string }>>([]);
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [grouped, setGrouped] = useState(true);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const list = await idbListBatches();
    setBatches(list);
    const all: Array<AuditFinding & { batchName?: string }> = [];
    for (const b of list.slice(0, 20)) {
      const store = await idbGetBatchStore(b.id);
      for (const f of store?.findings || []) {
        all.push({ ...f, batchName: b.name });
      }
    }
    setFindings(all);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        if (cancelled) return;
        await reload();
      })();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (severity !== "all" && f.severity !== severity) return false;
      if (status !== "all" && f.status !== status) return false;
      return true;
    });
  }, [findings, severity, status]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) c[f.severity] = (c[f.severity] || 0) + 1;
    return c;
  }, [findings]);

  const groups = useMemo(() => groupFindingsByCode(filtered), [filtered]);

  async function setFindingStatus(finding: AuditFinding, next: FindingStatus) {
    const store = await idbGetBatchStore(finding.batchId);
    if (!store?.findings) return;
    store.findings = store.findings.map((f) =>
      f.id === finding.id ? { ...f, status: next } : f,
    );
    await idbSaveBatchStore(store);
    toast.success(`Status → ${next}`);
    await reload();
  }

  if (loading) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Auditoria fiscal
        </h1>
        <p className="text-slate-400 mt-1">
          Achados versionados do import — diagnóstico auxiliar, não parecer fiscal. Agrupamento evita
          milhares de cards idênticos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
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
            {s === "all" ? `Todos (${findings.length})` : `${s} (${counts[s] || 0})`}
          </button>
        ))}
        <select
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-sm text-slate-300"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por status"
        >
          <option value="all">Status: todos</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400 ml-auto">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
          Agrupar por regra
        </label>
      </div>

      {!batches.length ? (
        <Card>
          <CardContent className="p-6 text-slate-400">
            Nenhum lote no IndexedDB.{" "}
            <Link href="/app/upload" className="text-sky-300 hover:underline">
              Importe um ZIP
            </Link>
            .
          </CardContent>
        </Card>
      ) : grouped ? (
        <div className="space-y-3">
          {[...groups.values()].map((g) => {
            const rule = getAuditRuleByCode(g.code);
            return (
              <Card key={g.code} className="bg-slate-900/40">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SEVERITY_TONE[g.severity] || "default"}>{g.severity}</Badge>
                    <span className="text-xs font-mono text-slate-500">{g.code}</span>
                    <Badge>{g.count} documento(s)</Badge>
                    {rule && (
                      <Badge tone="info">
                        {rule.nature} · v{rule.version}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{g.title}</CardTitle>
                  <CardDescription>
                    {rule?.requiresReview ? "Exige revisão humana. " : ""}
                    Amostra: {g.sampleIds.join(", ") || "—"}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
          {!groups.size && (
            <p className="text-slate-400 text-sm">Nenhum achado com os filtros atuais.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 200).map((f) => (
            <Card key={f.id} className="bg-slate-900/40">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={SEVERITY_TONE[f.severity] || "default"}>{f.severity}</Badge>
                  <Badge>{f.status}</Badge>
                  <span className="text-xs text-slate-500 font-mono">{f.code}</span>
                </div>
                <CardTitle className="text-base mt-2">{f.title}</CardTitle>
                <CardDescription>
                  {f.batchName} · {f.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:bg-white/5"
                    onClick={() => void setFindingStatus(f, s)}
                  >
                    {s}
                  </button>
                ))}
                <Link
                  href={`/app/batches/${f.batchId}/audit`}
                  className="text-xs text-sky-300 self-center ml-auto"
                >
                  Abrir lote
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
