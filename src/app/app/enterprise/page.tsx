"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listScenarios, saveScenario } from "@/lib/store/homologation";
import {
  getLegalStatus,
  listListings,
  saveLegalStatus,
  saveListing,
} from "@/lib/store/enterprise";
import { CONTROL_MATRIX, controlMatrixSummary } from "@/modules/enterprise/controls";
import {
  binderToMarkdown,
  buildEvidenceBinder,
} from "@/modules/enterprise/evidence-binder";
import {
  importListingWithRelab,
  listPublishedForTenant,
  publishScenarioListing,
} from "@/modules/enterprise/marketplace";
import { listGoldenVersions } from "@/modules/enterprise/golden-versions";
import {
  createOmieLivePilotAdapter,
  runOmieLivePilotGolden,
} from "@/modules/enterprise/erp-live-pilot";
import {
  applyLegalMilestones,
  defaultLegalStatus,
} from "@/modules/enterprise/legal-status";
import {
  ENTERPRISE_PLATFORM_MATURITY,
  enterpriseHealth,
  section28Phase12Report,
} from "@/modules/enterprise/platform";
import { assertCatalogSafe } from "@/modules/continuous-ops/erp/registry";
import type { MarketplaceListing } from "@/modules/enterprise/types";

export default function EnterprisePage() {
  const [tenantId, setTenantId] = useState("tenant_local");
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [binderMd, setBinderMd] = useState("");
  const [legalTxt, setLegalTxt] = useState("");
  const [omieTxt, setOmieTxt] = useState("");

  const refresh = useCallback(async () => {
    setListings(await listListings(tenantId));
    const legal = (await getLegalStatus(tenantId)) || {
      tenantId,
      ...defaultLegalStatus(),
    };
    setLegalTxt(`dpa=${legal.dpa} sla=${legal.sla} soc2=${legal.soc2Certified}`);
  }, [tenantId]);

  useEffect(() => {
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("xfi:workspace-id", ws);
        const t = localStorage.getItem("xfi:tenant-id") || "tenant_local";
        localStorage.setItem("xfi:tenant-id", t);
        setTenantId(t);
      }
      setWorkspaceId(ws);
      await refresh();
    })();
  }, [refresh]);

  const health = enterpriseHealth();
  const ctl = controlMatrixSummary();
  const goldens = listGoldenVersions();

  async function buildBinder() {
    const binder = buildEvidenceBinder({
      section28Extra: section28Phase12Report(),
      slaMarkdown: "SLA draft — docs/SLA.md",
    });
    setBinderMd(binderToMarkdown(binder));
    toast.success("Evidence binder gerado (sem selo SOC2)");
  }

  async function publishFromHomolog() {
    const scns = await listScenarios(workspaceId);
    const ready = scns.find(
      (s) => s.status === "validated_scope_ready" || s.status === "homologation_grade",
    );
    if (!ready) {
      toast.error("Nenhum cenário elegível — use Homologação");
      return;
    }
    const listing = publishScenarioListing({
      tenantId,
      workspaceId,
      scenario: ready,
      goldenPackVersion: goldens[0]?.version || "1.0.0-phase12",
    });
    await saveListing(listing);
    toast.success(`Publicado ${listing.id}`);
    await refresh();
  }

  async function importFirst() {
    const pub = listPublishedForTenant(listings, tenantId)[0];
    if (!pub) {
      toast.message("Sem listings publicados");
      return;
    }
    const { scenario, result } = importListingWithRelab({
      listing: pub,
      targetWorkspaceId: workspaceId,
      tenantId,
    });
    await saveScenario(scenario);
    toast.success(`Import ${result.scenarioId} → lab_pending (re-lab obrigatório)`);
  }

  function runOmie() {
    const g = runOmieLivePilotGolden();
    const a = createOmieLivePilotAdapter();
    setOmieTxt(
      `golden=${g.ok} live=${a.liveConnectionEnabled} maturity=${a.maturity} catalogSafe=${assertCatalogSafe()}`,
    );
    toast.success(g.ok ? "Golden Omie OK" : "Golden Omie falhou");
  }

  async function markDpaUnderReview() {
    const cur = (await getLegalStatus(tenantId)) || { tenantId, ...defaultLegalStatus() };
    await saveLegalStatus({
      ...cur,
      tenantId,
      dpa: "under_legal_review",
      updatedAt: new Date().toISOString(),
      notes: [...cur.notes, "DPA moved to legal review (UI)"],
    });
    toast.success("DPA → under_legal_review");
    await refresh();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enterprise · Fase 12</h1>
          <p className="text-muted-foreground text-sm">
            maturidade <Badge tone="info">{ENTERPRISE_PLATFORM_MATURITY}</Badge> · sem
            SOC2/ISO · sem production
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/governance"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Governança
          </Link>
          <Link
            href="/app/homologation"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Homologação
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>
            controls implemented={ctl.implemented} partial={ctl.partial} · omieGolden=
            {String(health.omieGoldenOk)} · liveEnv={String(health.liveErpAllowed)}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>tenantId</Label>
              <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
            </div>
            <div>
              <Label>workspaceId</Label>
              <Input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
            </div>
          </div>
          <p>Legal: {legalTxt || "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certificação (preparação)</CardTitle>
          <CardDescription>Control matrix + evidence binder — sem selo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => void buildBinder()}>Gerar evidence binder</Button>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {CONTROL_MATRIX.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Badge>{c.status}</Badge> {c.id} · {c.soc2Hints.join(",")}
              </li>
            ))}
          </ul>
          {binderMd ? (
            <pre className="bg-muted max-h-56 overflow-auto rounded-md p-3 text-xs">{binderMd}</pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketplace tenant</CardTitle>
          <CardDescription>Opt-in · sem PII · import força re-lab</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void publishFromHomolog()}>Publicar cenário elegível</Button>
            <Button variant="secondary" onClick={() => void importFirst()}>
              Import + re-lab
            </Button>
          </div>
          <ul className="text-sm space-y-1">
            {listings.map((l) => (
              <li key={l.id}>
                <Badge>{l.status}</Badge> {l.title} · {l.cellMaturityClaim} · v
                {l.goldenPackVersion}
              </li>
            ))}
            {listings.length === 0 ? (
              <li className="text-muted-foreground">Nenhum listing</li>
            ) : null}
          </ul>
          <p className="text-muted-foreground text-xs">
            Golden versions: {goldens.length} (ex. {goldens[0]?.packId})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Omie live piloto</CardTitle>
          <CardDescription>
            XFI_ALLOW_LIVE_ERP + XFI_OMIE_APP_KEY/SECRET — HTTP live ainda bloqueado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runOmie}>Rodar golden Omie</Button>
          {omieTxt ? <p className="text-sm">{omieTxt}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal / comercial</CardTitle>
          <CardDescription>DPA template · SLA draft — sem auto-assinar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void markDpaUnderReview()}>
              DPA → legal review
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const next = applyLegalMilestones(defaultLegalStatus(), {
                  dpaSignedEvidenceRef: "manual:contrato-ref-demo",
                });
                await saveLegalStatus({ tenantId, ...next });
                toast.message("Só use evidence real de jurídico");
                await refresh();
              }}
            >
              Simular DPA signed (evidence ref)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
