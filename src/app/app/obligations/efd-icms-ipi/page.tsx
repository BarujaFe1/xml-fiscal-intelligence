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
  buildComplementaryCsv,
  parseComplementaryCsv,
  validateComplementaryPreview,
  type ComplementaryKind,
} from "@/modules/obligations/efd-icms-ipi/complementary";
import type { Batch, BatchStore } from "@/types";

export default function ObligationsEfdPage() {
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
    lineageSample?: Array<Record<string, unknown>>;
    disclaimer?: string;
  } | null>(null);

  const [pvaVersion, setPvaVersion] = useState("");
  const [pvaReport, setPvaReport] = useState("");
  const [pvaBusy, setPvaBusy] = useState(false);
  const [pvaRecord, setPvaRecord] = useState<Record<string, unknown> | null>(null);
  const [compKind, setCompKind] = useState<ComplementaryKind>("accountant");
  const [compPreview, setCompPreview] = useState("");
  const [compMsg, setCompMsg] = useState("");

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

  async function registerPva() {
    const generationId =
      (result?.manifest as { contentHash?: string } | undefined)?.contentHash ||
      result?.contentHash ||
      `local-${batchId || "draft"}`;
    if (!pvaVersion.trim()) {
      toast.error("Informe a versão do PVA");
      return;
    }
    setPvaBusy(true);
    try {
      const res = await fetch("/api/obligations/efd-icms-ipi/pva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          contentHash: result?.contentHash,
          pvaVersion: pvaVersion.trim(),
          reportText: pvaReport,
          notes: "Registro manual assistido",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Falha ao registrar PVA");
        return;
      }
      setPvaRecord(data.record);
      try {
        const { saveLocalPvaRun } = await import("@/modules/obligations/efd-icms-ipi/pva/workflow");
        saveLocalPvaRun(data.record);
      } catch {
        // ignore
      }
      toast.success("Resultado do PVA registrado (nível 3 — informado pelo usuário)");
    } finally {
      setPvaBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          EFD ICMS/IPI — prontidão e geração assistida
        </h1>
        <EfdDiagnosticBanner className="mt-3" />
        <p className="text-slate-400 text-sm mt-2">
          Níveis: (1) estrutural interno · (2) relacional/fiscal interno · (3) PVA oficial — só após
          registro de resultado real. E110/H/K/G fora do escopo atual.
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

      {result?.lineageSample && result.lineageSample.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Origem dos campos (amostra)</CardTitle>
            <CardDescription>
              Linhagem determinística — primeiros {result.lineageSample.length} campos gerados.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto max-h-72">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-2">Registro</th>
                  <th className="py-1 pr-2">Campo</th>
                  <th className="py-1 pr-2">Valor</th>
                  <th className="py-1 pr-2">Origem</th>
                </tr>
              </thead>
              <tbody>
                {result.lineageSample.map((row, idx) => (
                  <tr key={idx} className="border-t border-white/5 text-slate-300">
                    <td className="py-1 pr-2 font-mono">{String(row.record ?? "")}</td>
                    <td className="py-1 pr-2 font-mono">{String(row.field ?? "")}</td>
                    <td className="py-1 pr-2 max-w-[12rem] truncate">{String(row.value ?? "")}</td>
                    <td className="py-1 pr-2">
                      {String(row.sourceType ?? "")}
                      {row.transformation ? ` · ${String(row.transformation)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados complementares (CSV)</CardTitle>
          <CardDescription>
            Templates para contabilista, saldo anterior, ajustes e inventário. Valores nunca são
            inventados a partir do XML.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                value={compKind}
                onChange={(e) => setCompKind(e.target.value as ComplementaryKind)}
              >
                <option value="accountant">Contabilista</option>
                <option value="opening_balance">Saldo anterior</option>
                <option value="adjustments">Ajustes</option>
                <option value="inventory">Inventário</option>
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const csv = buildComplementaryCsv(compKind);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `efd-complementar-${compKind}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Baixar template
            </Button>
          </div>
          <textarea
            className="min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-mono"
            placeholder="Cole CSV com cabeçalho separado por ;"
            value={compPreview}
            onChange={(e) => setCompPreview(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const parsed = parseComplementaryCsv(compPreview);
              const v = validateComplementaryPreview(compKind, parsed.headers);
              setCompMsg(
                v.ok
                  ? `${v.messages[0]} · ${parsed.rows.length} linha(s)`
                  : v.messages.join("; "),
              );
              toast[v.ok ? "success" : "error"](v.ok ? "Preview OK" : "CSV inválido");
            }}
          >
            Validar preview
          </Button>
          {compMsg && <p className="text-xs text-slate-400">{compMsg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado do PVA (nível 3)</CardTitle>
          <CardDescription>
            Registre manualmente o relatório do PVA oficial. O sistema não executa nem automatiza o PVA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Versão do PVA</Label>
            <Input
              value={pvaVersion}
              onChange={(e) => setPvaVersion(e.target.value)}
              placeholder="ex.: PVA EFD ICMS/IPI 5.0.0"
            />
          </div>
          <div className="space-y-1">
            <Label>Trecho do relatório (opcional)</Label>
            <textarea
              className="min-h-28 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={pvaReport}
              onChange={(e) => setPvaReport(e.target.value)}
              placeholder={"ERRO: ...\nAVISO: ..."}
            />
          </div>
          <Button type="button" variant="secondary" disabled={pvaBusy} onClick={registerPva}>
            {pvaBusy ? "Registrando…" : "Registrar resultado do PVA"}
          </Button>
          {pvaRecord && (
            <pre className="text-xs overflow-auto max-h-48 rounded-xl bg-black/40 p-3">
              {JSON.stringify(pvaRecord, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
