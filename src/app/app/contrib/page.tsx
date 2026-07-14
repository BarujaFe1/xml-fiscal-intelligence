"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listCompanies } from "@/lib/store/local-cadastro";
import {
  listContribEntries,
  listRateioLines,
  saveContribEntry,
  saveRateioLine,
} from "@/lib/store/contrib";
import type { ContribEntry, ContribMode, ContribRegimeCode } from "@/modules/contrib/types";
import { CONTRIB_MODE_LABELS } from "@/modules/contrib/modes";
import { buildContribBooks } from "@/modules/contrib/books";
import { simulateWithWithoutCredit, isContribSimulatorEnabled } from "@/modules/contrib/simulator";
import {
  parseDctfMitImportCsv,
  reconcileDctfMitVsContrib,
} from "@/modules/contrib/reconcile-dctf-mit";
import { cataloguedRuleImpacts } from "@/modules/contrib/rule-sets";
import {
  runObligationPlugin,
  efdContribuicoesPlugin,
  EFD_CONTRIB_LAYOUT_2026,
} from "@/modules/obligations";
import { isHomologationGradePgeRun } from "@/modules/obligations/efd-contribuicoes/homologation";

export default function ContribCockpitPage() {
  const [companyId, setCompanyId] = useState("co_contrib");
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [cnpj, setCnpj] = useState("11222333000181");
  const [companyName, setCompanyName] = useState("EMPRESA CONTRIB LTDA");
  const [periodStart, setPeriodStart] = useState("2026-03-01");
  const [periodEnd, setPeriodEnd] = useState("2026-03-31");
  const [regimeCode, setRegimeCode] = useState<ContribRegimeCode>("non_cumulative");
  const [mode, setMode] = useState<ContribMode>("current_fact_generation");
  const [entries, setEntries] = useState<ContribEntry[]>([]);
  const [debitAmt, setDebitAmt] = useState("1000,00");
  const [creditAmt, setCreditAmt] = useState("200,00");
  const [dctfCsv, setDctfCsv] = useState("periodo;cod_receita;valor;sistema\n2026-03;8109;800,00;dctfweb\n");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  const periodKey = periodStart.slice(0, 7);

  const refresh = useCallback(async () => {
    setEntries(await listContribEntries({ companyId, periodKey }));
  }, [companyId, periodKey]);

  useEffect(() => {
    void (async () => {
      const cos = await listCompanies();
      if (cos[0]) {
        setCompanyId(cos[0].id);
        setCnpj(cos[0].cnpj || cnpj);
        setCompanyName(cos[0].name);
      }
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") localStorage.setItem("xfi:workspace-id", ws);
      setWorkspaceId(ws);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addPair() {
    const now = new Date().toISOString();
    await saveContribEntry({
      id: `deb_${Date.now()}`,
      workspaceId,
      companyId,
      periodKey,
      kind: "debit",
      amount: debitAmt,
      creditExplicit: true,
      origin: "manual",
      mode,
      history: "Débito manual cockpit",
      createdAt: now,
      updatedAt: now,
    });
    await saveContribEntry({
      id: `cred_${Date.now() + 1}`,
      workspaceId,
      companyId,
      periodKey,
      kind: "credit",
      amount: creditAmt,
      creditExplicit: true,
      origin: "manual",
      mode,
      history: "Crédito explícito",
      createdAt: now,
      updatedAt: now,
    });
    await saveRateioLine({
      id: `rat_${companyId}_pis`,
      workspaceId,
      companyId,
      key: "pis_credit",
      label: "geral",
      weight: 1,
    });
    toast.success("Débito + crédito explícito gravados");
    await refresh();
  }

  async function generate() {
    setBusy(true);
    try {
      const rateio = await listRateioLines(companyId);
      const snap = {
        entries,
        rateio: rateio.map(({ key, label, weight, targetCenter }) => ({
          key,
          label,
          weight,
          targetCenter,
        })),
        regimeCode,
        mode,
        periodKey,
      };
      const out = await runObligationPlugin(efdContribuicoesPlugin, {
        workspaceId,
        companyId,
        establishmentId: "est",
        periodStart,
        periodEnd,
        layoutVersion: EFD_CONTRIB_LAYOUT_2026,
        uf: "SP",
        cnpj,
        companyName,
        purpose: "0",
        documents: [],
        extras: { contribSnapshot: snap, regimeCode, contribMode: mode },
      });
      if (!out.serialized) {
        toast.error("Prontidão bloqueada");
        setPreview(JSON.stringify(out.readiness, null, 2));
        return;
      }
      const grade = isHomologationGradePgeRun({
        contentHash: out.serialized.contentHash,
        programVersion: "local-draft",
        resultStatus: "unknown",
      });
      setPreview(out.serialized.content.slice(0, 4000));
      toast.success(`Contrib · hash ${out.serialized.contentHash.slice(0, 12)} · PGE grade=${grade}`);
    } finally {
      setBusy(false);
    }
  }

  const books = useMemo(
    () =>
      buildContribBooks({
        entries,
        rateio: [],
        regimeCode,
        mode,
        periodKey,
      }),
    [entries, regimeCode, mode, periodKey],
  );

  const sim = useMemo(
    () =>
      simulateWithWithoutCredit(
        { entries, rateio: [], regimeCode, mode, periodKey },
        { forceEnable: true },
      ),
    [entries, regimeCode, mode, periodKey],
  );

  const recon = useMemo(() => {
    const imported = parseDctfMitImportCsv(dctfCsv);
    const expect = entries
      .filter((e) => e.kind === "debit")
      .map((e) => ({
        periodKey: e.periodKey,
        kind: e.kind,
        entryId: e.id,
        amount: e.amount,
      }));
    return reconcileDctfMitVsContrib(imported, expect);
  }, [dctfCsv, entries]);

  const ntImpacts = cataloguedRuleImpacts(periodStart);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">EFD-Contribuições (domínio)</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Apuração própria + Bloco M. Simulador flag:{" "}
          <Badge>{isContribSimulatorEnabled() ? "ON" : "OFF"}</Badge>
        </p>
        <Link href="/app/obligations/efd-contribuicoes" className="text-sm text-sky-300 hover:underline">
          Assistente legado (XML) →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresa / regime / modo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Company ID</Label>
            <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Início</Label>
            <Input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fim</Label>
            <Input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Regime</Label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm"
              value={regimeCode}
              onChange={(e) => setRegimeCode(e.target.value as ContribRegimeCode)}
            >
              <option value="non_cumulative">Não cumulativo</option>
              <option value="cumulative">Cumulativo</option>
              <option value="cprb">CPRB</option>
              <option value="mixed">Misto</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Modo</Label>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as ContribMode)}
            >
              <option value="current_fact_generation">
                {CONTRIB_MODE_LABELS.current_fact_generation}
              </option>
              <option value="historical_and_credit_management">
                {CONTRIB_MODE_LABELS.historical_and_credit_management}
              </option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos do domínio</CardTitle>
          <CardDescription>Crédito só com creditExplicit — nunca inventado do XML</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <Input value={debitAmt} onChange={(e) => setDebitAmt(e.target.value)} placeholder="Débito" />
            <Input value={creditAmt} onChange={(e) => setCreditAmt(e.target.value)} placeholder="Crédito" />
            <Button type="button" onClick={() => void addPair()}>
              Gravar débito + crédito
            </Button>
          </div>
          <ul className="text-sm space-y-1 max-h-40 overflow-auto">
            {entries.map((e) => (
              <li key={e.id}>
                {e.kind} · {e.amount} · {e.creditExplicit ? "explícito" : "?"}
              </li>
            ))}
          </ul>
          <div className="text-xs text-slate-400 space-y-1">
            {books.map((b) => (
              <p key={b.kind}>
                Livro {b.kind}: {b.count} · {b.amount.toFixed(2)}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NTs catalogadas (não auto-ativadas)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-400 space-y-1">
          {ntImpacts.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulador com/sem crédito (lab)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {sim.scenarios.map((s) => (
            <p key={s.id}>
              {s.id}: a recolher PIS {s.toPayPis} / COFINS {s.toPayCofins}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conciliação DCTFWeb / MIT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-[80px] rounded-md border border-slate-700 bg-slate-950 p-2 text-sm font-mono"
            value={dctfCsv}
            onChange={(e) => setDctfCsv(e.target.value)}
          />
          <p className="text-xs text-slate-400">
            matched={recon.matched} · unmatched import={recon.unmatchedImport} · contrib=
            {recon.unmatchedContrib}
          </p>
          {recon.findings.slice(0, 8).map((f) => (
            <p key={f.code + f.message} className="text-xs">
              [{f.severity}] {f.message}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gerar TXT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" disabled={busy} onClick={() => void generate()}>
            Gerar EFD-Contribuições (domínio)
          </Button>
          {preview ? (
            <pre className="max-h-80 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-xs whitespace-pre-wrap">
              {preview}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
