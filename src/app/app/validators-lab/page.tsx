"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  createValidatorRunId,
  loadLocalValidatorRuns,
  saveLocalValidatorRun,
  PROGRAM_LABELS,
  type OfficialValidatorRun,
  type OfficialValidatorResultStatus,
} from "@/modules/obligations/core/validators/official-lab";
import type { OfficialProgramId } from "@/modules/obligations/core/maturity";
import { OBLIGATION_IDS, OBLIGATION_LABELS, type ObligationId } from "@/modules/obligations";

export default function ValidatorsLabPage() {
  const [runs, setRuns] = useState<OfficialValidatorRun[]>(() => loadLocalValidatorRuns());
  const [obligationId, setObligationId] = useState<ObligationId>("efd-icms-ipi");
  const [program, setProgram] = useState<OfficialProgramId>("pva_efd_icms_ipi");
  const [programVersion, setProgramVersion] = useState("");
  const [resultStatus, setResultStatus] = useState<OfficialValidatorResultStatus>("unknown");
  const [reportText, setReportText] = useState("");
  const [responsible, setResponsible] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [contentHash, setContentHash] = useState("");

  function refresh() {
    setRuns(loadLocalValidatorRuns());
  }

  function save() {
    if (!programVersion.trim()) {
      toast.error("Informe a versão do programa oficial");
      return;
    }
    const run: OfficialValidatorRun = {
      id: createValidatorRunId(),
      obligationId,
      program,
      programVersion: programVersion.trim(),
      resultStatus,
      reportText: reportText || undefined,
      generationId: generationId || undefined,
      contentHash: contentHash || undefined,
      responsible: responsible || undefined,
      importedAt: new Date().toISOString(),
    };
    saveLocalValidatorRun(run);
    toast.success("Resultado registrado (local). Não redistribuímos programas da RFB.");
    setReportText("");
    refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Laboratório de validadores oficiais</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Registre resultados do PVA/PGE/Programas oficiais executados fora do produto. Não
          automatizamos UI desses programas nem embutimos binários.
        </p>
        <Link href="/app/obligations" className="text-sm text-sky-300 hover:underline mt-2 inline-block">
          ← Obrigações
        </Link>
        {" · "}
        <Link href="/app/homologation" className="text-sm text-sky-300 hover:underline mt-2 inline-block">
          Homologação / cenários →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo registro</CardTitle>
          <CardDescription>Metadados + texto do relatório (opcional). Hash do TXT quando houver.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Obrigação</Label>
              <select
                className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-sm"
                value={obligationId}
                onChange={(e) => setObligationId(e.target.value as ObligationId)}
              >
                {OBLIGATION_IDS.map((id) => (
                  <option key={id} value={id}>
                    {OBLIGATION_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Programa</Label>
              <select
                className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-sm"
                value={program}
                onChange={(e) => setProgram(e.target.value as OfficialProgramId)}
              >
                {(Object.keys(PROGRAM_LABELS) as OfficialProgramId[]).map((p) => (
                  <option key={p} value={p}>
                    {PROGRAM_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Versão do programa</Label>
              <Input
                value={programVersion}
                onChange={(e) => setProgramVersion(e.target.value)}
                placeholder="ex. PVA 6.0.9"
              />
            </div>
            <div className="space-y-1">
              <Label>Resultado</Label>
              <select
                className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-sm"
                value={resultStatus}
                onChange={(e) => setResultStatus(e.target.value as OfficialValidatorResultStatus)}
              >
                <option value="ok">ok</option>
                <option value="warnings">warnings</option>
                <option value="errors">errors</option>
                <option value="unknown">unknown</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>generationId (opc.)</Label>
              <Input value={generationId} onChange={(e) => setGenerationId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>contentHash (opc.)</Label>
              <Input value={contentHash} onChange={(e) => setContentHash(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Responsável</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Relatório / mensagens</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-sm font-mono"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
              />
            </div>
          </div>
          <Button type="button" onClick={save}>
            Registrar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico local ({runs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!runs.length && <p className="text-slate-500">Nenhum registro ainda.</p>}
          {runs.slice(0, 30).map((r) => (
            <div key={r.id} className="rounded-lg border border-white/10 p-2 text-xs text-slate-400">
              <div className="text-slate-200">
                {PROGRAM_LABELS[r.program]} {r.programVersion} · {r.resultStatus}
              </div>
              <div>
                {OBLIGATION_LABELS[r.obligationId]} · {r.importedAt.slice(0, 19)}
                {r.responsible ? ` · ${r.responsible}` : ""}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
