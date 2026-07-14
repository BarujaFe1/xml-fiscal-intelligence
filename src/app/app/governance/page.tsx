"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listScenarios } from "@/lib/store/homologation";
import { listClosingCards } from "@/lib/store/closing-cockpit";
import { listNtItems } from "@/lib/store/continuous-ops";
import {
  listCampaigns,
  listRetentionPolicies,
  listRoleBindings,
  saveCampaign,
  saveRetentionPolicy,
  saveRoleBinding,
} from "@/lib/store/governance";
import { bindRole, canAct } from "@/modules/governance/rbac";
import {
  auditExportMarkdown,
  mergeAuditExport,
  rowsFromClosingTasks,
  rowsFromNtInbox,
  rowsFromTelemetry,
  sanitizeAuditDetail,
} from "@/modules/governance/audit-export";
import {
  createRetentionPolicy,
  retentionSummaryMarkdown,
  seedDefaultRetention,
} from "@/modules/governance/retention";
import { computeSlaSnapshot, DRAFT_SLA_TARGETS } from "@/modules/governance/sla";
import {
  attachScenariosToCampaign,
  buildCellDashboard,
  createCampaign,
  PRIORITY_CAMPAIGN_SEEDS,
  tryCompleteCampaign,
} from "@/modules/governance/campaigns";
import {
  GOVERNANCE_PLATFORM_MATURITY,
  governanceHealth,
  section28Phase11Report,
} from "@/modules/governance/platform";
import { assertExportSection28Rbac } from "@/modules/governance/rbac";
import { requestNtActivationReview } from "@/modules/governance/nt-activate-gate";
import { listOpsEvents } from "@/modules/ops/telemetry";
import { createClosingTask } from "@/modules/ops/sod";
import type { GovernanceRole, ValidatedScopeCampaign, WorkspaceRoleBinding } from "@/modules/governance/types";
import type { NtInboxItem } from "@/modules/continuous-ops/types";

export default function GovernancePage() {
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [userId, setUserId] = useState("user_owner");
  const [role, setRole] = useState<GovernanceRole>("owner");
  const [bindings, setBindings] = useState<WorkspaceRoleBinding[]>([]);
  const [campaigns, setCampaigns] = useState<ValidatedScopeCampaign[]>([]);
  const [auditMd, setAuditMd] = useState("");
  const [retentionMd, setRetentionMd] = useState("");
  const [section28, setSection28] = useState("");
  const [cells, setCells] = useState<ReturnType<typeof buildCellDashboard>>([]);
  const [slaTxt, setSlaTxt] = useState("");
  const [ntItems, setNtItems] = useState<NtInboxItem[]>([]);

  const refresh = useCallback(async () => {
    const b = await listRoleBindings(workspaceId);
    setBindings(b);
    setCampaigns(await listCampaigns(workspaceId));
    const policies = await listRetentionPolicies(workspaceId);
    setRetentionMd(retentionSummaryMarkdown(policies));
    const scns = await listScenarios(workspaceId);
    setCells(buildCellDashboard(scns));
    setNtItems(await listNtItems(workspaceId));
    const snap = computeSlaSnapshot(listOpsEvents(100));
    setSlaTxt(
      `meets=${snap.meetsDraftTargets} genErr=${snap.generationErrors} apiDenied=${snap.apiDenied} gaps=${snap.gaps.join("; ") || "—"}`,
    );
  }, [workspaceId]);

  useEffect(() => {
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") localStorage.setItem("xfi:workspace-id", ws);
      setWorkspaceId(ws);
      const existing = await listRoleBindings(ws);
      if (existing.length === 0) {
        await saveRoleBinding(bindRole({ workspaceId: ws, userId: "user_owner", role: "owner" }));
      }
      const ret = await listRetentionPolicies(ws);
      if (ret.length === 0) {
        for (const p of seedDefaultRetention(ws, "user_owner")) {
          await saveRetentionPolicy(p);
        }
      }
      await refresh();
    })();
  }, [refresh]);

  const health = governanceHealth();

  async function addBinding() {
    const b = bindRole({ workspaceId, userId, role });
    await saveRoleBinding(b);
    toast.success(`Papel ${role} → ${userId}`);
    await refresh();
  }

  async function exportAudit() {
    const gate = canAct({
      bindings,
      workspaceId,
      userId,
      action: "export_audit",
    });
    if (!gate.ok) {
      toast.error(gate.reason || "RBAC");
      return;
    }
    const cards = await listClosingCards(workspaceId);
    const tasks = cards.slice(0, 5).map((c, i) =>
      createClosingTask({
        workspaceId,
        companyId: c.companyId || "co",
        periodKey: c.periodKey || "2026-01",
        obligationId: "ecd",
        title: `closing ${c.companyLabel || c.companyId} ${c.periodKey} #${i}`,
        preparerId: "user_prep",
      }),
    );
    const rows = mergeAuditExport([
      ...rowsFromClosingTasks(tasks),
      ...rowsFromNtInbox(ntItems),
      ...rowsFromTelemetry(listOpsEvents(30)),
    ]);
    setAuditMd(auditExportMarkdown(rows));
    toast.success(`${rows.length} eventos exportados`);
  }

  async function bumpRetention() {
    const gate = canAct({ bindings, workspaceId, userId, action: "manage_retention" });
    if (!gate.ok) {
      toast.error(gate.reason || "RBAC");
      return;
    }
    const prev = (await listRetentionPolicies(workspaceId)).find((p) => p.class === "evidence");
    const next = createRetentionPolicy({
      workspaceId,
      class: "evidence",
      retainDays: prev?.retainDays ?? 1825,
      previous: prev,
      updatedBy: userId,
      notes: "bump versão política",
    });
    await saveRetentionPolicy(next);
    toast.success(`retention evidence v${next.version}`);
    await refresh();
  }

  async function seedCampaigns() {
    const gate = canAct({ bindings, workspaceId, userId, action: "manage_campaigns" });
    if (!gate.ok) {
      toast.error(gate.reason || "RBAC");
      return;
    }
    for (const s of PRIORITY_CAMPAIGN_SEEDS) {
      const c = createCampaign({ workspaceId, ...s });
      await saveCampaign(c);
    }
    toast.success("Campanhas prioridade criadas");
    await refresh();
  }

  async function exportSec28Demo() {
    try {
      assertExportSection28Rbac({ bindings, workspaceId, userId });
      setSection28(section28Phase11Report());
      toast.success("§28 fase 11");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "bloqueado");
    }
  }

  async function tryNtActivate() {
    const item = ntItems.find((n) => n.status === "ready_for_review");
    if (!item) {
      toast.message("Nenhum NT ready_for_review — use Ops contínua");
      return;
    }
    try {
      const next = requestNtActivationReview({
        item,
        bindings,
        workspaceId,
        userId,
      });
      toast.success(sanitizeAuditDetail(next.notes || "ok"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "bloqueado");
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Governança enterprise</h1>
          <p className="text-muted-foreground text-sm">
            Fase 11 · maturidade{" "}
            <Badge tone="info">{GOVERNANCE_PLATFORM_MATURITY}</Badge> · sem SOC2/ISO ·
            sem production
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/continuous-ops"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Ops contínua
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
            liveErpEnvOn={String(health.liveErpEnvOn)} · anyProduction=
            {String(health.anyObligationProduction)}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>SLA: {slaTxt || "—"}</p>
          <p className="text-muted-foreground">
            Metas draft: {DRAFT_SLA_TARGETS.map((t) => t.metric).join(", ")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RBAC</CardTitle>
          <CardDescription>owner / preparer / approver / auditor (+ SoD)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>userId</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div>
              <Label>papel</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as GovernanceRole)}
              >
                <option value="owner">owner</option>
                <option value="preparer">preparer</option>
                <option value="approver">approver</option>
                <option value="auditor">auditor</option>
                <option value="partner_auditor">partner_auditor</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => void addBinding()}>Vincular</Button>
            </div>
          </div>
          <ul className="text-sm space-y-1">
            {bindings.map((b) => (
              <li key={`${b.userId}-${b.role}`}>
                {b.userId} → <Badge tone="default">{b.role}</Badge>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void tryNtActivate()}>
              Gate NT activate
            </Button>
            <Button variant="secondary" onClick={() => void exportSec28Demo()}>
              Export §28 (RBAC)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria & retenção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void exportAudit()}>Export audit</Button>
            <Button variant="outline" onClick={() => void bumpRetention()}>
              Versionar retention evidence
            </Button>
          </div>
          {retentionMd ? (
            <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">{retentionMd}</pre>
          ) : null}
          {auditMd ? (
            <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">{auditMd}</pre>
          ) : null}
          {section28 ? (
            <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">{section28}</pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas validated_scope</CardTitle>
          <CardDescription>Por célula — nunca promove obrigação global</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => void seedCampaigns()}>Seed campanhas prioridade</Button>
          <ul className="text-sm space-y-2">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <Badge>{c.status}</Badge>
                <span>
                  {c.title} ({c.obligationId})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const scns = await listScenarios(workspaceId);
                    let next = attachScenariosToCampaign(
                      c,
                      scns.filter((s) => s.obligationId === c.obligationId).map((s) => s.id),
                    );
                    try {
                      next = tryCompleteCampaign(next, scns);
                    } catch {
                      /* keep */
                    }
                    await saveCampaign(next);
                    await refresh();
                  }}
                >
                  Sync cenários
                </Button>
              </li>
            ))}
          </ul>
          <div className="text-sm">
            <p className="font-medium mb-1">Dashboard células ({cells.length})</p>
            <ul className="space-y-1 text-muted-foreground">
              {cells.slice(0, 12).map((r) => (
                <li key={r.scenarioId}>
                  {r.obligationId}/{r.uf}/{r.regime} · {r.cellMaturity}
                  {r.rehomologationDue ? " · revalidar" : ""}
                </li>
              ))}
              {cells.length === 0 ? <li>Nenhum cenário — veja Homologação</li> : null}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
