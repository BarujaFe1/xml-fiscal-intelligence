"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listCompanies } from "@/lib/store/local-cadastro";
import {
  listAccounts,
  listEntries,
  loadLedgerSnapshot,
  saveAccount,
  saveEntry,
} from "@/lib/store/ledger";
import {
  CHART_CSV_TEMPLATE,
  JOURNAL_CSV_TEMPLATE,
  parseChartCsv,
  parseJournalCsv,
} from "@/modules/accounting/import/csv";
import { buildDiario, buildTrialBalance } from "@/modules/accounting/books";
import { entryIsBalanced, validateEntry } from "@/modules/accounting/rules";
import type { ChartAccount, JournalEntry } from "@/modules/accounting/types";
import { runObligationPlugin, ecdPlugin, ECD_LAYOUT_2026 } from "@/modules/obligations";

export default function LedgerPage() {
  const [companyId, setCompanyId] = useState("co_ledger");
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [cnpj, setCnpj] = useState("11222333000181");
  const [companyName, setCompanyName] = useState("EMPRESA LEDGER LTDA");
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [chartCsv, setChartCsv] = useState(CHART_CSV_TEMPLATE);
  const [journalCsv, setJournalCsv] = useState(JOURNAL_CSV_TEMPLATE);
  const [periodStart, setPeriodStart] = useState("2026-01-01");
  const [periodEnd, setPeriodEnd] = useState("2026-12-31");
  const [razaoCode, setRazaoCode] = useState("1.1.01");
  const [ecdPreview, setEcdPreview] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setAccounts(await listAccounts(companyId));
    setEntries(await listEntries(companyId));
  }, [companyId]);

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

  async function importChart() {
    const parsed = parseChartCsv(chartCsv, { workspaceId, companyId });
    for (const a of parsed) await saveAccount(a);
    toast.success(`${parsed.length} conta(s) importadas`);
    await refresh();
  }

  async function importJournal() {
    const parsed = parseJournalCsv(journalCsv, { workspaceId, companyId });
    const accs = await listAccounts(companyId);
    let ok = 0;
    for (const e of parsed) {
      const issues = validateEntry(e, accs);
      if (issues.some((i) => i.severity === "error")) {
        toast.error(`Lote ${e.batchLabel}: ${issues[0]?.message}`);
        continue;
      }
      await saveEntry({ ...e, status: "posted" }, accs);
      ok += 1;
    }
    toast.success(`${ok} lançamento(s) gravados`);
    await refresh();
  }

  async function generateEcd() {
    setBusy(true);
    try {
      const snap = await loadLedgerSnapshot(companyId);
      const out = await runObligationPlugin(ecdPlugin, {
        workspaceId,
        companyId,
        establishmentId: "est",
        periodStart,
        periodEnd,
        layoutVersion: ECD_LAYOUT_2026,
        uf: "SP",
        cnpj,
        companyName,
        accountantName: "Contador Ledger",
        accountantCpf: "39053344705",
        purpose: "0",
        documents: [],
        extras: { ecdMode: "ledger", ledger: snap },
      });
      if (!out.serialized) {
        toast.error("Prontidão bloqueada — veja contas DEMO ou pendências");
        setEcdPreview(JSON.stringify(out.readiness, null, 2));
        return;
      }
      setEcdPreview(out.serialized.content.slice(0, 4000));
      toast.success(`ECD ledger · hash ${out.serialized.contentHash.slice(0, 12)}`);
    } finally {
      setBusy(false);
    }
  }

  const period = { start: periodStart, end: periodEnd };
  const snap = { accounts, entries };
  const diario = buildDiario(snap, period).slice(0, 40);
  const trial = buildTrialBalance(snap, period).slice(0, 30);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Motor contábil (ECD)</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Plano + lançamentos em IndexedDB. XML fiscal não gera I200. Gere ECD a partir do ledger.
        </p>
        <Link href="/app/obligations/ecd" className="text-sm text-sky-300 hover:underline">
          Assistente ECD (DEMO) →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresa / período</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importar plano (CSV)</CardTitle>
          <CardDescription>{accounts.length} contas no ledger</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-[100px] font-mono text-xs rounded-md border border-white/10 bg-slate-900 p-2"
            value={chartCsv}
            onChange={(e) => setChartCsv(e.target.value)}
          />
          <Button type="button" onClick={() => void importChart()}>
            Importar contas
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importar lançamentos (CSV)</CardTitle>
          <CardDescription>
            {entries.length} lançamentos · equilibrados:{" "}
            {entries.filter((e) => entryIsBalanced(e)).length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-[100px] font-mono text-xs rounded-md border border-white/10 bg-slate-900 p-2"
            value={journalCsv}
            onChange={(e) => setJournalCsv(e.target.value)}
          />
          <Button type="button" onClick={() => void importJournal()}>
            Importar lançamentos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diário (amostra)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs font-mono text-slate-400">
          {!diario.length && <p>Sem movimentos no período.</p>}
          {diario.map((l, i) => (
            <div key={i}>
              {l.entryDate} {l.batchLabel} {l.accountCode} {l.side} {l.amount}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balancete (amostra)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          {trial.map((r) => (
            <div key={r.accountCode} className="flex justify-between gap-2 border-b border-white/5 py-1">
              <span>
                {r.accountCode} · {r.accountName}
              </span>
              <span className="font-mono text-slate-400">
                D {r.debit} / C {r.credit}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gerar ECD (modo ledger)</CardTitle>
          <CardDescription>Bloqueia se contas DEMO permanecerem no plano.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button type="button" disabled={busy} onClick={() => void generateEcd()}>
            {busy ? "…" : "Gerar TXT ECD"}
          </Button>
          {ecdPreview && (
            <pre className="max-h-64 overflow-auto text-[10px] font-mono text-slate-400 whitespace-pre-wrap">
              {ecdPreview}
            </pre>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {accounts.slice(0, 8).map((a) => (
          <Badge key={a.id} tone={/DEMO/i.test(a.name) ? "warning" : "success"}>
            {a.code}
          </Badge>
        ))}
        <Input
          className="max-w-[140px]"
          value={razaoCode}
          onChange={(e) => setRazaoCode(e.target.value)}
          placeholder="conta razão"
        />
      </div>
    </div>
  );
}
