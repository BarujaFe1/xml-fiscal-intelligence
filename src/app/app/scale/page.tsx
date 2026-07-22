"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listScenarios } from "@/lib/store/homologation";
import { listListings } from "@/lib/store/enterprise";
import { saveQuotaPolicy } from "@/lib/store/continuous-ops";
import {
  getWorkspacePlan,
  listDrills,
  listFindings,
  listMassCampaigns,
  listMeterSamples,
  saveDrill,
  saveFinding,
  saveMassCampaign,
  saveMeterSample,
  saveWorkspacePlan,
} from "@/lib/store/scale";
import {
  backupRestoreProcedureMarkdown,
  createDrDrill,
  defaultDrTargets,
  drTargetsMarkdown,
  executeDrDrill,
} from "@/modules/scale/dr";
import { persistenceInventoryMarkdown } from "@/modules/scale/persistence";
import { regionalHealthReport } from "@/modules/scale/regions";
import {
  billingEnterpriseEnabled,
  listPlanCatalog,
  quotaPolicyForPlan,
  resolvePlanId,
} from "@/modules/scale/billing-plans";
import { aggregateMeterSamples, recordMeterSample } from "@/modules/scale/metering";
import {
  aggregateSection28Campaign,
  attachScenarioIds,
  buildCoverageDashboard,
  createMassCampaign,
  enqueueFromMarketplace,
  tryCompleteMassCampaign,
} from "@/modules/scale/mass-campaigns";
import {
  createPenTestFinding,
  residualRisksMarkdown,
  resolveSecretsManagerMode,
  triageFinding,
} from "@/modules/scale/hardening";
import {
  SCALE_PLATFORM_MATURITY,
  scaleHealth,
  section28Phase13Report,
} from "@/modules/scale/platform";
import type { EnterprisePlanId, MassCampaign, RegionHealth } from "@/modules/scale/types";

export default function ScalePage() {
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [tenantId, setTenantId] = useState("tenant_local");
  const [planId, setPlanId] = useState<EnterprisePlanId>("starter");
  const [campaigns, setCampaigns] = useState<MassCampaign[]>([]);
  const [drMd, setDrMd] = useState("");
  const [meterTxt, setMeterTxt] = useState("");
  const [coverageTxt, setCoverageTxt] = useState("");
  const [section28, setSection28] = useState("");
  const [ufs, setUfs] = useState("SP,RJ,MG");
  /** Estável no SSR — env server-only não bate com client (hydration #418) */
  const [secretsMode, setSecretsMode] = useState("env_only");
  const [billingLiveFlag, setBillingLiveFlag] = useState(false);
  /** Computado só no cliente (useEffect) para evitar mismatch de hidratação (#418). */
  const [regions, setRegions] = useState<RegionHealth[]>([]);
  const [health, setHealth] = useState<ReturnType<typeof scaleHealth> | null>(null);

  const refresh = useCallback(async () => {
    setCampaigns(await listMassCampaigns(workspaceId));
    const plan = await getWorkspacePlan(workspaceId);
    if (plan) setPlanId(plan.planId);
    const scns = await listScenarios(workspaceId);
    const dash = buildCoverageDashboard(scns);
    setCoverageTxt(
      dash.slice(0, 12).map((c) => `${c.obligationId}/${c.uf}: vs=${c.validatedScopeCount} relab=${c.pendingRelab}`).join(" · ") ||
        "sem células",
    );
  }, [workspaceId]);

  useEffect(() => {
    setSecretsMode(resolveSecretsManagerMode());
    setBillingLiveFlag(billingEnterpriseEnabled());
    setRegions(regionalHealthReport());
    setHealth(scaleHealth());
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("xfi:workspace-id", ws);
        setTenantId(localStorage.getItem("xfi:tenant-id") || "tenant_local");
      }
      setWorkspaceId(ws);
      await refresh();
    })();
  }, [refresh]);

  async function runStagingDrill() {
    let drill = createDrDrill({
      regionId: "gru",
      environment: "staging",
      notes: "Fase 13 staging failover synth",
    });
    drill = executeDrDrill(drill, "executed", "restore OK synth");
    await saveDrill(drill);
    setDrMd(
      [
        drTargetsMarkdown(defaultDrTargets()),
        "",
        persistenceInventoryMarkdown(),
        "",
        backupRestoreProcedureMarkdown(),
        "",
        `Drill ${drill.id} evidence=${drill.countsAsEvidence}`,
      ].join("\n"),
    );
    toast.success("DR drill staging executado");
  }

  async function applyPlan() {
    const id = resolvePlanId(planId);
    await saveWorkspacePlan({
      workspaceId,
      planId: id,
      updatedAt: new Date().toISOString(),
    });
    const policy = quotaPolicyForPlan(workspaceId, id);
    await saveQuotaPolicy(policy);
    toast.success(`Plano ${id} → quotas aplicadas`);
  }

  async function bumpMeter() {
    const sample = recordMeterSample({
      workspaceId,
      generations: 1,
      apiCalls: 3,
      evidenceStorageMb: 12,
    });
    await saveMeterSample(sample);
    const samples = await listMeterSamples(workspaceId);
    const snap = aggregateMeterSamples(workspaceId, planId, samples);
    setMeterTxt(
      `${snap.periodKey} gen=${snap.generations} api=${snap.apiCalls} storage=${snap.evidenceStorageMb}MB within=${snap.withinPlanLimits} billingFlag=${billingEnterpriseEnabled()}`,
    );
    toast.success("Meter sample");
  }

  async function seedMassCampaign() {
    const targetUfs = ufs.split(",").map((s) => s.trim()).filter(Boolean);
    let camp = createMassCampaign({
      tenantId,
      workspaceId,
      title: `ICMS multi-UF ${targetUfs.join("-")}`,
      obligationId: "efd-icms-ipi",
      targetUfs,
      notes: "campanha massiva F13",
    });
    const listings = await listListings(tenantId);
    camp = enqueueFromMarketplace(camp, listings);
    const scns = await listScenarios(workspaceId);
    camp = attachScenarioIds(
      camp,
      scns.filter((s) => s.obligationId === "efd-icms-ipi").map((s) => s.id),
    );
    camp = tryCompleteMassCampaign(camp, scns, 1);
    await saveMassCampaign(camp);
    setSection28(aggregateSection28Campaign(camp, scns));
    toast.success(`Campanha ${camp.status}`);
    await refresh();
  }

  async function addFinding() {
    let f = createPenTestFinding({
      title: "Exemplo: rate limit API ausente em rota X",
      severity: "medium",
      residualRisk: "mitigar na próxima janela",
    });
    f = triageFinding(f, "triaged");
    await saveFinding(f);
    const all = await listFindings();
    toast.message(residualRisksMarkdown(all).slice(0, 120));
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scale · Fase 13</h1>
          <p className="text-muted-foreground text-sm">
            maturidade <Badge tone="info">{SCALE_PLATFORM_MATURITY}</Badge> · DR draft · billing
            metering · campanhas massivas
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/enterprise"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Enterprise
          </Link>
          <Link
            href="/app/billing"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Planos
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>
            persist={health?.persistenceItems ?? "—"} · regions={health?.regionsReachable ?? "—"} · secrets=
            {secretsMode} · prod=
            {String(health?.anyObligationProduction ?? "—")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <ul>
            {regions.map((r) => (
              <li key={r.regionId}>
                <Badge>{r.reachable ? "up" : "degraded"}</Badge> {r.label} ~{r.latencyMsEstimate ?? "—"}ms
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">Cobertura: {coverageTxt}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DR · multi-região</CardTitle>
          <CardDescription>
            RPO {defaultDrTargets().rpoHours}h / RTO {defaultDrTargets().rtoHours}h — fora PVA/RFB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => void runStagingDrill()}>Executar drill staging</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSection28(section28Phase13Report());
              toast.success("§28 fase 13");
            }}
          >
            Relatório §28
          </Button>
          {drMd ? (
            <pre className="bg-muted max-h-56 overflow-auto rounded-md p-3 text-xs">{drMd}</pre>
          ) : null}
          {section28 ? (
            <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">{section28}</pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing enterprise</CardTitle>
          <CardDescription>
            Flag Stripe live={String(billingLiveFlag)} · quotas → continuous-ops
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>plano</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={planId}
                onChange={(e) => setPlanId(resolvePlanId(e.target.value))}
              >
                {listPlanCatalog().map((p) => (
                  <option key={p.planId} value={p.planId}>
                    {p.planId} (gen {p.maxGenerationsPerHour}/h)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => void applyPlan()}>Aplicar quotas</Button>
              <Button variant="secondary" onClick={() => void bumpMeter()}>
                Meter +1
              </Button>
            </div>
          </div>
          {meterTxt ? <p className="text-sm">{meterTxt}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas massivas</CardTitle>
          <CardDescription>Multi-UF · re-lab queue · sem promote global</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>UFs (vírgula)</Label>
            <Input value={ufs} onChange={(e) => setUfs(e.target.value)} />
          </div>
          <Button onClick={() => void seedMassCampaign()}>Criar / sync campanha ICMS</Button>
          <ul className="text-sm space-y-1">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Badge>{c.status}</Badge> {c.title} · queue={c.relabQueue.length}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hardening</CardTitle>
          <CardDescription>Pen-test triage + secrets mode</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void addFinding()}>
            Triage finding exemplo
          </Button>
          <Button
            variant="ghost"
            className="ml-2"
            onClick={async () => {
              const n = (await listDrills()).length;
              toast.message(`${n} drills salvos`);
            }}
          >
            Contar drills
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
