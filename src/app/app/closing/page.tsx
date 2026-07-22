"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ensureClosingCard,
  listClosingCards,
  patchClosingCell,
} from "@/lib/store/closing-cockpit";
import { listCompanies } from "@/lib/store/local-cadastro";
import { cardReadiness, type ClosingPeriodCard } from "@/modules/obligations/core/workflows/closing";
import {
  CLOSING_CELL_STATUS_LABELS,
  type ClosingCellStatus,
} from "@/modules/obligations/core/maturity";
import { OBLIGATION_IDS, OBLIGATION_LABELS, type ObligationId } from "@/modules/obligations";
import { getSupportProfile } from "@/modules/obligations";
import { OBLIGATION_MATURITY_LABELS } from "@/modules/obligations/core/maturity";

const WS_KEY = "xfi:workspace-id";

export default function ClosingCockpitPage() {
  const [cards, setCards] = useState<ClosingPeriodCard[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companyLabel, setCompanyLabel] = useState("");
  const [estId, setEstId] = useState("est_default");
  const [estLabel, setEstLabel] = useState("Matriz");
  const [periodKey, setPeriodKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const ws =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(WS_KEY) || crypto.randomUUID()
        : crypto.randomUUID();
    if (typeof localStorage !== "undefined") localStorage.setItem(WS_KEY, ws);
    setWorkspaceId(ws);
    setCards(await listClosingCards(ws));
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      const cos = await listCompanies();
      if (cos[0]) {
        setCompanyId(cos[0].id);
        setCompanyLabel(cos[0].name);
      }
    })();
  }, [refresh]);

  async function createCard() {
    if (!companyLabel.trim()) {
      toast.error("Informe a empresa (ou cadastre em /app/companies)");
      return;
    }
    setBusy(true);
    try {
      const card = await ensureClosingCard({
        workspaceId: workspaceId || crypto.randomUUID(),
        companyId: companyId || `co_${Date.now()}`,
        companyLabel: companyLabel.trim(),
        establishmentId: estId || "est_default",
        establishmentLabel: estLabel || "Matriz",
        periodKey,
        periodKind: periodKey.length === 4 ? "annual" : "monthly",
      });
      toast.success("Competência no cockpit");
      setCards(await listClosingCards(card.workspaceId));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(cardId: string, oid: ObligationId, status: ClosingCellStatus) {
    const card = await patchClosingCell(cardId, oid, {
      status,
      readinessPercent:
        status === "not_started"
          ? 0
          : status === "official_validated" || status === "receipt_registered"
            ? 100
            : 40,
    });
    if (card) setCards(await listClosingCards(card.workspaceId));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Cockpit de fechamento
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Empresa → estabelecimento → competência → obrigações. Persistência local (IndexedDB). Sem
          datas de vencimento inventadas — calendário fiscal é cadastro justificado.
        </p>
        <Link href="/app/obligations" className="text-sm text-sky-300 hover:underline mt-2 inline-block">
          ← Obrigações
        </Link>
        {" · "}
        <Link href="/app/ops" className="text-sm text-sky-300 hover:underline mt-2 inline-block">
          Plataforma ops / calendário →
        </Link>
        {" · "}
        <Link href="/app/continuous-ops" className="text-sm text-sky-300 hover:underline mt-2 inline-block">
          Multi-empresa / ERP →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova competência</CardTitle>
          <CardDescription>Cria células para as cinco obrigações com status “não iniciada”.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="closing-company">Empresa</Label>
            <Input id="closing-company" value={companyLabel} onChange={(e) => setCompanyLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="closing-establishment">Estabelecimento</Label>
            <Input id="closing-establishment" value={estLabel} onChange={(e) => setEstLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="closing-period">Competência (YYYY-MM ou YYYY)</Label>
            <Input id="closing-period" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" disabled={busy} onClick={() => void createCard()}>
              {busy ? "…" : "Abrir no cockpit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {cards.map((card) => (
        <Card key={card.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              {card.companyLabel} · {card.establishmentLabel} · {card.periodKey}
            </CardTitle>
            <CardDescription>
              Prontidão média ~{cardReadiness(card)}% · id local{" "}
              <span className="font-mono text-[11px]">{card.id}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {OBLIGATION_IDS.map((oid) => {
              const cell = card.cells[oid];
              const profile = getSupportProfile(oid);
              if (!cell) return null;
              return (
                <div
                  key={oid}
                  className="rounded-xl border border-white/10 bg-slate-950/40 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100">{OBLIGATION_LABELS[oid]}</div>
                    <div className="text-xs text-slate-500">
                      {OBLIGATION_MATURITY_LABELS[profile.maturity]} · {cell.readinessPercent}%
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">{CLOSING_CELL_STATUS_LABELS[cell.status]}</Badge>
                    <select
                      className="rounded-md border border-white/10 bg-slate-900 text-xs px-2 py-1"
                      value={cell.status}
                      onChange={(e) =>
                        void setStatus(card.id, oid, e.target.value as ClosingCellStatus)
                      }
                    >
                      {(Object.keys(CLOSING_CELL_STATUS_LABELS) as ClosingCellStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {CLOSING_CELL_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <Link
                      href={`/app/obligations/${oid}`}
                      className="text-xs text-sky-300 hover:underline"
                    >
                      Assistente
                    </Link>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {!cards.length && (
        <p className="text-sm text-slate-500">Nenhuma competência ainda. Crie uma acima.</p>
      )}
    </div>
  );
}
