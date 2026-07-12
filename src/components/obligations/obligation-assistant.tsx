"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EfdDiagnosticBanner } from "@/components/feedback/honesty-banners";
import { idbGetBatchStore, idbListBatches } from "@/lib/store/idb-store";
import {
  DEMO_BATCH_ID,
  DEMO_ESTABLISHMENT,
  fetchObligationDemo,
  OBLIGATION_LABELS,
  type ObligationId,
  suggestInformantFromDocuments,
} from "@/modules/obligations";
import { periodBoundsFromYearMonth } from "@/modules/obligations/period";
import type { Batch, BatchStore } from "@/types";

const emptyForm = {
  cnpj: "",
  ie: "",
  uf: "SP",
  companyName: "",
  profile: "A" as "A" | "B" | "C",
  activityCode: "1",
  purpose: "0" as "0" | "1",
  periodStart: "2026-03-01",
  periodEnd: "2026-03-31",
  codMun: "",
  tradeName: "",
  cep: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  accountantName: "",
  accountantCpf: "",
};

export function ObligationAssistant({ obligationId }: { obligationId: ObligationId }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [store, setStore] = useState<BatchStore | null>(null);
  const [demoStore, setDemoStore] = useState<BatchStore | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
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

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    idbListBatches().then((list) => {
      setBatches(list);
      if (list[0]) setBatchId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!batchId || batchId === DEMO_BATCH_ID) return;
    let cancelled = false;
    idbGetBatchStore(batchId).then((s) => {
      if (cancelled) return;
      setStore(s);
      setDemoStore(null);
      if (s?.batch.cnpjLabel) setForm((f) => ({ ...f, cnpj: s.batch.cnpjLabel || f.cnpj }));
      if (s?.batch.year && s?.batch.month) {
        const bounds = periodBoundsFromYearMonth(s.batch.year, s.batch.month);
        setForm((f) => ({
          ...f,
          periodStart: bounds.periodStart,
          periodEnd: bounds.periodEnd,
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const usingDemo = batchId === DEMO_BATCH_ID && !!demoStore;
  const effectiveStore = usingDemo ? demoStore : batchId ? store : null;
  const docCount = useMemo(() => effectiveStore?.documents.length || 0, [effectiveStore]);
  const informantHint = useMemo(
    () => (effectiveStore ? suggestInformantFromDocuments(effectiveStore.documents) : null),
    [effectiveStore],
  );
  const needsDocs =
    obligationId === "efd-icms-ipi" ||
    obligationId === "efd-contribuicoes" ||
    obligationId === "reinf";

  function applyInformantFromBatch() {
    if (!informantHint) {
      toast.error("Nenhum emitente detectado no lote");
      return;
    }
    setForm((f) => ({
      ...f,
      cnpj: informantHint.cnpj,
      uf: informantHint.uf || f.uf,
      companyName: informantHint.name || f.companyName,
      ie: informantHint.ie || f.ie,
      codMun: informantHint.codMun || f.codMun,
      address: informantHint.address || f.address,
      addressNumber: informantHint.addressNumber || f.addressNumber,
      neighborhood: informantHint.neighborhood || f.neighborhood,
      cep: informantHint.cep || f.cep,
    }));
    toast.success(`Emitente do lote aplicado (${informantHint.count} NF-e)`);
  }

  async function fillDemo() {
    setDemoBusy(true);
    setResult(null);
    try {
      const data = await fetchObligationDemo();
      setForm({
        ...DEMO_ESTABLISHMENT,
        ie: DEMO_ESTABLISHMENT.ie || "",
        codMun: DEMO_ESTABLISHMENT.codMun || "",
        tradeName: DEMO_ESTABLISHMENT.tradeName || "",
        cep: DEMO_ESTABLISHMENT.cep || "",
        address: DEMO_ESTABLISHMENT.address || "",
        addressNumber: DEMO_ESTABLISHMENT.addressNumber || "",
        neighborhood: DEMO_ESTABLISHMENT.neighborhood || "",
        accountantName: DEMO_ESTABLISHMENT.accountantName || "",
        accountantCpf: DEMO_ESTABLISHMENT.accountantCpf || "",
      });
      setDemoStore(data.store);
      setBatchId(DEMO_BATCH_ID);
      toast.success(
        `Demo preenchida (${data.sample.fileName} · ${data.sample.itemCount} item(ns)) — clique em Gerar`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no demo");
    } finally {
      setDemoBusy(false);
    }
  }

  async function generate() {
    if (needsDocs && !effectiveStore?.documents.length) {
      toast.error("Selecione um lote ou clique em Preencher demo");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { generateObligationLocal } = await import("@/modules/obligations/generate-local");
      const data = await generateObligationLocal({
        obligationId,
        store: effectiveStore,
        establishment: form,
      });
      setResult(data);
      if (data.error && !data.content) {
        toast.error(data.error);
        return;
      }
      toast.success(
        `Arquivo gerado no navegador (${data.recordCount ?? 0} registros · pré-validação interna)`,
      );
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Obrigações</p>
          <h1 className="text-2xl font-bold">{OBLIGATION_LABELS[obligationId]}</h1>
        </div>
        <Button type="button" variant="secondary" disabled={demoBusy} onClick={() => void fillDemo()}>
          {demoBusy ? "Carregando demo…" : "Preencher demo"}
        </Button>
      </div>
      <EfdDiagnosticBanner />
      {usingDemo && (
        <p className="text-xs text-amber-200/90 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          Modo demonstração: formulário + NF-e de exemplo anonimizada. Não use o arquivo gerado como
          obrigação oficial.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Estabelecimento e período</CardTitle>
          <CardDescription>
            Preencha manualmente ou use <strong>Preencher demo</strong> com dados de exemplo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {informantHint && obligationId === "efd-icms-ipi" ? (
            <div className="sm:col-span-2">
              <Button type="button" variant="secondary" onClick={applyInformantFromBatch}>
                Usar emitente do lote ({informantHint.cnpj})
              </Button>
            </div>
          ) : null}
          {(
            [
              ["cnpj", "CNPJ"],
              ["ie", "IE"],
              ["uf", "UF"],
              ["companyName", "Razão social"],
              ["codMun", "COD_MUN (IBGE)"],
              ["cep", "CEP"],
              ["address", "Endereço"],
              ["addressNumber", "Número"],
              ["neighborhood", "Bairro"],
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
              ? `Documentos no lote: ${docCount}${usingDemo ? " (demo)" : ""}`
              : "ECD/ECF podem gerar esqueleto mesmo sem XML (plano DEMO)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            value={batchId}
            onChange={(e) => {
              const v = e.target.value;
              setBatchId(v);
              if (v !== DEMO_BATCH_ID) setDemoStore(null);
            }}
            aria-label="Selecionar lote"
          >
            <option value="">— sem lote —</option>
            {usingDemo && (
              <option value={DEMO_BATCH_ID}>Demo · NF-e exemplo</option>
            )}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.totalXml} XMLs)
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={demoBusy} onClick={() => void fillDemo()}>
              {demoBusy ? "Carregando…" : "Preencher demo"}
            </Button>
            <Button type="button" disabled={loading} onClick={() => void generate()}>
              {loading ? "Gerando no navegador…" : "Gerar rascunho assistido"}
            </Button>
            {result?.content && (
              <Button type="button" variant="outline" onClick={download}>
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
