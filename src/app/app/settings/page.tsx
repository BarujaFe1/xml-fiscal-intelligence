"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import { FiscalContextSelector } from "@/components/layout/fiscal-context-selector";
import { formatReleaseLabel, getReleaseInfo } from "@/lib/release";
import { parserSupportSummary } from "@/lib/parser/capability-registry";
import {
  PARSER_RUNTIME_VERSION,
  RULE_SET_RUNTIME_VERSION,
  SCHEMA_RUNTIME_VERSION,
} from "@/lib/analysis/generation";
import { QUALITY_FORMULA_VERSION } from "@/lib/quality";
import { EFD_ICMS_IPI_LAYOUT_2026 } from "@/modules/obligations/efd-icms-ipi/plugin";

function readFlag(key: string, fallback = true) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) !== "false";
}

export default function SettingsPage() {
  const [masking, setMasking] = useState(() => readFlag("xfi_masking", true));
  const [demo, setDemo] = useState(() => readFlag("xfi_demo", true));

  function persistMasking(v: boolean) {
    setMasking(v);
    localStorage.setItem("xfi_masking", String(v));
  }
  function persistDemo(v: boolean) {
    setDemo(v);
    localStorage.setItem("xfi_demo", String(v));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Configurações
        </h1>
        <p className="text-slate-400 mt-1">
          Preferências locais. Conta SaaS e sincronização em nuvem dependem de Supabase configurado.
        </p>
      </div>

      <LocalPersistenceBanner />

      <Suspense fallback={<div className="skeleton h-40 rounded-xl" />}>
        <FiscalContextSelector />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Privacidade</CardTitle>
          <CardDescription>Mascaramento de CNPJ/CPF na UI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Mascarar documentos por padrão</span>
            <input type="checkbox" checked={masking} onChange={(e) => persistMasking(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Modo demo</span>
            <input type="checkbox" checked={demo} onChange={(e) => persistDemo(e.target.checked)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Versão</CardTitle>
          <CardDescription>Rastreabilidade de release</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-300 space-y-2">
          <p className="font-mono text-xs">{formatReleaseLabel(getReleaseInfo())}</p>
          <p className="text-slate-500 text-xs">Canal: {getReleaseInfo().channel}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Governança regulatória (runtime)</CardTitle>
          <CardDescription>
            Constantes embutidas no build. Catálogo Postgres (`official_source_versions`) quando Supabase
            estiver conectado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs font-mono text-slate-400">
          <div className="flex justify-between gap-3">
            <span>parser</span>
            <span className="text-slate-200">{PARSER_RUNTIME_VERSION}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>rule_set</span>
            <span className="text-slate-200">{RULE_SET_RUNTIME_VERSION}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>schema</span>
            <span className="text-slate-200">{SCHEMA_RUNTIME_VERSION}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>quality_formula</span>
            <span className="text-slate-200">{QUALITY_FORMULA_VERSION}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>efd_icms_ipi_layout</span>
            <span className="text-slate-200">{EFD_ICMS_IPI_LAYOUT_2026}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suporte de parsers</CardTitle>
          <CardDescription>Matriz declarada — não inventa cobertura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {parserSupportSummary().map((p) => (
            <div key={p.family} className="flex justify-between gap-3 border-b border-white/5 py-1">
              <span>{p.family}</span>
              <span className="text-slate-500 text-xs">{p.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ambiente</CardTitle>
          <CardDescription>Variáveis documentadas em .env.example</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-400">
          <div className="space-y-2">
            <Label>MAX_UPLOAD_MB</Label>
            <Input readOnly value={process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || "50"} />
          </div>
          <p>
            Persistência atual: IndexedDB neste navegador (aviso no topo do app). Schema Supabase em{" "}
            <code className="text-sky-300">supabase/migrations/</code> para evolução multiempresa.
          </p>
          <p>
            <Link href="/app/migrate" className="text-sky-300 hover:underline">
              Assistente de migração IndexedDB → nuvem
            </Link>{" "}
            — falha de forma segura sem Supabase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
