"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFeatureFlags } from "@/lib/feature-flags-client";
import { billingIsLiveClient } from "@/lib/billing/client-status";

type HealthPayload = {
  status?: string;
  supabase?: boolean;
  billing?: boolean;
  flags?: Record<string, boolean>;
};

type ReadyPayload = {
  commercialReady?: boolean;
  checks?: Record<string, boolean>;
  note?: string;
};

export default function AdminPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ready, setReady] = useState<ReadyPayload | null>(null);
  const [diag, setDiag] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        try {
          const [h, r] = await Promise.all([
            fetch("/api/health").then((x) => x.json()),
            fetch("/api/ready").then((x) => x.json()),
          ]);
          if (cancelled) return;
          setHealth(h);
          setReady(r);
          setDiag(
            [
              `xfi-diag`,
              `ts=${new Date().toISOString()}`,
              `supabase=${Boolean(h.supabase)}`,
              `billing=${Boolean(h.billing)}`,
              `commercial=${Boolean(r.commercialReady)}`,
              `ua=${typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : ""}`,
            ].join("|"),
          );
        } catch {
          if (!cancelled) setHealth({ status: "unreachable" });
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const flags = getFeatureFlags();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Administração e suporte
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Console operacional. Suporte não acessa XML bruto por padrão. Código de diagnóstico não
          contém dados fiscais.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saúde</CardTitle>
            <CardDescription>GET /api/health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-2">
              <Badge tone={health?.status === "ok" ? "success" : "warning"}>
                {health?.status || "…"}
              </Badge>
              <Badge tone={health?.supabase ? "success" : "warning"}>
                Supabase {health?.supabase ? "ok" : "off"}
              </Badge>
              <Badge tone={health?.billing || billingIsLiveClient() ? "success" : "warning"}>
                Billing {health?.billing ? "live" : "demo"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prontidão comercial</CardTitle>
            <CardDescription>GET /api/ready</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-300 space-y-2">
            <Badge tone={ready?.commercialReady ? "success" : "warning"}>
              {ready?.commercialReady ? "Pronto" : "Não comercializável ainda"}
            </Badge>
            <p className="text-xs text-slate-500">{ready?.note}</p>
            <ul className="text-xs space-y-1">
              {ready?.checks &&
                Object.entries(ready.checks).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v ? "sim" : "não"}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature flags (cliente-safe)</CardTitle>
          <CardDescription>Flags públicas apenas — segredos ficam no servidor</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          {Object.entries(flags).map(([k, v]) => (
            <div key={k} className="flex justify-between rounded-lg border border-white/10 px-3 py-2">
              <span className="text-slate-400">{k}</span>
              <Badge tone={v ? "success" : "default"}>{v ? "on" : "off"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Código de diagnóstico</CardTitle>
          <CardDescription>Forneça ao suporte — sem XML, CNPJ ou chaves</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block break-all rounded-xl border border-white/10 bg-slate-950 p-3 text-xs text-sky-200">
            {diag || "Gerando…"}
          </code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atalhos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link href="/app/migrate" className="text-sky-300 hover:underline">
            Migrar lotes
          </Link>
          <Link href="/app/billing" className="text-sky-300 hover:underline">
            Planos
          </Link>
          <Link href="/app/companies" className="text-sky-300 hover:underline">
            Empresas
          </Link>
          <Link href="/docs" className="text-sky-300 hover:underline">
            Docs (se publicado)
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
