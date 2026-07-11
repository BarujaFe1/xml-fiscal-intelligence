"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { idbGetBatchStore, idbListBatches } from "@/lib/store/idb-store";
import type { Batch, BatchStore } from "@/types";

export default function ObligationsEfdPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [store, setStore] = useState<BatchStore | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    content?: string;
    manifest?: Record<string, unknown>;
    readiness?: { items: Array<{ id: string; label: string; status: string; message?: string }>; canGenerate: boolean };
    validation?: { ok: boolean; issues: Array<{ severity: string; message: string }> };
    disclaimer?: string;
  } | null>(null);

  const [form, setForm] = useState({
    cnpj: "",
    ie: "",
    uf: "SP",
    companyName: "",
    profile: "A" as "A" | "B" | "C",
    activityCode: "0",
    purpose: "0" as "0" | "1",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-31",
    accountantName: "",
    accountantCpf: "",
  });

  useEffect(() => {
    idbListBatches().then((list) => {
      setBatches(list);
      if (list[0]) setBatchId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!batchId) return;
    idbGetBatchStore(batchId).then((s) => {
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
  }, [batchId]);

  const docCount = useMemo(() => store?.documents.length || 0, [store]);

  async function generate() {
    if (!store) {
      toast.error("Selecione um lote");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/obligations/efd-icms-ipi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store, establishment: form, planId: "trial" }),
      });
      const data = await res.json();
      setResult(data);
      if (!res.ok) {
        toast.error(data.error || "Geração bloqueada");
        return;
      }
      toast.success("TXT gerado (pré-validação interna)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  function downloadTxt() {
    if (!result?.content) return;
    const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `efd-icms-ipi-${(result.manifest as { contentHash?: string })?.contentHash?.slice(0, 12) || "draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          EFD ICMS/IPI — geração assistida
        </h1>
        <p className="text-amber-200/80 text-sm mt-2 border border-amber-500/20 rounded-xl px-3 py-2 bg-amber-500/5">
          Arquivo para <strong>pré-validação interna</strong> e importação no <strong>PVA oficial</strong>. Não
          substitui PVA, assinatura, transmissão nem consultoria fiscal. E110/H/K/G fora do MVP.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Lote de documentos</CardTitle>
          <CardDescription>{docCount} documentos no lote selecionado (IndexedDB).</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            className="w-full max-w-md rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          >
            {!batches.length && <option value="">Nenhum lote — importe um ZIP</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Estabelecimento e período</CardTitle>
          <CardDescription>Campos obrigatórios — nada é presumido (perfil/atividade/finalidade).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["companyName", "Razão social"],
              ["cnpj", "CNPJ"],
              ["ie", "IE"],
              ["uf", "UF"],
              ["periodStart", "Período início (YYYY-MM-DD)"],
              ["periodEnd", "Período fim"],
              ["accountantName", "Contabilista (opcional)"],
              ["accountantCpf", "CPF contabilista"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label>Perfil</Label>
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={form.profile}
              onChange={(e) => setForm({ ...form, profile: e.target.value as "A" | "B" | "C" })}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>IND_ATIV</Label>
            <Input
              value={form.activityCode}
              onChange={(e) => setForm({ ...form, activityCode: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Finalidade (0 original / 1 substituto)</Label>
            <Input
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value as "0" | "1" })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={generate} disabled={loading || !store}>
          {loading ? "Gerando…" : "Verificar prontidão e gerar TXT"}
        </Button>
        {result?.content && (
          <Button type="button" variant="secondary" onClick={downloadTxt}>
            Baixar TXT
          </Button>
        )}
      </div>

      {result?.readiness && (
        <Card>
          <CardHeader>
            <CardTitle>Prontidão</CardTitle>
            <CardDescription>
              {result.readiness.canGenerate ? "Sem bloqueios estruturais" : "Geração bloqueada"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.readiness.items.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  tone={
                    i.status === "blocking"
                      ? "error"
                      : i.status === "complete"
                        ? "success"
                        : "warning"
                  }
                >
                  {i.status}
                </Badge>
                <span>{i.label}</span>
                {i.message && <span className="text-slate-500">{i.message}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {result?.validation && (
        <Card>
          <CardHeader>
            <CardTitle>Validação interna (nível 1)</CardTitle>
            <CardDescription>Não é validação do PVA oficial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {result.validation.issues.slice(0, 30).map((iss, idx) => (
              <div key={idx} className="text-slate-300">
                [{iss.severity}] {iss.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {result?.manifest && (
        <Card>
          <CardHeader>
            <CardTitle>Manifesto</CardTitle>
            <CardDescription>{result.disclaimer}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto max-h-64 rounded-xl bg-black/40 p-3">
              {JSON.stringify(result.manifest, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
