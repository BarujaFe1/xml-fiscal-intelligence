"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { idbListBatches, idbGetBatchStore } from "@/lib/store/idb-store";
import type { AuditFinding, Batch } from "@/types";

const SEVERITY_TONE: Record<string, "info" | "warning" | "error" | "default"> = {
  info: "info",
  warning: "warning",
  error: "error",
  critical: "error",
};

export default function AuditPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [findings, setFindings] = useState<Array<AuditFinding & { batchName?: string }>>([]);
  const [severity, setSeverity] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  const filtered = useMemo(() => {
    if (severity === "all") return findings;
    return findings.filter((f) => f.severity === severity);
  }, [findings, severity]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) c[f.severity] = (c[f.severity] || 0) + 1;
    return c;
  }, [findings]);

  if (loading) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Auditoria fiscal
        </h1>
        <p className="text-slate-400 mt-1">
          Achados gerados no import — diagnóstico auxiliar, não parecer fiscal.
        </p>
      </div>

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
            {s === "all" ? `Todos (${findings.length})` : `${s} (${counts[s] || 0})`}
          </button>
        ))}
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
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 200).map((f) => (
            <Card key={f.id} className="bg-slate-900/40">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={SEVERITY_TONE[f.severity] || "default"}>{f.severity}</Badge>
                  <Badge>{f.category}</Badge>
                  <span className="text-xs text-slate-500 font-mono">{f.code}</span>
                </div>
                <CardTitle className="text-base mt-2">{f.title}</CardTitle>
                <CardDescription>{f.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 space-y-1">
                {f.recommendation && <p className="text-slate-300">{f.recommendation}</p>}
                <div className="flex flex-wrap gap-3 text-xs">
                  {f.batchName && <span>Lote: {f.batchName}</span>}
                  {f.documentId && f.batchId && (
                    <Link
                      href={`/app/batches/${f.batchId}/documents/${f.documentId}`}
                      className="text-sky-300 hover:underline"
                    >
                      Abrir documento
                    </Link>
                  )}
                  {f.batchId && (
                    <Link href={`/app/batches/${f.batchId}/audit`} className="text-sky-300/80 hover:underline">
                      Auditoria do lote
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {!filtered.length && (
            <Card>
              <CardContent className="p-6 text-slate-400">
                Nenhum achado com este filtro. Reimporte um lote para regenerar a auditoria.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
