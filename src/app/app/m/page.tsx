"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listClosingCards } from "@/lib/store/closing-cockpit";
import { listOpsEvents } from "@/modules/ops/telemetry";
import {
  assertMobileReadOnly,
  buildMobileClosingSummary,
} from "@/modules/growth/mobile-readonly";
import type { MobileClosingSummary } from "@/modules/growth/types";
import { Badge } from "@/components/ui/badge";

/**
 * Superfície mobile read-only — sem geração/transmit.
 * Ideal para status + alertas sanitizados.
 */
export default function MobileReadonlyPage() {
  const [summary, setSummary] = useState<MobileClosingSummary | null>(null);

  useEffect(() => {
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || "ws_local"
          : "ws_local";
      const cards = await listClosingCards(ws);
      const s = buildMobileClosingSummary({
        workspaceId: ws,
        cards,
        telemetry: listOpsEvents(20),
      });
      assertMobileReadOnly(s);
      setSummary(s);
    })();
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 p-4 pb-10">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fechamento</h1>
          <p className="text-muted-foreground text-xs">Mobile read-only · sem gerar/transmitir</p>
        </div>
        <Badge tone="info">RO</Badge>
      </header>

      {summary ? (
        <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm">
            Cards: <strong>{summary.cards}</strong>
          </p>
          <p className="text-3xl font-semibold tabular-nums">{summary.readyPctEstimate}%</p>
          <p className="text-muted-foreground text-xs">prontidão estimada (cockpit)</p>
          <div className="text-xs text-muted-foreground">
            generate={String(summary.canGenerate)} · transmit={String(summary.canTransmit)}
          </div>
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Alertas</h2>
        <ul className="space-y-2 text-sm">
          {(summary?.alerts || []).map((a, i) => (
            <li key={i} className="rounded-lg border border-white/10 px-3 py-2">
              {a}
            </li>
          ))}
          {summary && summary.alerts.length === 0 ? (
            <li className="text-muted-foreground text-xs">Sem alertas recentes</li>
          ) : null}
        </ul>
      </section>

      <footer className="mt-auto flex flex-col gap-2 pt-4 text-sm">
        <Link href="/app/growth" className="text-sky-400 underline-offset-2 hover:underline">
          Growth (desktop)
        </Link>
        <Link href="/app/closing" className="text-sky-400 underline-offset-2 hover:underline">
          Cockpit completo
        </Link>
      </footer>
    </div>
  );
}
