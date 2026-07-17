"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import {
  suggestInformantByCnpj,
  suggestInformantFromDocuments,
} from "@/modules/obligations/efd-icms-ipi/suggest-informant";
import { buildObligationContextFromBatch, filterDocumentsByPeriod } from "@/modules/obligations/efd-icms-ipi/from-batch";
import { detectEfdRequiredData } from "@/modules/obligations/efd-icms-ipi/builders";
import { EFD_ICMS_IPI_LAYOUT_2026 } from "@/modules/obligations/efd-icms-ipi/constants";
import { periodBoundsFromYearMonth } from "@/modules/obligations/period";
import {
  CompanyDirectoryPanel,
  type CompanyDirectoryApply,
} from "@/components/obligations/company-directory-panel";
import { getLastCompanyCnpj, setLastCompanyCnpj } from "@/lib/store/last-company";
import {
  getCompanyByCnpj,
  listCompanies,
  listEstablishments,
  localCompanyToFiscalPatch,
  type LocalCompany,
} from "@/lib/store/local-cadastro";
import type { Batch, BatchStore } from "@/types";

type ReadinessItemView = {
  id: string;
  label: string;
  status: string;
  message?: string;
  explanation?: string;
  fix?: string;
};

function ReadinessItemRow({ item }: { item: ReadinessItemView }) {
  const tone =
    item.status === "blocking" ? "error" : item.status === "complete" ? "success" : "warning";
  const needsFix = item.status !== "complete";
  return (
    <div className="space-y-1 rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{item.status}</Badge>
        <span className="font-medium text-slate-100">{item.label}</span>
      </div>
      {item.message && <p className="text-xs text-slate-400">{item.message}</p>}
      {item.explanation && <p className="text-sm leading-snug text-slate-300">{item.explanation}</p>}
      {needsFix && item.fix && (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/40 p-2">
          <p className="text-xs font-semibold text-emerald-300">Como resolver</p>
          <p className="text-sm leading-snug text-emerald-100/90">{item.fix}</p>
        </div>
      )}
    </div>
  );
}

export default function ObligationsEfdPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [store, setStore] = useState<BatchStore | null>(null);
  const [demoStore, setDemoStore] = useState<BatchStore | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const usingDemo = batchId === DEMO_BATCH_ID && !!demoStore;
  const effectiveStore = usingDemo ? demoStore : store;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    content?: string;
    contentHash?: string;
    manifest?: Record<string, unknown>;
    readiness?: { items: Array<{ id: string; label: string; status: string; message?: string; explanation?: string; fix?: string }>; canGenerate: boolean };
    validation?: { ok: boolean; issues: Array<{ severity: string; message: string }> };
    lineageSample?: Array<Record<string, unknown>>;
    disclaimer?: string;
    generationStatus?: string;
  } | null>(null);

  const [pvaVersion, setPvaVersion] = useState("");
  const [pvaReport, setPvaReport] = useState("");
  const [pvaResultStatus, setPvaResultStatus] = useState<"ok" | "errors" | "warnings" | "unknown">(
    "unknown",
  );
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
    accountantEmail: "",
    accountantCrc: "",
    industrialClass: "",
    priorCreditBalance: "",
    cnae: "",
    cnaeDescription: "",
    icmsCodRec: "",
  });

  const [companies, setCompanies] = useState<LocalCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [scopeCnpj, setScopeCnpj] = useState("");

  // Recorte de período: permite gerar de um dia, semana, mês, semestre, o lote
  // inteiro (mês do arquivo importado) ou intervalo arbitrário a partir de um
  // único lote importado (ex.: o ZIP mensal).
  type PeriodMode = "mes" | "semana" | "dia" | "semestre" | "lote" | "custom";
  const [periodMode, setPeriodMode] = useState<PeriodMode>("mes");
  const [periodMonth, setPeriodMonth] = useState("2026-04");
  const [periodRefDate, setPeriodRefDate] = useState("2026-04-15");
  const [periodSemester, setPeriodSemester] = useState<"1" | "2">("1");
  const [periodYear, setPeriodYear] = useState("2026");

  useEffect(() => {
    if (periodMode === "custom") return;
    let start = "";
    let end = "";
    if (periodMode === "mes") {
      const [y, m] = periodMonth.split("-").map(Number);
      const last = new Date(y, m, 0);
      start = `${y}-${String(m).padStart(2, "0")}-01`;
      end = `${y}-${String(m).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
    } else if (periodMode === "semestre") {
      const y = Number(periodYear);
      start = periodSemester === "1" ? `${y}-01-01` : `${y}-07-01`;
      end = periodSemester === "1" ? `${y}-06-30` : `${y}-12-31`;
    } else if (periodMode === "dia") {
      start = periodRefDate;
      end = periodRefDate;
    } else if (periodMode === "lote") {
      // "Todo o lote": usa o mês/ano do arquivo importado (batch.year/batch.month),
      // sem recortar por data. Garante DT_INI/DT_FIN no mesmo mês (exigência do PVA)
      // e inclui todas as NF-e do lote. Fallback: mês da primeira NF-e do lote.
      const by = Number(effectiveStore?.batch.year);
      const bm = Number(effectiveStore?.batch.month);
      if (by && bm) {
        const bounds = periodBoundsFromYearMonth(by, bm);
        start = bounds.periodStart;
        end = bounds.periodEnd;
      } else {
        const dates = (effectiveStore?.documents || [])
          .map((d) => (d.issueDate || "").slice(0, 10))
          .filter(Boolean)
          .sort();
        if (dates[0]) {
          const [y, m] = dates[0].split("-").map(Number);
          const last = new Date(y, m, 0);
          start = `${y}-${String(m).padStart(2, "0")}-01`;
          end = `${y}-${String(m).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
        }
      }
    } else if (periodMode === "semana") {
      const dt = new Date(`${periodRefDate}T00:00:00`);
      const dow = (dt.getDay() + 6) % 7; // 0 = segunda
      const mon = new Date(dt);
      mon.setDate(dt.getDate() - dow);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      start = fmt(mon);
      end = fmt(sun);
    }
    if (!start || !end) return;
    setForm((f) =>
      f.periodStart === start && f.periodEnd === end
        ? f
        : { ...f, periodStart: start, periodEnd: end },
    );
  }, [periodMode, periodMonth, periodRefDate, periodSemester, periodYear, effectiveStore]);

  useEffect(() => {
    idbListBatches().then((list) => {
      setBatches(list);
      if (list[0]) setBatchId(list[0].id);
    });
    void listCompanies()
      .then((list) => setCompanies(list.filter((c) => c.active !== false)))
      .catch(() => {});
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
    void (async () => {
      const last = getLastCompanyCnpj();
      if (!last) return;
      const co = await getCompanyByCnpj(last);
      if (!co) return;
      const ests = await listEstablishments();
      const est = ests.find((e) => e.companyId === co.id);
      const patch = localCompanyToFiscalPatch(co, est);
      setForm((f) => {
        if (f.companyName || f.cnpj) return f;
        return {
          ...f,
          cnpj: patch.cnpj || f.cnpj,
          companyName: patch.companyName || f.companyName,
          ie: patch.ie || f.ie,
          uf: patch.uf || f.uf,
          codMun: patch.codMun || f.codMun,
          cep: patch.cep || f.cep,
          address: patch.address || f.address,
          addressNumber: patch.addressNumber || f.addressNumber,
          neighborhood: patch.neighborhood || f.neighborhood,
          tradeName: patch.tradeName || f.tradeName,
          accountantName: patch.accountantName || f.accountantName,
          accountantCpf: patch.accountantCpf || f.accountantCpf,
          accountantEmail: patch.accountantEmail || f.accountantEmail,
          accountantCrc: patch.accountantCrc || f.accountantCrc,
          activityCode: patch.activityCode || f.activityCode,
          profile: (patch.profile as "A" | "B" | "C") || f.profile,
          purpose: (patch.purpose as "0" | "1") || f.purpose,
          industrialClass: patch.industrialClass || f.industrialClass,
          priorCreditBalance: patch.priorCreditBalance || f.priorCreditBalance,
          cnae: patch.cnae || f.cnae,
          cnaeDescription: patch.cnaeDescription || f.cnaeDescription,
        };
      });
    })();
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
        const y = Number(s.batch.year);
        const m = Number(s.batch.month);
        setPeriodMonth(`${y}-${String(m).padStart(2, "0")}`);
        setPeriodYear(String(y));
        setPeriodSemester(m <= 6 ? "1" : "2");
        setPeriodMode("mes");
      }
    });
  }, [batchId]);

  const docCount = useMemo(() => effectiveStore?.documents.length || 0, [effectiveStore]);
  const informantHint = useMemo(
    () => (effectiveStore ? suggestInformantFromDocuments(effectiveStore.documents) : null),
    [effectiveStore],
  );

  // Prontidão calculada AO VIVO (antes de gerar) a partir do form + lote atual.
  const liveReadiness = useMemo(() => {
    if (!effectiveStore?.documents?.length) return null;
    const want = usingDemo ? "" : (scopeCnpj || form.cnpj || "").replace(/\D/g, "");
    const docs = want
      ? effectiveStore.documents.filter(
          (d) =>
            (d.emitterDoc || "").replace(/\D/g, "") === want ||
            (d.receiverDoc || "").replace(/\D/g, "") === want,
        )
      : effectiveStore.documents;
    const ids = new Set(docs.map((d) => d.id));
    const items = want ? effectiveStore.items.filter((i) => ids.has(i.documentId)) : effectiveStore.items;
    const periodFilter = filterDocumentsByPeriod(docs, form.periodStart, form.periodEnd);
    const ctx = buildObligationContextFromBatch({
      establishment: {
        workspaceId: effectiveStore.batch?.workspaceId || "ws_local",
        companyId: "co_local",
        establishmentId: "est_local",
        layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
        cnpj: form.cnpj,
        ie: form.ie,
        uf: form.uf,
        companyName: form.companyName,
        profile: form.profile,
        activityCode: form.activityCode,
        purpose: form.purpose,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        codMun: form.codMun,
        tradeName: form.tradeName,
        cep: form.cep,
        address: form.address,
        addressNumber: form.addressNumber,
        neighborhood: form.neighborhood,
        accountantName: form.accountantName,
        accountantCpf: form.accountantCpf,
        accountantEmail: form.accountantEmail,
        accountantCrc: form.accountantCrc,
        cnae: form.cnae,
        cnaeDescription: form.cnaeDescription,
        industrialClass: form.industrialClass,
        priorCreditBalance: form.priorCreditBalance,
        icmsCodRec: form.icmsCodRec,
      },
      documents: periodFilter.inPeriod,
      items,
    });
    ctx.outOfPeriodCount = periodFilter.outOfPeriodCount;
    return detectEfdRequiredData(ctx);
  }, [effectiveStore, scopeCnpj, usingDemo, form]);

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
      setLastCompanyCnpj(informantHint.cnpj);
      setScopeCnpj(informantHint.cnpj || "");
      toast.success(
        `Emitente do lote aplicado (${informantHint.count} NF-e · ${informantHint.distinctEmitters} CNPJ distintos) — geração agora restrita a este CNPJ`,
      );
  }

  function applyCompanyDirectory(patch: CompanyDirectoryApply) {
    setForm((f) => ({
      ...f,
      cnpj: patch.cnpj || f.cnpj,
      companyName: patch.companyName || f.companyName,
      uf: patch.uf || f.uf,
      ie: patch.ie || f.ie,
      codMun: patch.codMun || f.codMun,
      address: patch.address || f.address,
      addressNumber: patch.addressNumber || f.addressNumber,
      neighborhood: patch.neighborhood || f.neighborhood,
      cep: patch.cep || f.cep,
      tradeName: patch.tradeName || f.tradeName,
      accountantName: patch.accountantName || f.accountantName,
      accountantCpf: patch.accountantCpf || f.accountantCpf,
      accountantEmail: patch.accountantEmail || f.accountantEmail,
      accountantCrc: patch.accountantCrc || f.accountantCrc,
    }));
    if (patch.cnpj) setLastCompanyCnpj(patch.cnpj);
  }

  async function applyRegisteredCompany(companyId: string) {
    if (!companyId) {
      setSelectedCompanyId("");
      setScopeCnpj("");
      return;
    }
    const co = companies.find((c) => c.id === companyId);
    if (!co) return;
    const ests = await listEstablishments();
    const est = ests.find((e) => e.companyId === co.id);
    const patch = localCompanyToFiscalPatch(co, est);
    setForm((f) => ({
      ...f,
      cnpj: patch.cnpj || f.cnpj,
      companyName: patch.companyName || f.companyName,
      ie: patch.ie || f.ie,
      uf: patch.uf || f.uf,
      codMun: patch.codMun || f.codMun,
      cep: patch.cep || f.cep,
      address: patch.address || f.address,
      addressNumber: patch.addressNumber || f.addressNumber,
      neighborhood: patch.neighborhood || f.neighborhood,
      tradeName: patch.tradeName || f.tradeName,
      accountantName: patch.accountantName || f.accountantName,
      accountantCpf: patch.accountantCpf || f.accountantCpf,
      accountantEmail: patch.accountantEmail || f.accountantEmail,
      accountantCrc: patch.accountantCrc || f.accountantCrc,
      activityCode: patch.activityCode || f.activityCode,
      profile: (patch.profile as "A" | "B" | "C") || f.profile,
      purpose: (patch.purpose as "0" | "1") || f.purpose,
      industrialClass: patch.industrialClass || f.industrialClass,
      priorCreditBalance: patch.priorCreditBalance || f.priorCreditBalance,
      cnae: patch.cnae || f.cnae,
      cnaeDescription: patch.cnaeDescription || f.cnaeDescription,
    }));
    setSelectedCompanyId(companyId);
    setScopeCnpj(co.cnpj || "");
    if (co.cnpj) setLastCompanyCnpj(co.cnpj);
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
        accountantEmail: DEMO_ESTABLISHMENT.accountantEmail || "",
        accountantCrc: DEMO_ESTABLISHMENT.accountantCrc || "",
        industrialClass: DEMO_ESTABLISHMENT.industrialClass || "",
        priorCreditBalance: DEMO_ESTABLISHMENT.priorCreditBalance || "",
        cnae: DEMO_ESTABLISHMENT.cnae || "",
        cnaeDescription: DEMO_ESTABLISHMENT.cnaeDescription || "",
        icmsCodRec: DEMO_ESTABLISHMENT.icmsCodRec || "",
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
        scopeCnpj: usingDemo ? undefined : (scopeCnpj || form.cnpj || undefined),
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
      const workspaceId =
        (typeof localStorage !== "undefined" && localStorage.getItem("xfi:workspace-id")) ||
        "ws_local_demo";
      const res = await fetch("/api/obligations/efd-icms-ipi/pva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          contentHash: result?.contentHash,
          pvaVersion: pvaVersion.trim(),
          reportText: pvaReport,
          resultStatus: pvaResultStatus === "unknown" ? undefined : pvaResultStatus,
          notes: "Registro manual assistido",
          workspaceId,
          persistReport: true,
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
      if (typeof data.generationStatus === "string") {
        setResult((r) => (r ? { ...r, generationStatus: data.generationStatus as string } : r));
      }
      try {
        const { saveLocalPvaRun } = await import("@/modules/obligations/efd-icms-ipi/pva/workflow");
        saveLocalPvaRun(data.record as Parameters<typeof saveLocalPvaRun>[0]);
        await refreshPvaRuns();
      } catch {
        // ignore
      }
      toast.success(
        data.persisted
          ? `PVA registrado e persistido · status ${String(data.generationStatus || "")}`
          : `PVA registrado localmente · status ${String(data.generationStatus || "")}`,
      );
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
          <div className="md:col-span-2 space-y-1">
            <Label>Empresa cadastrada (gera só as notas deste CNPJ)</Label>
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={selectedCompanyId}
              onChange={(e) => void applyRegisteredCompany(e.target.value)}
            >
              <option value="">— nenhuma: usar dados manuais / lote inteiro —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.cnpj ? `· ${c.cnpj}` : ""} {c.uf ? `· ${c.uf}` : ""}
                </option>
              ))}
            </select>
            {scopeCnpj ? (
              <p className="text-xs text-emerald-300/90">
                Geração restrita ao CNPJ {scopeCnpj} — apenas NF-e onde ele é emitente ou
                destinatário. O 0000 usará os dados desta empresa.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Sem empresa selecionada, a geração restringe automaticamente às notas do CNPJ
                informante (preenchido no formulário ou via «Usar emitente do lote»). Para
                restringir a outra empresa, cadastre-a em{" "}
                <Link href="/app/companies" className="text-sky-300 underline">Empresas</Link> e
                selecione-a aqui.
              </p>
            )}
          </div>
          {informantHint ? (
            <div className="md:col-span-2">
              <Button type="button" variant="secondary" onClick={applyInformantFromBatch}>
                Usar emitente do lote
              </Button>
            </div>
          ) : null}
          <CompanyDirectoryPanel
            onApply={applyCompanyDirectory}
            currentForm={{
              companyName: form.companyName,
              cnpj: form.cnpj,
              ie: form.ie,
              uf: form.uf,
              codMun: form.codMun,
              cep: form.cep,
              address: form.address,
              addressNumber: form.addressNumber,
              neighborhood: form.neighborhood,
              tradeName: form.tradeName,
              accountantName: form.accountantName,
              accountantCpf: form.accountantCpf,
            }}
            enrichFromBatch={(cnpj) =>
              effectiveStore ? suggestInformantByCnpj(effectiveStore.documents, cnpj) : null
            }
          />
          <div className="md:col-span-2 space-y-3 rounded-xl border border-white/10 bg-slate-950/30 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label>Recorte do período</Label>
                <select
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                  value={periodMode}
                  onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
                >
                  <option value="mes">Mês</option>
                  <option value="semana">Semana</option>
                  <option value="dia">Dia</option>
                  <option value="semestre">Semestre</option>
                  <option value="lote">Todo o lote (mês do arquivo)</option>
                  <option value="custom">De / até (personalizado)</option>
                </select>
              </div>
              {periodMode === "mes" && (
                <div className="space-y-1">
                  <Label>Mês</Label>
                  <input
                    type="month"
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                  />
                </div>
              )}
              {periodMode === "semestre" && (
                <>
                  <div className="space-y-1">
                    <Label>Ano</Label>
                    <input
                      type="number"
                      className="w-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      value={periodYear}
                      onChange={(e) => setPeriodYear(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Semestre</Label>
                    <select
                      className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      value={periodSemester}
                      onChange={(e) => setPeriodSemester(e.target.value as "1" | "2")}
                    >
                      <option value="1">1º (jan–jun)</option>
                      <option value="2">2º (jul–dez)</option>
                    </select>
                  </div>
                </>
              )}
              {(periodMode === "dia" || periodMode === "semana") && (
                <div className="space-y-1">
                  <Label>{periodMode === "dia" ? "Dia" : "Semana (data de referência)"}</Label>
                  <input
                    type="date"
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    value={periodRefDate}
                    onChange={(e) => setPeriodRefDate(e.target.value)}
                  />
                </div>
              )}
              {periodMode === "custom" && (
                <>
                  <div className="space-y-1">
                    <Label>De</Label>
                    <input
                      type="date"
                      className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      value={form.periodStart}
                      onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Até</Label>
                    <input
                      type="date"
                      className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      value={form.periodEnd}
                      onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                    />
                  </div>
                </>
              )}
              {periodMode === "lote" && (
                <div className="space-y-1">
                  <Label>Mês do arquivo</Label>
                  <p className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                    {effectiveStore?.batch.year && effectiveStore?.batch.month
                      ? `${String(effectiveStore.batch.month).padStart(2, "0")}/${effectiveStore.batch.year}`
                      : "usando a data da primeira NF-e do lote"}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label>Período efetivo (0000)</Label>
                <p className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                  {form.periodStart} → {form.periodEnd}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Importe o lote uma vez (ex.: o ZIP mensal) e gere recortes arbitrários — só entram as
              NF-e com data de emissão dentro do período escolhido.
            </p>
          </div>
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
              ["accountantName", "Contabilista (opcional)"],
              ["accountantCpf", "CPF contabilista"],
              ["accountantCrc", "CRC do contabilista (gera registro 0100)"],
              ["icmsCodRec", "COD_REC (E116) — código estadual do ICMS a recolher"],
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

      {liveReadiness && (
        <Card>
          <CardHeader>
            <CardTitle>Verificação antes de gerar</CardTitle>
            <CardDescription>
              {liveReadiness.canGenerate
                ? "Tudo certo para gerar — confira abaixo cada item."
                : `${liveReadiness.blockingCount} pendência(s) bloqueiam a geração. Veja como resolver.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {liveReadiness.items.map((i) => (
              <ReadinessItemRow key={i.id} item={i} />
            ))}
          </CardContent>
        </Card>
      )}

      {result?.readiness && (
        <Card>
          <CardHeader>
            <CardTitle>Prontidão (após gerar)</CardTitle>
            <CardDescription>
              {result.readiness.canGenerate ? "Sem bloqueios estruturais" : "Geração bloqueada"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.readiness.items.map((i) => (
              <ReadinessItemRow key={i.id} item={i} />
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
          {result?.generationStatus ? (
            <p className="text-xs text-slate-300">
              Status da geração:{" "}
              <span className="font-mono text-sky-300">{result.generationStatus}</span>
              {" · "}
              TXT gerado ≠ transmitido à RFB.
            </p>
          ) : null}
          <div className="space-y-1">
            <Label>Versão do PVA</Label>
            <Input
              value={pvaVersion}
              onChange={(e) => setPvaVersion(e.target.value)}
              placeholder="ex.: PVA EFD ICMS/IPI 5.0.0"
            />
          </div>
          <div className="space-y-1">
            <Label>Resultado informado</Label>
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={pvaResultStatus}
              onChange={(e) =>
                setPvaResultStatus(e.target.value as "ok" | "errors" | "warnings" | "unknown")
              }
            >
              <option value="unknown">Inferir do relatório</option>
              <option value="ok">Aceito sem erros</option>
              <option value="warnings">Advertências</option>
              <option value="errors">Erros bloqueantes</option>
            </select>
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
          <Button type="button" variant="secondary" disabled={pvaBusy} onClick={() => void registerPva()}>
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
