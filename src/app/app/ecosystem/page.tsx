"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listRoleBindings, saveRoleBinding } from "@/lib/store/governance";
import {
  listPartnerInvites,
  listSloSamples,
  savePartnerInvite,
  savePartnerLink,
  saveSloSample,
} from "@/lib/store/ecosystem";
import { bindRole } from "@/modules/governance/rbac";
import {
  SLO_DEFINITIONS,
  computeErrorBudget,
  computeSloSnapshot,
  recordSloSample,
  seedStagingApiStatusSamples,
  slaLinkageNotes,
} from "@/modules/ecosystem/slo";
import { exportPrometheusText, startSpan, endSpan, listSpans } from "@/modules/ecosystem/otel-hooks";
import { buildSloAlert } from "@/modules/ecosystem/slo-alerts";
import {
  acceptPartnerInvite,
  assertPartnerCannotTransmit,
  createPartnerInvite,
  partnerMayPrepare,
  whiteLabelCommercialRow,
} from "@/modules/ecosystem/partners";
import {
  createTotvsLivePilotAdapter,
  fetchTotvsLiveHttpMinimal,
  runTotvsLivePilotGolden,
} from "@/modules/ecosystem/totvs-live-pilot";
import {
  ECOSYSTEM_PLATFORM_MATURITY,
  ecosystemHealth,
  section28Phase14Report,
} from "@/modules/ecosystem/platform";
import { assertCatalogSafe } from "@/modules/continuous-ops/erp/registry";
import type { PartnerInvite } from "@/modules/ecosystem/types";

export default function EcosystemPage() {
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [tenantId, setTenantId] = useState("tenant_local");
  const [email, setEmail] = useState("contador@parceiro.example");
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [prom, setProm] = useState("");
  const [sloTxt, setSloTxt] = useState("");
  const [totvsTxt, setTotvsTxt] = useState("");
  const [section28, setSection28] = useState("");

  const refresh = useCallback(async () => {
    setInvites(await listPartnerInvites(tenantId));
    const samples = await listSloSamples();
    const snap = computeSloSnapshot("api_status_availability", samples);
    const budget = computeErrorBudget(snap);
    setSloTxt(
      samples.length
        ? `api_status n=${snap.sampleCount} avail=${snap.availabilityPct?.toFixed(1)}% meets=${snap.meetsTarget} budget_rem=${budget.remainingPct.toFixed(0)}%`
        : "sem samples — rode seed staging",
    );
  }, [tenantId]);

  useEffect(() => {
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
      const bindings = await listRoleBindings(ws);
      if (!bindings.some((b) => b.role === "owner")) {
        await saveRoleBinding(bindRole({ workspaceId: ws, userId: "user_owner", role: "owner" }));
      }
      await refresh();
    })();
  }, [refresh]);

  const health = ecosystemHealth();

  async function seedSlo() {
    const span = startSpan("slo.seed_staging", "internal", { phase: 14 });
    const samples = seedStagingApiStatusSamples(20);
    for (const s of samples) await saveSloSample(s);
    endSpan(span, { count: samples.length });
    const snap = computeSloSnapshot("api_status_availability", samples);
    const budget = computeErrorBudget(snap);
    setProm(
      exportPrometheusText({
        snapshots: SLO_DEFINITIONS.map((d) => computeSloSnapshot(d.id, samples)),
        samples,
      }),
    );
    const alert = buildSloAlert({ workspaceId, snap, budget });
    toast.success(
      alert
        ? `SLO seed + alerta: ${alert.body.slice(0, 80)}`
        : `SLO seed ok spans=${listSpans(5).length}`,
    );
    await refresh();
  }

  async function recordOne() {
    const s = recordSloSample({
      sloId: "api_latency_p95",
      success: true,
      latencyMs: 120,
    });
    await saveSloSample(s);
    await refresh();
  }

  async function invitePartner() {
    const bindings = await listRoleBindings(workspaceId);
    try {
      const inv = createPartnerInvite({
        tenantId,
        hostWorkspaceId: workspaceId,
        partnerEmail: email,
        whiteLabelPreview: true,
        actorBindings: bindings,
        actorUserId: "user_owner",
      });
      await savePartnerInvite(inv);
      toast.success(`Convite ${inv.id}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  async function acceptFirst() {
    const inv = invites.find((i) => i.status === "pending");
    if (!inv) {
      toast.message("Sem convite pending");
      return;
    }
    const { invite, link, binding } = acceptPartnerInvite({
      invite: inv,
      partnerUserId: "user_partner",
      partnerWorkspaceId: "ws_partner",
    });
    await savePartnerInvite(invite);
    await savePartnerLink(link);
    await saveRoleBinding(binding);
    try {
      assertPartnerCannotTransmit({
        bindings: [binding],
        workspaceId,
        userId: "user_partner",
      });
      toast.success(
        `Aceito · prepare=${partnerMayPrepare({ bindings: [binding], workspaceId, userId: "user_partner" })} · ${whiteLabelCommercialRow(true).banner.slice(0, 60)}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
    await refresh();
  }

  function runTotvs() {
    const g = runTotvsLivePilotGolden();
    const a = createTotvsLivePilotAdapter();
    setTotvsTxt(
      `golden=${g.ok} live=${a.liveConnectionEnabled} catalogSafe=${assertCatalogSafe()}`,
    );
    toast.success(g.ok ? "TOTVS golden OK" : "falhou");
  }

  async function tryHttp() {
    try {
      const r = await fetchTotvsLiveHttpMinimal();
      toast.success(r.detail);
    } catch (e) {
      toast.message(e instanceof Error ? e.message : "bloqueado");
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ecosystem · Fase 14</h1>
          <p className="text-muted-foreground text-sm">
            maturidade <Badge tone="info">{ECOSYSTEM_PLATFORM_MATURITY}</Badge> · SLO ·
            parceiros · TOTVS live+
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/scale"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Scale
          </Link>
          <Link
            href="/app/governance"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Governança
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>
            stagingSlo={String(health.stagingApiSloMeets)} · totvsGolden=
            {String(health.totvsGoldenOk)} · prod={String(health.anyObligationProduction)}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          SLA link: {slaLinkageNotes()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SLOs & OTel</CardTitle>
          <CardDescription>Samples staging · Prometheus text · alertas sanitizados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void seedSlo()}>Seed SLO staging</Button>
            <Button variant="secondary" onClick={() => void recordOne()}>
              Sample latência
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSection28(section28Phase14Report());
                toast.success("§28 fase 14");
              }}
            >
              §28
            </Button>
          </div>
          <p className="text-sm">{sloTxt}</p>
          {prom ? (
            <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">{prom}</pre>
          ) : null}
          {section28 ? (
            <pre className="bg-muted max-h-36 overflow-auto rounded-md p-3 text-xs">{section28}</pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parceiros contábeis</CardTitle>
          <CardDescription>partner_auditor · read/prepare · sem transmit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => void invitePartner()}>Convidar</Button>
              <Button variant="secondary" onClick={() => void acceptFirst()}>
                Aceitar 1º
              </Button>
            </div>
          </div>
          <ul className="text-sm space-y-1">
            {invites.map((i) => (
              <li key={i.id}>
                <Badge>{i.status}</Badge> {i.partnerEmail} · wl={String(i.whiteLabelPreview)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TOTVS live+</CardTitle>
          <CardDescription>XFI_ALLOW_LIVE_ERP + XFI_TOTVS_ACCESS_TOKEN · HTTP via XFI_ERP_HTTP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={runTotvs}>Golden TOTVS</Button>
            <Button variant="outline" onClick={() => void tryHttp()}>
              HTTP mínimo
            </Button>
          </div>
          {totvsTxt ? <p className="text-sm">{totvsTxt}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
