"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getPrefs,
  getSodPolicy,
  listEvidence,
  listGenerations,
  listNotifications,
  listRegulatory,
  listTasks,
  saveEvidence,
  saveGeneration,
  saveNotification,
  savePrefs,
  saveRegulatory,
  saveSodPolicy,
  saveTask,
} from "@/lib/store/ops";
import { listCalendarCatalog, buildIcalReminder } from "@/modules/ops/calendar";
import {
  DEFAULT_SOD_POLICY,
  approveTask,
  createClosingTask,
  canApprove,
} from "@/modules/ops/sod";
import { createGeneration, diffGenerations } from "@/modules/ops/generations";
import { createEvidenceMeta } from "@/modules/ops/evidence";
import {
  buildNotification,
  defaultPrefs,
  sanitizeNotificationBody,
} from "@/modules/ops/notifications";
import {
  buildCommercialSupportMatrix,
  assertNoFalseProduction,
} from "@/modules/ops/commercial-matrix";
import {
  seedRegulatoryFromOfficialSources,
  advanceRegulatoryStatus,
} from "@/modules/ops/regulatory";
import { previewCsvImport } from "@/modules/ops/erp-generic";
import { PLATFORM_OPS_MATURITY } from "@/modules/ops/platform";
import { listOpsEvents } from "@/modules/ops/telemetry";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";

export default function OpsPlatformPage() {
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [companyId, setCompanyId] = useState("co_ops");
  const [periodKey, setPeriodKey] = useState("2026-03");
  const [actorA, setActorA] = useState("preparador_1");
  const [actorB, setActorB] = useState("aprovador_1");
  const [taskCount, setTaskCount] = useState(0);
  const [genPreview, setGenPreview] = useState("");
  const [csvPreview, setCsvPreview] = useState("");
  const [ical, setIcal] = useState("");

  const refresh = useCallback(async () => {
    const tasks = await listTasks(workspaceId);
    setTaskCount(tasks.length);
    let regs = await listRegulatory();
    if (!regs.length) {
      regs = seedRegulatoryFromOfficialSources().slice(0, 40);
      for (const r of regs) await saveRegulatory(r);
    }
  }, [workspaceId]);

  useEffect(() => {
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") localStorage.setItem("xfi:workspace-id", ws);
      setWorkspaceId(ws);
      const policy = (await getSodPolicy(ws)) || DEFAULT_SOD_POLICY(ws);
      await saveSodPolicy(policy);
      const prefs = (await getPrefs(ws)) || defaultPrefs(ws);
      await savePrefs(prefs);
      await refresh();
    })();
  }, [refresh]);

  const calendar = listCalendarCatalog();
  const matrix = useMemo(() => buildCommercialSupportMatrix(), []);
  const noFalseProd = assertNoFalseProduction(matrix);

  async function createTaskDemo() {
    const task = createClosingTask({
      workspaceId,
      companyId,
      periodKey,
      obligationId: "efd-icms-ipi",
      title: `Fechar EFD ICMS/IPI ${periodKey}`,
      preparerId: actorA,
    });
    await saveTask(task);
    toast.success("Tarefa criada");
    await refresh();
  }

  async function trySelfApprove() {
    const tasks = await listTasks(workspaceId);
    const task = tasks[0];
    if (!task) {
      toast.error("Crie uma tarefa antes");
      return;
    }
    const policy = (await getSodPolicy(workspaceId)) || DEFAULT_SOD_POLICY(workspaceId);
    const gate = canApprove({ policy, task, actorId: actorA });
    if (!gate.ok) {
      toast.error(gate.reason || "SoD bloqueou");
      return;
    }
    toast.message("inesperado: SoD deveria bloquear");
  }

  async function approveAsOther() {
    const tasks = await listTasks(workspaceId);
    const task = tasks.find((t) => t.status !== "done");
    if (!task) {
      toast.error("Sem tarefa aberta");
      return;
    }
    const policy = (await getSodPolicy(workspaceId)) || DEFAULT_SOD_POLICY(workspaceId);
    try {
      const next = approveTask(task, policy, actorB, "ok fechamento");
      await saveTask(next);
      toast.success("Aprovado por aprovador distinto");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  async function recordGeneration() {
    const hash = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(`demo-${Date.now()}`))
      .then((b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""));
    const prev = (await listGenerations(workspaceId))[0] || null;
    const gen = createGeneration({
      workspaceId,
      companyId,
      obligationId: "efd-contribuicoes",
      periodKey,
      contentHash: hash,
      layoutVersion: "EFD_CONTRIB_2026_DRAFT",
      contentPreview: `|0000|\n|M100|demo|\n|M200|${Date.now()}|`,
      createdBy: actorA,
      previous: prev,
    });
    await saveGeneration(gen);
    const d = diffGenerations(prev, gen);
    setGenPreview(d.impactSummary);
    const ev = createEvidenceMeta({
      workspaceId,
      obligationId: "efd-contribuicoes",
      program: "pge_efd_contribuicoes",
      programVersion: "local-draft",
      contentHash: hash,
      resultStatus: "unknown",
      generationId: gen.id,
      responsible: actorB,
      storageRef: "private://evidence/meta-only",
    });
    await saveEvidence(ev);
    toast.success("Geração imutável + evidência metadata");
  }

  async function notifyDemo() {
    const prefs = (await getPrefs(workspaceId)) || defaultPrefs(workspaceId);
    const recent = (await listNotifications(workspaceId)).length;
    try {
      const n = buildNotification({
        workspaceId,
        channel: "internal",
        title: "Fechamento pendente",
        body: `Empresa CNPJ 11222333000181 XML <?xml version="1"?> <nfe/> período ${periodKey}`,
        prefs,
        recentCount: recent,
      });
      await saveNotification(n);
      toast.success(`Notificação: ${n.body}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  async function publishFirstReg() {
    const regs = await listRegulatory();
    const first = regs.find((r) => r.status === "identified");
    if (!first) {
      toast.message("Nada identified");
      return;
    }
    const reviewed = advanceRegulatoryStatus(first, "reviewed");
    await saveRegulatory(reviewed);
    const published = advanceRegulatoryStatus(reviewed, "published");
    await saveRegulatory(published);
    toast.success(`Publicado ${published.sourceId} (sem ativar rule_set)`);
  }

  function runErpPreview() {
    const csv = "code;name;idempotencyKey\n1.1.01;Caixa;k1\n1.1.02;Bancos;k1\n";
    const prev = previewCsvImport(
      csv,
      [
        { sourceColumn: "code", targetField: "code" },
        { sourceColumn: "name", targetField: "name" },
        { sourceColumn: "idempotencyKey", targetField: "idempotencyKey" },
      ],
      "ledger_accounts",
    );
    setCsvPreview(`ok=${prev.okCount} err=${prev.errorCount} (dup idempotency esperada)`);
  }

  function exportIcal() {
    const rule = calendar[0];
    if (!rule) return;
    setIcal(
      buildIcalReminder({
        obligationId: rule.obligationId,
        periodKey,
        summary: `Competência ${rule.obligationId} ${periodKey}`,
        sourceId: rule.sourceId,
      }),
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plataforma operacional</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Fase 7 · maturidade plataforma <Badge>{PLATFORM_OPS_MATURITY}</Badge> · não eleva
          obrigações para production
        </p>
        <div className="flex gap-3 mt-1 text-sm">
          <Link href="/app/closing" className="text-sky-300 hover:underline">
            Closing →
          </Link>
          <Link href="/api/v1/openapi.json" className="text-sky-300 hover:underline">
            OpenAPI /api/v1 →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contexto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Company</Label>
            <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Competência</Label>
            <Input value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Preparador</Label>
            <Input value={actorA} onChange={(e) => setActorA(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Aprovador</Label>
            <Input value={actorB} onChange={(e) => setActorB(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendário (sourceId, sem data inventada)</CardTitle>
          <CardDescription>{calendar.length} regra(s) descritivas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          {calendar.map((r) => (
            <p key={r.id}>
              {r.obligationId}: {r.description} · <span className="text-slate-500">{r.sourceId}</span>
            </p>
          ))}
          <Button type="button" variant="secondary" onClick={exportIcal}>
            Export iCal lembrete de competência
          </Button>
          {ical ? (
            <pre className="text-xs max-h-40 overflow-auto border border-slate-800 p-2 rounded">
              {ical}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SoD / tarefas ({taskCount})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void createTaskDemo()}>
            Criar tarefa
          </Button>
          <Button type="button" variant="secondary" onClick={() => void trySelfApprove()}>
            Tentar auto-aprovar (deve falhar)
          </Button>
          <Button type="button" onClick={() => void approveAsOther()}>
            Aprovar como outro
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gerações imutáveis + evidências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button type="button" onClick={() => void recordGeneration()}>
            Registrar geração + evidência
          </Button>
          <p className="text-sm text-slate-400">{genPreview}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações sanitizadas</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => void notifyDemo()}>
            Enviar demo (mascara CNPJ / remove XML)
          </Button>
          <p className="text-xs text-slate-500 mt-2">
            Exemplo sanitize: {sanitizeNotificationBody("CNPJ 11222333000181 <?xml?>")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ERP genérico CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button type="button" variant="secondary" onClick={runErpPreview}>
            Preview CSV (detecta idempotency dup)
          </Button>
          <p className="text-sm">{csvPreview}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo regulatório</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => void publishFirstReg()}>
            Identified → reviewed → published
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matriz comercial (espelho real)</CardTitle>
          <CardDescription>
            noFalseProduction={String(noFalseProd)} · banners para maturity &lt; validated_scope
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs space-y-1 max-h-60 overflow-auto">
          {matrix.map((r) => (
            <p key={r.resource}>
              {r.resource}: {r.maturityLabel} · plano {r.planHint}
              {r.bannerNonProduction ? " · [não produção]" : ""}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Obrigações (não alteradas pela Fase 7)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          {Object.entries(OBLIGATION_SUPPORT_PROFILES).map(([id, p]) => (
            <p key={id}>
              {id}: {p.maturity}
            </p>
          ))}
          <p className="text-slate-500">telemetry: {listOpsEvents(5).length} eventos recentes (proc)</p>
        </CardContent>
      </Card>
    </div>
  );
}
