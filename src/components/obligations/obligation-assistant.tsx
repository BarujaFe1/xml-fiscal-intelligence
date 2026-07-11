"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EfdDiagnosticBanner } from "@/components/feedback/honesty-banners";
import { idbGetBatchStore, idbListBatches } from "@/lib/store/idb-store";
import { OBLIGATION_LABELS, type ObligationId } from "@/modules/obligations";
import type { Batch, BatchStore } from "@/types";

export function ObligationAssistant({ obligationId }: { obligationId: ObligationId }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [store, setStore] = useState<BatchStore | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    content?: string;
    contentHash?: string;
    manifest?: Record<string, unknown>;
    readiness?: { items: Array<{ id: string; label: string; status: string; message?: string }>; canGenerate: boolean };
    validation?: { ok: boolean; issues: Array<{ severity: string; message: string }> };
    warnings?: string[];
    disclaimer?: string;
    recordCount?: number;
  } | null>(null);

  const [form, setForm] = useState({
    cnpj: "11222333000181",
    ie: "123456789012",
    uf: "SP",
    companyName: "EMPRESA DEMO LTDA",
    profile: "A" as "A" | "B" | "C",
    activityCode: "0",
    purpose: "0" as "0" | "1",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-31",
    accountantName: "Contador Demo",
    accountantCpf: "39053344705",
  });

  useEffect(() => {
    idbListBatches().then((list) => {
      setBatches(list);
      if (list[0]) setBatchId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    idbGetBatchStore(batchId).then((s) => {
      if (cancelled) return;
      setStore(s);
      if (s?.batch.cnpjLabel) setForm((f) => ({ ...f, cnpj: s.batch.cnpjLabel || f.cnpj }));
      if (s?.batch.year && s?.batch.month) {
        const m = String(s.batch.month).padStart(2, "0");
        setForm((f) => ({
          ...f,
          periodStart: `${s.batch.year}-${m}-01`,
          periodEnd: `${s.batch.year}-${m}-28`,
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const effectiveStore = batchId ? store : null;
  const docCount = useMemo(() => effectiveStore?.documents.length || 0, [effectiveStore]);
  const needsDocs =
    obligationId === "efd-icms-ipi" ||
    obligationId === "efd-contribuicoes" ||
    obligationId === "reinf";

  async function generate() {
    if (needsDocs && !effectiveStore?.documents.length) {
      toast.error("Selecione um lote com documentos (ou use a Demonstração)");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/obligations/${obligationId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: effectiveStore || {
            batch: {
              id: "empty",
              workspaceId: "ws_local",
              name: "empty",
              uploadedFileName: "",
              status: "completed",
              totalFiles: 0,
              totalXml: 0,
              validXml: 0,
              invalidXml: 0,
              nfeCount: 0,
              cteCount: 0,
              nfseCount: 0,
              unknownCount: 0,
              duplicateCount: 0,
              totalValue: 0,
              healthScore: null,
              progress: 100,
              progressMessage: "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            documents: [],
            items: [],
            fields: [],
            errors: [],
            exports: [],
          },
          establishment: form,
          planId: "trial",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data);
        toast.error(data.error || "Falha na geração");
        return;
      }
      setResult(data);
      toast.success("Arquivo gerado (pré-validação interna)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result?.content) return;
    const blob = new Blob([result.content], {
      type: obligationId === "reinf" ? "application/json" : "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${obligationId}-${(result.contentHash || "out").slice(0, 12)}.${obligationId === "reinf" ? "json" : "txt"}`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Obrigações</p>
        <h1 className="text-2xl font-bold">{OBLIGATION_LABELS[obligationId]}</h1>
      </div>
      <EfdDiagnosticBanner />

      <Card>
        <CardHeader>
          <CardTitle>Estabelecimento e período</CardTitle>
          <CardDescription>Campos obrigatórios para o assistente — não inventamos regime/atividade.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["cnpj", "CNPJ"],
              ["ie", "IE"],
              ["uf", "UF"],
              ["companyName", "Razão social"],
              ["periodStart", "Início"],
              ["periodEnd", "Fim"],
              ["accountantName", "Contador"],
              ["accountantCpf", "CPF contador"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lote IndexedDB</CardTitle>
          <CardDescription>
            {needsDocs
              ? `Documentos no lote: ${docCount}`
              : "ECD/ECF podem gerar esqueleto mesmo sem XML (plano DEMO)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            aria-label="Selecionar lote"
          >
            <option value="">— sem lote —</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.totalXml} XMLs)
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={loading} onClick={() => void generate()}>
              {loading ? "Gerando…" : "Gerar rascunho assistido"}
            </Button>
            {result?.content && (
              <Button type="button" variant="secondary" onClick={download}>
                Baixar arquivo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Resultado
              {result.validation && (
                <Badge tone={result.validation.ok ? "success" : "warning"}>
                  {result.validation.ok ? "ok interno" : "com avisos"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{result.disclaimer}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {result.readiness && (
              <ul className="space-y-1 text-xs text-slate-400">
                {result.readiness.items.map((i) => (
                  <li key={i.id}>
                    <span className="text-slate-200">{i.label}</span>: {i.status}
                    {i.message ? ` — ${i.message}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {result.warnings?.length ? (
              <div className="text-amber-200/90 text-xs space-y-1">
                {result.warnings.map((w) => (
                  <p key={w}>• {w}</p>
                ))}
              </div>
            ) : null}
            {result.content && (
              <pre className="max-h-80 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] font-mono whitespace-pre-wrap">
                {result.content.slice(0, 12000)}
                {result.content.length > 12000 ? "\n…(truncado na UI)" : ""}
              </pre>
            )}
            {result.manifest && (
              <p className="text-[10px] text-slate-500 font-mono">
                hash={String(result.contentHash || "").slice(0, 16)} records={result.recordCount}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
