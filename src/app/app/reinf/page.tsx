"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listCompanies } from "@/lib/store/local-cadastro";
import {
  listReinfEvents,
  saveReinfEvent,
  transitionReinfEvent,
} from "@/lib/store/reinf-events";
import { createDraftR1000, createDraftR2010Candidate } from "@/modules/obligations/reinf/service";
import { stubLocalSign } from "@/modules/obligations/reinf/signer/local-agent";
import { submitReinfEvent } from "@/modules/obligations/reinf/ws/client";
import {
  parseDctfWebImportCsv,
  reconcileDctfVsReinf,
  type DctfReconResult,
} from "@/modules/obligations/reinf/dctf/reconcile";
import {
  REINF_EVENT_STATUS_LABELS,
  type ReinfCanonicalEvent,
} from "@/modules/obligations/reinf/lifecycle";
import { REINF_CATALOG, listImplementedEvents } from "@/modules/obligations/reinf/catalog";

const WS_KEY = "xfi:workspace-id";

export default function ReinfEnginePage() {
  const [events, setEvents] = useState<ReinfCanonicalEvent[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [companyId, setCompanyId] = useState("co_local");
  const [cnpj, setCnpj] = useState("");
  const [periodKey, setPeriodKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [dctfText, setDctfText] = useState("periodo;cod_receita;valor\n");
  const [recon, setRecon] = useState<DctfReconResult | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const ws =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(WS_KEY) || crypto.randomUUID()
        : crypto.randomUUID();
    if (typeof localStorage !== "undefined") localStorage.setItem(WS_KEY, ws);
    setWorkspaceId(ws);
    setEvents(await listReinfEvents({ workspaceId: ws }));
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      const cos = await listCompanies();
      if (cos[0]) {
        setCompanyId(cos[0].id);
        setCnpj(cos[0].cnpj || "");
      }
    })();
  }, [refresh]);

  async function createR1000() {
    if (!cnpj.replace(/\D/g, "")) {
      toast.error("Informe CNPJ");
      return;
    }
    setBusy(true);
    try {
      const ev = await createDraftR1000({
        workspaceId,
        companyId,
        cnpj,
        periodKey,
      });
      await saveReinfEvent(ev);
      toast.success("R-1000 draft criado");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createR2010Demo() {
    setBusy(true);
    try {
      const ev = await createDraftR2010Candidate({
        workspaceId,
        companyId,
        cnpj: cnpj || "00000000000000",
        periodKey,
        tomadorDoc: "11222333000181",
        vlServico: "1000,00",
        accessKey: "demo-key",
      });
      await saveReinfEvent(ev);
      toast.success("R-2010 candidato draft");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markReady(id: string) {
    await transitionReinfEvent(id, "ready");
    await refresh();
  }

  async function signStub(ev: ReinfCanonicalEvent) {
    setBusy(true);
    try {
      if (ev.status === "draft") await transitionReinfEvent(ev.id, "ready");
      const signed = await stubLocalSign({
        eventId: ev.id,
        xmlUnsigned: ev.xmlUnsigned,
        contentHash: ev.contentHash,
      });
      await transitionReinfEvent(ev.id, "signed", {
        xmlSigned: signed.xmlSigned,
        signedHash: signed.signedHash,
      });
      toast.success("Assinado via stub local (NÃO válido RFB)");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao assinar");
    } finally {
      setBusy(false);
    }
  }

  async function trySubmit(ev: ReinfCanonicalEvent) {
    const res = await submitReinfEvent(ev);
    toast.message(res.mensagem);
  }

  function runDctf() {
    const lines = parseDctfWebImportCsv(dctfText);
    const expectations = events
      .filter((e) => e.eventCode === "R-2010" && e.status !== "deleted")
      .map((e) => ({
        periodKey: e.periodKey,
        eventCode: e.eventCode,
        eventId: e.id,
        amount: "1000,00",
      }));
    setRecon(reconcileDctfVsReinf(lines, expectations));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">EFD-Reinf — motor de eventos</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Catálogo {REINF_CATALOG.version} · {listImplementedEvents().length} implementados · ambiente
          default <span className="font-mono">restricted</span> · submit off.
        </p>
        <div className="mt-2 flex gap-3 text-sm">
          <Link href="/app/obligations/reinf" className="text-sky-300 hover:underline">
            Assistente pacote →
          </Link>
          <Link href="/app/closing" className="text-sky-300 hover:underline">
            Cockpit →
          </Link>
          <Link href="/app/validators-lab" className="text-sky-300 hover:underline">
            Lab. validadores →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo draft</CardTitle>
          <CardDescription>Persistência IndexedDB local (`xfi_reinf_v1`).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Competência YYYY-MM</Label>
            <Input value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="button" disabled={busy} onClick={() => void createR1000()}>
              Criar R-1000
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void createR2010Demo()}>
              Criar R-2010 demo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos ({events.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!events.length && <p className="text-sm text-slate-500">Nenhum evento ainda.</p>}
          {events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-xl border border-white/10 p-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-medium text-slate-100">
                  {ev.eventCode} · {ev.periodKey}
                </div>
                <div className="text-xs text-slate-500 font-mono">{ev.contentHash.slice(0, 16)}…</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{REINF_EVENT_STATUS_LABELS[ev.status]}</Badge>
                {ev.status === "draft" && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void markReady(ev.id)}>
                    ready
                  </Button>
                )}
                {(ev.status === "draft" || ev.status === "ready") && (
                  <Button type="button" size="sm" disabled={busy} onClick={() => void signStub(ev)}>
                    Assinar stub
                  </Button>
                )}
                {ev.status === "signed" && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void trySubmit(ev)}>
                    Submit (dry)
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conciliação DCTFWeb (import)</CardTitle>
          <CardDescription>
            Cole CSV exportado (periodo;cod_receita;valor). Sem login no portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full min-h-[100px] rounded-md border border-white/10 bg-slate-900 px-2 py-2 text-sm font-mono"
            value={dctfText}
            onChange={(e) => setDctfText(e.target.value)}
          />
          <Button type="button" onClick={runDctf}>
            Conciliar
          </Button>
          {recon && (
            <div className="text-xs text-slate-400 space-y-1">
              <p>
                matched={recon.matched} · dctf sem par={recon.unmatchedDctf} · reinf sem par=
                {recon.unmatchedReinf}
              </p>
              {recon.findings.slice(0, 12).map((f, i) => (
                <p key={i}>
                  [{f.severity}] {f.message}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
