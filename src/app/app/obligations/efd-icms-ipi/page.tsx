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
import {
  DEMO_BATCH_ID,
  DEMO_ESTABLISHMENT,
  fetchObligationDemo,
} from "@/modules/obligations/demo-fixtures";
import { suggestInformantFromDocuments } from "@/modules/obligations/efd-icms-ipi/suggest-informant";
import { periodBoundsFromYearMonth } from "@/modules/obligations/period";
import type { Batch, BatchStore } from "@/types";

export default function ObligationsEfdPage() {
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
    lineageSample?: Array<Record<string, unknown>>;
    disclaimer?: string;
  } | null>(null);

  const [pvaVersion, setPvaVersion] = useState("");
  const [pvaReport, setPvaReport] = useState("");
  const [pvaBusy, setPvaBusy] = useState(false);
  const [pvaRecord, setPvaRecord] = useState<Record<string, unknown> | null>(null);
  const [pvaRuns, setPvaRuns] = useState<
    Array<{ id: string; importedAt: string; pvaVersion: string; resultStatus: string }>
  >([]);
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [compareResult, setCompareResult] = useState<{
    added: number;
    removed: number;
    unchangedCount: number;
  } | null>(null);
  const [compKind, setCompKind] = useState<ComplementaryKind>("accountant");
  const [compPreview, setCompPreview] = useState("");
  const [compMsg, setCompMsg] = useState("");

  const [form, setForm] = useState({
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
  });

  useEffect(() => {
    idbListBatches().then((list) => {
      setBatches(list);
      if (list[0]) setBatchId(list[0].id);
    });
    void import("@/modules/obligations/efd-icms-ipi/pva/workflow").then(({ loadLocalPvaRuns }) => {
      const runs = loadLocalPvaRuns();
      setPvaRuns(
        runs.map((r) => ({
          id: r.id,
          importedAt: r.importedAt,
          pvaVersion: r.pvaVersion,
          resultStatus: r.resultStatus,
        })),
      );
    });
  }, []);

  async function refreshPvaRuns() {
    const { loadLocalPvaRuns } = await import("@/modules/obligations/efd-icms-ipi/pva/workflow");
    const runs = loadLocalPvaRuns();
    setPvaRuns(
      runs.map((r) => ({
        id: r.id,
        importedAt: r.importedAt,
        pvaVersion: r.pvaVersion,
        resultStatus: r.resultStatus,
      })),
    );
  }

  async function runPvaCompare() {
    if (!compareLeft || !compareRight || compareLeft === compareRight) {
      toast.error("Selecione duas execuções PVA distintas");
      return;
    }
    const { loadLocalPvaRuns, comparePvaRuns } = await import(
      "@/modules/obligations/efd-icms-ipi/pva/workflow"
    );
    const runs = loadLocalPvaRuns();
    const left = runs.find((r) => r.id === compareLeft);
    const right = runs.find((r) => r.id === compareRight);
    if (!left || !right) {
      toast.error("Execuções não encontradas");
      return;
    }
    const diff = comparePvaRuns(left, right);
    setCompareResult({
      added: diff.added.length,
      removed: diff.removed.length,
      unchangedCount: diff.unchangedCount,
    });
  }

  useEffect(() => {
    if (!batchId || batchId === DEMO_BATCH_ID) return;
    idbGetBatchStore(batchId).then((s) => {
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
  }, [batchId]);

  const usingDemo = batchId === DEMO_BATCH_ID && !!demoStore;
  const effectiveStore = usingDemo ? demoStore : store;
  const docCount = useMemo(() => effectiveStore?.documents.length || 0, [effectiveStore]);
  const informantHint = useMemo(
    () => (effectiveStore ? suggestInformantFromDocuments(effectiveStore.documents) : null),
    [effectiveStore],
  );

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
    toast.success(
      `Emitente do lote aplicado (${informantHint.count} NF-e · ${informantHint.distinctEmitters} CNPJ distintos)`,
    );
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
    if (!effectiveStore) {
      toast.error("Selecione um lote ou clique em Preencher demo");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      // Gera no navegador — lotes mensais (~30MB JSON) estouram o body limit da API
      // e o servidor devolve texto/HTML → "Unexpected token 'R'".
      const { generateObligationLocal } = await import("@/modules/obligations/generate-local");
      const data = await generateObligationLocal({
        obligationId: "efd-icms-ipi",
        store: effectiveStore,
        establishment: form,
      });
      setResult(data);
      if (data.error && !data.content) {
        toast.error(data.error);
        return;
      }
      toast.success(
        `TXT gerado no navegador (${data.recordCount ?? 0} registros · pré-validação interna)`,
      );
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
      const { readJsonOrTextError } = await import("@/modules/obligations/generate-local");
      const { data, parseError } = await readJsonOrTextError(res);
      if (!res.ok || !data) {
        toast.error(
          (data?.error as string) || parseError || "Falha ao registrar PVA",
        );
        return;
      }
      setPvaRecord(data.record as Record<string, unknown>);
      try {
        const { saveLocalPvaRun } = await import("@/modules/obligations/efd-icms-ipi/pva/workflow");
        saveLocalPvaRun(data.record as Parameters<typeof saveLocalPvaRun>[0]);
        await refreshPvaRuns();
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
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <Button type="button" variant="secondary" disabled={demoBusy} onClick={() => void fillDemo()}>
          {demoBusy ? "Carregando demo…" : "Preencher demo"}
        </Button>
      </div>
      {usingDemo && (
        <p className="text-xs text-amber-200/90 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          Modo demonstração: formulário + NF-e de exemplo anonimizada. Não use o TXT gerado como
          obrigação oficial.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Lote de documentos</CardTitle>
          <CardDescription>
            {docCount} documentos no lote selecionado
            {usingDemo ? " (demo)" : " (IndexedDB)"}. A geração do TXT roda neste navegador — lotes
            grandes não passam pela API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full max-w-md rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            value={batchId}
            onChange={(e) => {
              const v = e.target.value;
              setBatchId(v);
              if (v !== DEMO_BATCH_ID) setDemoStore(null);
            }}
          >
            {!batches.length && !usingDemo && (
              <option value="">Nenhum lote — importe um ZIP ou use Preencher demo</option>
            )}
            {usingDemo && <option value={DEMO_BATCH_ID}>Demo · NF-e exemplo</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" disabled={demoBusy} onClick={() => void fillDemo()}>
            {demoBusy ? "Carregando…" : "Preencher demo"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Estabelecimento e período</CardTitle>
          <CardDescription>
            O CNPJ do 0000 deve ser o da empresa informante — nas NF-e próprias ele precisa bater com o CNPJ da chave.
            {informantHint ? (
              <>
                {" "}
                Detectado no lote: {informantHint.cnpj}
                {informantHint.name ? ` (${informantHint.name})` : ""}.
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {informantHint ? (
            <div className="md:col-span-2">
              <Button type="button" variant="secondary" onClick={applyInformantFromBatch}>
                Usar emitente do lote
              </Button>
            </div>
          ) : null}
          {(
            [
              ["companyName", "Razão social"],
              ["cnpj", "CNPJ"],
              ["ie", "IE"],
              ["uf", "UF"],
              ["codMun", "COD_MUN (IBGE 7 dígitos)"],
              ["cep", "CEP"],
              ["address", "Endereço (0005)"],
              ["addressNumber", "Número"],
              ["neighborhood", "Bairro"],
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
        <Button type="button" variant="secondary" disabled={demoBusy} onClick={() => void fillDemo()}>
          {demoBusy ? "Carregando demo…" : "Preencher demo"}
        </Button>
        <Button type="button" onClick={generate} disabled={loading || !effectiveStore}>
          {loading ? "Gerando no navegador…" : "Verificar prontidão e gerar TXT"}
        </Button>
        {result?.content && (
          <Button type="button" variant="outline" onClick={downloadTxt}>
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
          {pvaRuns.length >= 2 && (
            <div className="space-y-2 rounded-xl border border-white/10 p-3">
              <p className="text-sm text-slate-300">Comparar duas execuções PVA (local)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs"
                  value={compareLeft}
                  onChange={(e) => setCompareLeft(e.target.value)}
                  aria-label="PVA esquerda"
                >
                  <option value="">Execução A</option>
                  {pvaRuns.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.pvaVersion} · {r.resultStatus} · {r.importedAt.slice(0, 19)}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs"
                  value={compareRight}
                  onChange={(e) => setCompareRight(e.target.value)}
                  aria-label="PVA direita"
                >
                  <option value="">Execução B</option>
                  {pvaRuns.map((r) => (
                    <option key={`b-${r.id}`} value={r.id}>
                      {r.pvaVersion} · {r.resultStatus} · {r.importedAt.slice(0, 19)}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="secondary" onClick={() => void runPvaCompare()}>
                Diff de issues
              </Button>
              {compareResult && (
                <p className="text-xs text-slate-400">
                  +{compareResult.added} adicionados · −{compareResult.removed} removidos ·{" "}
                  {compareResult.unchangedCount} inalterados
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
