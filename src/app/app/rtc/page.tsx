"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listCompanies } from "@/lib/store/local-cadastro";
import { listContribEntries } from "@/lib/store/contrib";
import { listRtcFacts, saveRtcFact } from "@/lib/store/rtc";
import type { RtcFact } from "@/modules/rtc/types";
import { resolveRtcPeriodSplit } from "@/modules/rtc/period";
import { cataloguedRtcImpacts } from "@/modules/rtc/rule-sets";
import { extractRtcFactsFromXml } from "@/modules/rtc/extract";
import { detectRtcReadiness } from "@/modules/rtc/readiness";
import { reconcileRtcVsContribCredits } from "@/modules/rtc/dual-contrib";
import { simulateRtcImpact, isRtcSimulatorEnabled } from "@/modules/rtc/simulator";
import { RTC_MODULE_MATURITY, RTC_SUPPORT_PROFILE } from "@/modules/rtc/maturity";
import { isHomologationGradeRtcRun } from "@/modules/rtc/homologation";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default function RtcCockpitPage() {
  const [companyId, setCompanyId] = useState("co_rtc");
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [periodKey, setPeriodKey] = useState("2026-03");
  const [facts, setFacts] = useState<RtcFact[]>([]);
  const [taxAmount, setTaxAmount] = useState("100,00");
  const [legacyCredit, setLegacyCredit] = useState("20,00");
  const [xmlSample, setXmlSample] = useState(
    `<NFe><infNFe><imposto><vCBS>50.00</vCBS><pIBS></pIBS></imposto></infNFe></NFe>`,
  );
  const [extractLog, setExtractLog] = useState("");

  const refresh = useCallback(async () => {
    setFacts(await listRtcFacts({ companyId, periodKey }));
  }, [companyId, periodKey]);

  useEffect(() => {
    void (async () => {
      const cos = await listCompanies();
      if (cos[0]) setCompanyId(cos[0].id);
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") localStorage.setItem("xfi:workspace-id", ws);
      setWorkspaceId(ws);
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const profile = resolveRtcPeriodSplit(periodKey);
  const readiness = useMemo(
    () =>
      detectRtcReadiness({
        periodKey,
        snapshot: { facts, periodKey, split: profile.split },
      }),
    [facts, periodKey, profile.split],
  );

  async function addManualCbs() {
    const now = new Date().toISOString();
    await saveRtcFact({
      id: `rtc_cbs_${Date.now()}`,
      workspaceId,
      companyId,
      periodKey,
      split: profile.split,
      taxKind: "CBS",
      taxAmountExplicit: taxAmount,
      creditExplicit: false,
      origin: "manual",
      sourceId: "official:reforma:consumo-2026",
      lineageNote: "manual lab — valor explícito informado pelo usuário",
      createdAt: now,
      updatedAt: now,
    });
    toast.success("Fato CBS gravado (valor explícito)");
    await refresh();
  }

  function runExtract() {
    const flattened: Record<string, string> = {};
    const mCbs = xmlSample.match(/<vCBS>([^<]*)<\/vCBS>/i);
    if (mCbs) flattened.vCBS = mCbs[1] || "";
    const mPibs = xmlSample.match(/<pIBS>([^<]*)<\/pIBS>/i);
    if (mPibs) flattened.pIBS = mPibs[1] || "";
    const out = extractRtcFactsFromXml({
      workspaceId,
      companyId,
      periodKey,
      documentRef: "demo_xml",
      rawXml: xmlSample,
      flattened,
    });
    setExtractLog(
      JSON.stringify(
        {
          parsingEnabled: out.parsingEnabled,
          observation: out.observation,
          facts: out.facts.map((f) => ({
            kind: f.taxKind,
            rate: f.rateExplicit,
            tax: f.taxAmountExplicit,
            note: f.lineageNote,
          })),
          warnings: out.warnings,
        },
        null,
        2,
      ),
    );
  }

  async function persistExtract() {
    const flattened: Record<string, string> = {};
    const mCbs = xmlSample.match(/<vCBS>([^<]*)<\/vCBS>/i);
    if (mCbs) flattened.vCBS = mCbs[1] || "";
    const out = extractRtcFactsFromXml({
      workspaceId,
      companyId,
      periodKey,
      rawXml: xmlSample,
      flattened,
    });
    for (const f of out.facts) await saveRtcFact(f);
    toast.success(`${out.facts.length} fato(s) do XML`);
    await refresh();
  }

  const sim = useMemo(
    () =>
      simulateRtcImpact(
        { facts, periodKey, split: profile.split },
        { forceEnable: true, legacyCreditAmount: legacyCredit },
      ),
    [facts, periodKey, profile.split, legacyCredit],
  );

  const recon = useMemo(() => {
    return reconcileRtcVsContribCredits({
      periodKey,
      rtcFacts: facts,
      contribEntries: [],
    });
  }, [periodKey, facts]);

  const grade = isHomologationGradeRtcRun({
    contentHash: "ab".repeat(16),
    programVersion: "n/a",
    resultStatus: "unknown",
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">RTC · CBS / IBS / CRTB</h1>
        <p className="text-slate-400 mt-1 text-sm">
          {RTC_SUPPORT_PROFILE.label} · maturidade{" "}
          <Badge>{RTC_MODULE_MATURITY}</Badge> · parsing{" "}
          <Badge>{isFeatureEnabled("rtcParsing") ? "ON" : "OFF"}</Badge> · sim{" "}
          <Badge>{isRtcSimulatorEnabled() ? "ON" : "OFF"}</Badge>
        </p>
        <div className="flex gap-3 mt-1 text-sm">
          <Link href="/app/contrib" className="text-sky-300 hover:underline">
            Contribuições (preservadas) →
          </Link>
          <Link href="/app/ops" className="text-sky-300 hover:underline">
            Ops →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Período / split</CardTitle>
          <CardDescription>
            {profile.split} · {profile.sourceId} · hint Contrib: {profile.contribModeHint}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Company</Label>
            <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Competência (YYYY-MM)</Label>
            <Input value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
          </div>
          <ul className="md:col-span-2 text-xs text-slate-400 space-y-1">
            {profile.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {readiness.items.map((i) => (
            <p key={i.id}>
              [{i.status}] {i.label}: {i.message}
            </p>
          ))}
          <p className="text-slate-500">canMaterializeLab={String(readiness.canMaterializeLab)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fatos (valores explícitos)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <Input value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="vCBS" />
            <Button type="button" onClick={() => void addManualCbs()}>
              Gravar CBS explícito
            </Button>
          </div>
          <ul className="text-sm space-y-1 max-h-40 overflow-auto">
            {facts.map((f) => (
              <li key={f.id}>
                {f.taxKind} · tax={f.taxAmountExplicit || "—"} · rate={f.rateExplicit || "—"} ·{" "}
                {f.origin}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>XML → fatos (honesto)</CardTitle>
          <CardDescription>pIBS vazio ⇒ sem alíquota inventada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-[80px] rounded-md border border-slate-700 bg-slate-950 p-2 text-sm font-mono"
            value={xmlSample}
            onChange={(e) => setXmlSample(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={runExtract}>
              Observar / extrair
            </Button>
            <Button type="button" onClick={() => void persistExtract()}>
              Persistir fatos extraídos
            </Button>
          </div>
          {extractLog ? (
            <pre className="text-xs max-h-48 overflow-auto border border-slate-800 p-2 rounded whitespace-pre-wrap">
              {extractLog}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dualidade × Contrib</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          {recon.findings.map((f) => (
            <p key={f.code + f.message}>
              [{f.severity}] {f.message}
            </p>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const ce = await listContribEntries({ companyId, periodKey });
              const r = reconcileRtcVsContribCredits({
                periodKey,
                rtcFacts: facts,
                contribEntries: ce,
              });
              toast.message(`recon ok=${r.ok} findings=${r.findings.length}`);
            }}
          >
            Reconciliar com créditos Contrib no IDB
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulador (lab forceEnable)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={legacyCredit}
            onChange={(e) => setLegacyCredit(e.target.value)}
            placeholder="Crédito Contrib informado"
          />
          {sim.scenarios.map((s) => (
            <p key={s.id} className="text-sm">
              {s.id}: líquido {s.netEstimate} (CBS {s.cbsDebit} / IBS {s.ibsDebit})
            </p>
          ))}
          {sim.warnings.map((w) => (
            <p key={w} className="text-xs text-amber-200/80">
              {w}
            </p>
          ))}
          <p className="text-xs text-slate-500">homologationGrade (unknown)={String(grade)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NTs catalogadas</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-400 space-y-1">
          {cataloguedRtcImpacts(`${periodKey}-01`).map((t) => (
            <p key={t}>{t}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
