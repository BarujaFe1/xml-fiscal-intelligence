"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listScenarios, saveScenario } from "@/lib/store/homologation";
import { saveEvidence } from "@/lib/store/ops";
import {
  loadLocalValidatorRuns,
  type OfficialValidatorRun,
} from "@/modules/obligations/core/validators/official-lab";
import { HOMOLOGATION_PLAYBOOKS } from "@/modules/homologation/playbooks";
import {
  createScenarioDraft,
  applyLabResult,
  markReviewed,
  cellMaturityFromScenario,
  diffScenarioMatrix,
} from "@/modules/homologation/scenarios";
import {
  bridgeLabRunToEvidence,
  attachLabToScenario,
  isHomologationGradeGeneric,
} from "@/modules/homologation/lab-bridge";
import {
  buildTransmissionChecklist,
  transmissionAllowed,
} from "@/modules/homologation/transmission";
import { listApiKeyAudit, proposeApiKeyRotation } from "@/modules/homologation/api-key-audit";
import { listGoldenPacks, goldenCoverageReport } from "@/modules/homologation/golden-packs";
import {
  HOMOLOGATION_PLATFORM_MATURITY,
  SUPPORT_RUNBOOK_DONT_PROMISE,
  obligationBanners,
  commercialValidatedScopeClaims,
} from "@/modules/homologation/platform";
import {
  activateRtcRuleSetWithFixture,
  assertStaticRtcRulesInactive,
} from "@/modules/homologation/rtc-activation";
import { listOpsEvents } from "@/modules/ops/telemetry";
import type { ValidatedScenario } from "@/modules/homologation/types";
import { OBLIGATION_IDS, OBLIGATION_LABELS, type ObligationId } from "@/modules/obligations";

export default function HomologationPage() {
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [scenarios, setScenarios] = useState<ValidatedScenario[]>([]);
  const [obligationId, setObligationId] = useState<ObligationId>("efd-icms-ipi");
  const [periodKey, setPeriodKey] = useState("2026-03");
  const [uf, setUf] = useState("SP");
  const [reviewer, setReviewer] = useState("revisor_1");
  const [hashDemo, setHashDemo] = useState("ab".repeat(16));
  const [prevSnapshot, setPrevSnapshot] = useState<ValidatedScenario[]>([]);

  const refresh = useCallback(async () => {
    setScenarios(await listScenarios(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") localStorage.setItem("xfi:workspace-id", ws);
      setWorkspaceId(ws);
      await refresh();
    })();
  }, [refresh]);

  const readyCount = scenarios.filter((s) => s.status === "validated_scope_ready").length;
  const commercial = commercialValidatedScopeClaims(readyCount);
  const tx = buildTransmissionChecklist({
    obligationId: "reinf",
    certType: "none",
    localAgentReady: false,
    sodApproved: false,
    distinctApprover: false,
    environment: "restricted",
  });
  const txGate = transmissionAllowed(tx);
  const goldens = goldenCoverageReport();
  const banners = obligationBanners();
  const [rotationHint, setRotationHint] = useState("…");
  const matrixDiff = useMemo(
    () => diffScenarioMatrix(prevSnapshot, scenarios),
    [prevSnapshot, scenarios],
  );

  useEffect(() => {
    // Só no client — Date.now/random no render quebrava hydration (#418)
    setRotationHint(proposeApiKeyRotation().suggestedEnvValuePlaceholder.slice(0, 24));
  }, []);

  async function createDraft() {
    const pb = HOMOLOGATION_PLAYBOOKS.find((p) => p.obligationId === obligationId);
    const scn = createScenarioDraft({
      workspaceId,
      obligationId,
      periodKey,
      layoutVersion: "DRAFT",
      program: pb?.program || "other",
      uf,
    });
    setPrevSnapshot(scenarios);
    await saveScenario(scn);
    toast.success("Cenário draft criado");
    await refresh();
  }

  async function importFromLab() {
    const runs = loadLocalValidatorRuns().filter((r) => r.obligationId === obligationId);
    const run = runs[0] as OfficialValidatorRun | undefined;
    if (!run) {
      toast.error("Sem runs no validators-lab — registre um resultado antes");
      return;
    }
    const scn =
      scenarios.find((s) => s.obligationId === obligationId && s.status !== "validated_scope_ready") ||
      createScenarioDraft({
        workspaceId,
        obligationId,
        periodKey,
        layoutVersion: "DRAFT",
        program: run.program,
        uf,
      });
    const ev = bridgeLabRunToEvidence(run, workspaceId);
    await saveEvidence(ev);
    const next = attachLabToScenario(scn, run, ev.id);
    setPrevSnapshot(scenarios);
    await saveScenario(next);
    toast.success(
      `Lab → cenário · grade=${next.homologationGrade} · status=${next.status}`,
    );
    await refresh();
  }

  async function simulateGradeOk() {
    let scn =
      scenarios[0] ||
      createScenarioDraft({
        workspaceId,
        obligationId,
        periodKey,
        layoutVersion: "DRAFT",
        program: "pva_efd_icms_ipi",
        uf,
      });
    scn = applyLabResult(scn, {
      contentHash: hashDemo,
      programVersion: "PVA-sim-6.0.9",
      generationId: `gen_${Date.now()}`,
      evidenceId: `ev_${Date.now()}`,
      homologationGrade: isHomologationGradeGeneric({
        contentHash: hashDemo,
        programVersion: "PVA-sim-6.0.9",
        resultStatus: "ok",
      }),
    });
    setPrevSnapshot(scenarios);
    await saveScenario(scn);
    toast.success(`Simulação grade=${scn.homologationGrade} status=${scn.status}`);
    await refresh();
  }

  async function reviewFirst() {
    const scn = scenarios.find((s) => s.homologationGrade);
    if (!scn) {
      toast.error("Nenhum cenário com homologationGrade");
      return;
    }
    try {
      const next = markReviewed(
        scn,
        reviewer,
        "§28: fixture sintética + lab + hash conferidos. Célula only — obrigação global inalterada.",
      );
      setPrevSnapshot(scenarios);
      await saveScenario(next);
      toast.success(`Revisado → ${next.status} · cell=${cellMaturityFromScenario(next)}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  function tryActivateRtc() {
    const r = activateRtcRuleSetWithFixture({
      ruleSetId: "rs_rtc_reforma_consumo_2026",
      fixtureId: "rtc_dual_contrib_2026_03",
      reviewerId: reviewer,
      evidenceHash: hashDemo,
    });
    toast.message(
      r.ok
        ? `Lab activation ok (static still inactive=${assertStaticRtcRulesInactive()})`
        : r.reason,
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Homologação oficial</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Fase 9 · processo <Badge>{HOMOLOGATION_PLATFORM_MATURITY}</Badge> · evidência por
          cenário (sem production global)
        </p>
        <div className="flex gap-3 mt-1 text-sm">
          <Link href="/app/validators-lab" className="text-sky-300 hover:underline">
            Validators lab →
          </Link>
          <Link href="/app/ops" className="text-sky-300 hover:underline">
            Ops / evidências →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Playbooks</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {HOMOLOGATION_PLAYBOOKS.map((p) => (
            <p key={p.id}>
              {p.title} · {p.steps.length} passos · {p.notes[0]}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cenários</CardTitle>
          <CardDescription>
            Diff matriz: {matrixDiff.summary} · validated_scope_ready={readyCount}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <select
              className="rounded-md border border-slate-700 bg-slate-950 p-2 text-sm"
              value={obligationId}
              onChange={(e) => setObligationId(e.target.value as ObligationId)}
            >
              {OBLIGATION_IDS.map((id) => (
                <option key={id} value={id}>
                  {OBLIGATION_LABELS[id]}
                </option>
              ))}
            </select>
            <Input value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
            <Input value={uf} onChange={(e) => setUf(e.target.value)} />
            <Input value={hashDemo} onChange={(e) => setHashDemo(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void createDraft()}>
              Criar draft
            </Button>
            <Button type="button" variant="secondary" onClick={() => void importFromLab()}>
              Importar do lab
            </Button>
            <Button type="button" onClick={() => void simulateGradeOk()}>
              Simular homologationGrade
            </Button>
            <Button type="button" onClick={() => void reviewFirst()}>
              Revisar (§28)
            </Button>
          </div>
          <ul className="text-xs space-y-1 max-h-48 overflow-auto">
            {scenarios.map((s) => (
              <li key={s.id}>
                {s.obligationId} {s.periodKey}/{s.uf} · {s.status} · grade=
                {String(s.homologationGrade)} · cell={cellMaturityFromScenario(s) || "—"}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transmissão (checklist)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {tx.map((i) => (
            <p key={i.id}>
              [{i.ok ? "ok" : "x"}] {i.label} {i.required ? "*" : ""} — {i.detail}
            </p>
          ))}
          <p className="text-slate-500">allowed={String(txGate.ok)} missing={txGate.missing.join(",")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys / goldens / telemetria</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <p>
            Rotação sugerida (não gravar no git): {rotationHint}…
          </p>
          <p>
            Audit recente: {listApiKeyAudit(5).length} · Goldens required={goldens.required}
          </p>
          <p>Ops telemetry events: {listOpsEvents(10).length}</p>
          <ul>
            {listGoldenPacks().map((g) => (
              <li key={g.id}>
                {g.obligationId}: {g.testHint}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comercial / banners / runbook</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <p>
            claimValidatedScope={String(commercial.claimValidatedScope)} — {commercial.reason}
          </p>
          {banners.map((b) => (
            <p key={b.obligationId}>
              {b.obligationId}: {b.maturity}
              {b.bannerNonProduction ? " · [não produção]" : ""}
            </p>
          ))}
          {SUPPORT_RUNBOOK_DONT_PROMISE.map((line) => (
            <p key={line} className="text-amber-200/80">
              • {line}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RTC follow-through</CardTitle>
          <CardDescription>Ativação lab com fixture — catálogo static permanece inativo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Revisor</Label>
            <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
            <Button type="button" variant="secondary" onClick={tryActivateRtc}>
              Ativar rule_set em lab (cópia)
            </Button>
            <p className="text-xs text-slate-500">
              staticInactive={String(assertStaticRtcRulesInactive())}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
