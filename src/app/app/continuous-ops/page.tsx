"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listClosingCards } from "@/lib/store/closing-cockpit";
import { listScenarios } from "@/lib/store/homologation";
import {
  getQuotaPolicy,
  getUsage,
  listNtItems,
  saveNtItem,
  saveQuotaPolicy,
  saveUsage,
} from "@/lib/store/continuous-ops";
import { listRegisteredAdapters } from "@/modules/continuous-ops/erp/registry";
import { runPilotGoldenPreview, pilotSynthAdapter } from "@/modules/continuous-ops/erp/pilot";
import {
  assertWithinQuota,
  bumpUsage,
  defaultQuotaPolicy,
  filterByCompanyScope,
  hourBucket,
} from "@/modules/continuous-ops/multi-company";
import {
  advanceNtStatus,
  assertNeverAutoActivated,
  createNtInboxItem,
  diffImpactManifest,
  seedNtFromOfficialSource,
} from "@/modules/continuous-ops/nt-inbox";
import {
  checkRehomologation,
  exportSection28Pack,
} from "@/modules/continuous-ops/rehomologation";
import {
  summarizeTelemetry,
  telemetryPanel,
  buildWebhookAlert,
} from "@/modules/continuous-ops/observability";
import {
  CONTINUOUS_OPS_MATURITY,
  continuousOpsHealth,
} from "@/modules/continuous-ops/platform";
import { recordOpsEvent } from "@/modules/ops/telemetry";
import type { NtInboxItem } from "@/modules/continuous-ops/types";

export default function ContinuousOpsPage() {
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [companyFilter, setCompanyFilter] = useState("");
  const [estFilter, setEstFilter] = useState("");
  const [cardsCount, setCardsCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [ntItems, setNtItems] = useState<NtInboxItem[]>([]);
  const [section28, setSection28] = useState("");
  const [pilotResult, setPilotResult] = useState("");
  const [quotaMsg, setQuotaMsg] = useState("");

  const refresh = useCallback(async () => {
    const cards = await listClosingCards(workspaceId);
    setCardsCount(cards.length);
    const filtered = filterByCompanyScope(
      cards.map((c) => ({
        ...c,
        companyId: c.companyId,
        establishmentId: c.establishmentId,
      })),
      {
        workspaceId,
        companyId: companyFilter || undefined,
        establishmentId: estFilter || undefined,
      },
    );
    setFilteredCount(filtered.length);
    setNtItems(await listNtItems(workspaceId));
  }, [workspaceId, companyFilter, estFilter]);

  useEffect(() => {
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") localStorage.setItem("xfi:workspace-id", ws);
      setWorkspaceId(ws);
      const policy = (await getQuotaPolicy(ws)) || defaultQuotaPolicy(ws);
      await saveQuotaPolicy(policy);
      await refresh();
    })();
  }, [refresh]);

  const adapters = listRegisteredAdapters();
  const health = continuousOpsHealth();
  const telemetry = telemetryPanel(20);
  const telSummary = summarizeTelemetry(telemetry);
  const rehomo = useMemo(() => {
    return [];
  }, []);

  function runPilot() {
    const r = runPilotGoldenPreview();
    setPilotResult(`ok=${r.ok} rows=${r.okCount} vendor=${r.vendorId}`);
    toast.success(r.ok ? "Golden piloto OK" : "Golden falhou");
  }

  async function bumpGenQuota() {
    const policy = (await getQuotaPolicy(workspaceId)) || defaultQuotaPolicy(workspaceId);
    let usage = (await getUsage(workspaceId)) || {
      workspaceId,
      generationsThisHour: 0,
      apiCallsThisHour: 0,
      hourBucket: hourBucket(),
    };
    const gate = assertWithinQuota(policy, usage, "generation");
    if (!gate.ok) {
      setQuotaMsg(gate.reason || "quota");
      toast.error(gate.reason);
      return;
    }
    usage = { workspaceId, ...bumpUsage(usage, "generation") };
    await saveUsage(usage);
    setQuotaMsg(`gerações ${usage.generationsThisHour}/${policy.maxGenerationsPerHour}`);
  }

  async function addNt() {
    const item = seedNtFromOfficialSource({
      workspaceId,
      sourceId: "official:efd-contribuicoes:nt-11-2026",
      title: "NT 11/2026 — impact assessment",
      obligationId: "efd-contribuicoes",
    });
    await saveNtItem(item);
    toast.success("NT identified");
    await refresh();
  }

  async function advanceFirstNt() {
    const item = ntItems.find((i) => i.status === "identified");
    if (!item) {
      toast.error("Sem NT identified");
      return;
    }
    let next = advanceNtStatus(item, "impact_assessment", {
      impactManifest: [
        ...item.impactManifest,
        "Preservar historical_and_credit_management",
        "Não misturar RTC em Bloco M",
      ],
    });
    next = advanceNtStatus(next, "draft_rule_set", {
      draftRuleSetCode: "NT_11_2026_DRAFT",
    });
    next = advanceNtStatus(next, "awaiting_fixture");
    await saveNtItem(next);
    toast.success("NT → awaiting_fixture (activated=false)");
    await refresh();
  }

  async function export28() {
    const scns = await listScenarios(workspaceId);
    const scn = scns[0];
    if (!scn) {
      toast.error("Sem cenários em homologação");
      return;
    }
    const check = checkRehomologation(scn);
    const pack = exportSection28Pack(scn);
    setSection28(`${check.action} age=${check.evidenceAgeDays}d\n\n${pack.markdown}`);
  }

  function sendAlert() {
    try {
      const n = buildWebhookAlert({
        workspaceId,
        title: "Falha de lab",
        rawBody: "Erro geração CNPJ 11222333000181 <?xml?>",
      });
      recordOpsEvent("notification", n.body);
      toast.success(`Webhook sanitizado: ${n.body}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  const impactDiff = useMemo(() => {
    const item = ntItems[0];
    if (!item) return null;
    return diffImpactManifest([], item.impactManifest);
  }, [ntItems]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operação contínua</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Fase 10 · <Badge>{CONTINUOUS_OPS_MATURITY}</Badge> · piloto golden=
          {String(health.pilotGoldenOk)} · sem claim production
        </p>
        <div className="flex gap-3 mt-1 text-sm">
          <Link href="/app/closing" className="text-sky-300 hover:underline">
            Closing →
          </Link>
          <Link href="/app/homologation" className="text-sky-300 hover:underline">
            Homologação →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adapters ERP nomeados</CardTitle>
          <CardDescription>{adapters.length} registrados · live=false</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {adapters.map((a) => (
            <p key={a.vendorId}>
              {a.displayName} · {a.maturity} · nda={String(a.ndaRequired)}
            </p>
          ))}
          <Button type="button" onClick={runPilot}>
            Rodar golden piloto ({pilotSynthAdapter.vendorId})
          </Button>
          <p className="text-xs text-slate-400">{pilotResult}</p>
          <pre className="text-xs max-h-24 overflow-auto border border-slate-800 p-2 rounded">
            {pilotSynthAdapter.syntheticFixtureCsv()}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Multi-empresa / quotas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Filtro companyId</Label>
            <Input value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Filtro establishmentId</Label>
            <Input value={estFilter} onChange={(e) => setEstFilter(e.target.value)} />
          </div>
          <p className="text-sm md:col-span-2">
            Closing cards: {cardsCount} · filtrados: {filteredCount}
          </p>
          <Button type="button" variant="secondary" onClick={() => void bumpGenQuota()}>
            Consumir quota geração
          </Button>
          <p className="text-xs text-slate-400">{quotaMsg}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inbox NTs</CardTitle>
          <CardDescription>
            neverAutoActivated={String(assertNeverAutoActivated(ntItems))} ·{" "}
            {impactDiff?.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button type="button" onClick={() => void addNt()}>
              Seed NT
            </Button>
            <Button type="button" variant="secondary" onClick={() => void advanceFirstNt()}>
              Avançar até awaiting_fixture
            </Button>
          </div>
          <ul className="text-xs space-y-1">
            {ntItems.map((i) => (
              <li key={i.id}>
                {i.status} · {i.title} · activated={String(i.ruleSetActivated)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Re-homologação / §28</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button type="button" onClick={() => void export28()}>
            Export pacote §28 (1º cenário)
          </Button>
          {section28 ? (
            <pre className="text-xs max-h-48 overflow-auto border border-slate-800 p-2 rounded whitespace-pre-wrap">
              {section28}
            </pre>
          ) : null}
          {rehomo.length ? <p>{rehomo.length} checks</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telemetria</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <p>{JSON.stringify(telSummary)}</p>
          <Button type="button" variant="secondary" onClick={sendAlert}>
            Alerta webhook sanitizado
          </Button>
          <ul className="max-h-32 overflow-auto">
            {telemetry.slice(0, 8).map((e) => (
              <li key={e.id}>
                {e.kind}: {e.detail}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
