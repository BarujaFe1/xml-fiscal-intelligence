"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listCompanies } from "@/lib/store/local-cadastro";
import { listAccounts, loadLedgerSnapshot } from "@/lib/store/ledger";
import {
  listAccountMaps,
  listElalur,
  listReferentialTables,
  saveAccountMap,
  saveElalur,
  savePriorEcf,
  saveReferentialTable,
} from "@/lib/store/ecf";
import type { ChartAccount } from "@/modules/accounting/types";
import type { AccountReferentialMap, ElalurSnapshot } from "@/modules/ecf/types";
import { confirmMap, listOrphanAccounts, suggestReferentialForAccount } from "@/modules/ecf/mapper";
import { parseEcfPriorTxt, mapsFromPriorHints } from "@/modules/ecf/recovery/ecf-prior";
import { parseReferentialCsv, REFERENTIAL_CSV_TEMPLATE } from "@/modules/ecf/referential/catalog";
import { diffElalur, emptyElalur } from "@/modules/ecf/elalur/model";
import { reconcileEcdVsEcf, reconcileEcfVsPrior } from "@/modules/ecf/reconcile";
import { isEcfIrpjEngineEnabled } from "@/modules/ecf/irpj/engine";
import { runObligationPlugin, ecfPlugin, ECF_LAYOUT_2026 } from "@/modules/obligations";
import { isHomologationGradeEcfRun } from "@/modules/obligations/ecf/homologation";

export default function EcfCockpitPage() {
  const [companyId, setCompanyId] = useState("co_ecf");
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [cnpj, setCnpj] = useState("11222333000181");
  const [companyName, setCompanyName] = useState("EMPRESA ECF LTDA");
  const [periodStart, setPeriodStart] = useState("2026-01-01");
  const [periodEnd, setPeriodEnd] = useState("2026-12-31");
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [maps, setMaps] = useState<AccountReferentialMap[]>([]);
  const [elalur, setElalur] = useState<ElalurSnapshot | null>(null);
  const [priorTxt, setPriorTxt] = useState("");
  const [refCsv, setRefCsv] = useState(REFERENTIAL_CSV_TEMPLATE);
  const [mapCode, setMapCode] = useState("");
  const [mapRef, setMapRef] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setAccounts(await listAccounts(companyId));
    setMaps(await listAccountMaps(companyId));
    const els = await listElalur(companyId, periodStart.slice(0, 4));
    setElalur(els[0] || null);
  }, [companyId, periodStart]);

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

  const orphans = useMemo(() => listOrphanAccounts(accounts, maps), [accounts, maps]);

  async function importPrior() {
    const prior = parseEcfPriorTxt(priorTxt);
    await savePriorEcf({
      id: `prior_${companyId}_${periodStart.slice(0, 4)}`,
      workspaceId,
      companyId,
      periodKey: periodStart.slice(0, 4),
      prior,
      importedAt: new Date().toISOString(),
    });
    const hints = mapsFromPriorHints(prior, { workspaceId, companyId });
    for (const h of hints) {
      const now = new Date().toISOString();
      await saveAccountMap({
        id: `map_${companyId}_${h.accountCode}`,
        workspaceId,
        companyId,
        accountCode: h.accountCode,
        referentialCode: "",
        suggestedReferentialCode: h.suggestedReferentialCode,
        suggestionSource: "history",
        createdAt: now,
        updatedAt: now,
      });
    }
    toast.success(`Prior importado · ${hints.length} sugestão(ões) (não confirmadas)`);
    await refresh();
  }

  async function importRefs() {
    const table = parseReferentialCsv(refCsv, {
      workspaceId,
      tableCode: "plano_referencial",
      versionLabel: "import_local",
      effectiveFrom: periodStart,
      sourceFileName: "paste.csv",
    });
    await saveReferentialTable(table);
    toast.success(`${table.entries.length} código(s) referenciais importados`);
  }

  async function confirmSelectedMap() {
    if (!mapCode.trim() || !mapRef.trim()) {
      toast.error("Informe conta e referencial");
      return;
    }
    const now = new Date().toISOString();
    const existing = maps.find((m) => m.accountCode === mapCode.trim());
    const confirmed = confirmMap({
      id: existing?.id || `map_${companyId}_${mapCode.trim()}`,
      workspaceId,
      companyId,
      accountCode: mapCode.trim(),
      referentialCode: mapRef.trim(),
      confirmedBy: "preparador_local",
      createdAt: existing?.createdAt || now,
    });
    await saveAccountMap(confirmed);
    toast.success(`Mapa ${mapCode} → ${mapRef} confirmado`);
    setMapCode("");
    setMapRef("");
    await refresh();
  }

  async function seedElalur() {
    let snap = elalur || emptyElalur({
      workspaceId,
      companyId,
      periodKey: periodStart.slice(0, 4),
    });
    const lineId = `a_${Date.now()}`;
    snap = {
      ...snap,
      partA: [
        ...snap.partA,
        {
          id: lineId,
          kind: "addition",
          accountCode: mapCode || accounts.find((a) => a.kind === "analytic")?.code || "1.1.01",
          amount: "100,00",
          legalDevice: "demo_local",
          history: "Adição assistida (manual)",
          origin: "manual",
          approvedBy: "revisor_local",
          approvedAt: new Date().toISOString(),
        },
      ],
    };
    const saved = await saveElalur(snap);
    setElalur(saved);
    toast.success("Linha Parte A gravada");
  }

  async function generateEcf() {
    setBusy(true);
    try {
      const ledger = await loadLedgerSnapshot(companyId);
      const tables = await listReferentialTables(workspaceId);
      const out = await runObligationPlugin(ecfPlugin, {
        workspaceId,
        companyId,
        establishmentId: "est",
        periodStart,
        periodEnd,
        layoutVersion: ECF_LAYOUT_2026,
        uf: "SP",
        cnpj,
        companyName,
        purpose: "0",
        documents: [],
        extras: {
          ecfMode: "official",
          taxRegime: "1",
          ecdLedger: ledger,
          accountMaps: maps,
          referentialTables: tables,
          elalur: elalur || undefined,
        },
      });
      if (!out.serialized) {
        toast.error("Prontidão bloqueada — mapas órfãos ou DEMO");
        setPreview(JSON.stringify(out.readiness, null, 2));
        return;
      }
      const grade = isHomologationGradeEcfRun({
        contentHash: out.serialized.contentHash,
        programVersion: "local-draft",
        resultStatus: "unknown",
      });
      setPreview(out.serialized.content.slice(0, 4000));
      toast.success(
        `ECF · hash ${out.serialized.contentHash.slice(0, 12)} · homologationGrade=${grade}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const findings = useMemo(() => {
    const ledger = { accounts, entries: [] as never[] };
    return reconcileEcdVsEcf({ ledger, maps, elalur: elalur || undefined });
  }, [accounts, maps, elalur]);

  const priorFindings = useMemo(() => {
    if (!priorTxt.trim()) return [];
    try {
      return reconcileEcfVsPrior(parseEcfPriorTxt(priorTxt), maps);
    } catch {
      return [];
    }
  }, [priorTxt, maps]);

  const elalurDiffNote = useMemo(() => {
    if (!elalur) return null;
    const empty = emptyElalur({
      workspaceId,
      companyId,
      periodKey: elalur.periodKey,
      version: 0,
    });
    return diffElalur(empty, elalur).impactSummary;
  }, [elalur, workspaceId, companyId]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cockpit ECF</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Recuperação ECD/ledger, mapper referencial, e-Lalur e geração assistida. IRPJ gated:{" "}
          <Badge>{isEcfIrpjEngineEnabled() ? "ON" : "OFF"}</Badge>
        </p>
        <div className="flex gap-3 mt-1 text-sm">
          <Link href="/app/ledger" className="text-sky-300 hover:underline">
            Motor contábil →
          </Link>
          <Link href="/app/obligations/ecf" className="text-sky-300 hover:underline">
            Assistente ECF →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresa / período</CardTitle>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapper conta × referencial</CardTitle>
          <CardDescription>
            {orphans.length} órfã(s). Sugestões do prior exigem confirmação humana.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Conta contábil"
              value={mapCode}
              onChange={(e) => {
                setMapCode(e.target.value);
                const acc = accounts.find((a) => a.code === e.target.value);
                if (acc) {
                  const s = suggestReferentialForAccount(acc, maps);
                  if (s.suggested) setMapRef(s.suggested);
                }
              }}
            />
            <Input
              placeholder="Conta referencial"
              value={mapRef}
              onChange={(e) => setMapRef(e.target.value)}
            />
            <Button type="button" onClick={() => void confirmSelectedMap()}>
              Confirmar mapa
            </Button>
          </div>
          <ul className="text-sm text-slate-400 space-y-1 max-h-40 overflow-auto">
            {orphans.slice(0, 20).map((o) => (
              <li key={o.accountCode}>
                {o.accountCode} — {o.name} ({o.reason})
              </li>
            ))}
          </ul>
          <ul className="text-sm space-y-1">
            {maps.filter((m) => m.confirmedAt).map((m) => (
              <li key={m.id}>
                ✓ {m.accountCode} → {m.referentialCode}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabelas dinâmicas / referencial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-[100px] rounded-md border border-slate-700 bg-slate-950 p-2 text-sm font-mono"
            value={refCsv}
            onChange={(e) => setRefCsv(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={() => void importRefs()}>
            Importar CSV referencial
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ECF anterior (canônico)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-[100px] rounded-md border border-slate-700 bg-slate-950 p-2 text-sm font-mono"
            placeholder="Cole TXT ECF prior…"
            value={priorTxt}
            onChange={(e) => setPriorTxt(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={() => void importPrior()}>
            Importar prior → sugestões
          </Button>
          {priorFindings.slice(0, 8).map((f) => (
            <p key={f.code + f.message} className="text-xs text-amber-200/80">
              [{f.severity}] {f.message}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>e-Lalur / e-Lacs</CardTitle>
          <CardDescription>{elalurDiffNote || "Sem versão gravada"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button type="button" onClick={() => void seedElalur()}>
            Adicionar linha Parte A (manual)
          </Button>
          <p className="text-sm text-slate-400">
            {elalur
              ? `v${elalur.version} · ${elalur.partA.length} Parte A · ${elalur.partB.length} Parte B · hash ${elalur.contentHash?.slice(0, 12) || "—"}`
              : "Nenhuma snapshot"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conciliação / gerar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {findings.slice(0, 12).map((f) => (
            <p key={f.code + f.message} className="text-xs text-slate-300">
              [{f.severity}] {f.message}
            </p>
          ))}
          <Button type="button" disabled={busy} onClick={() => void generateEcf()}>
            Gerar ECF (oficial / ledger)
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
