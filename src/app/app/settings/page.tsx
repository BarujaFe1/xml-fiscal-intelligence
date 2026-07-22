"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import { FiscalContextSelector } from "@/components/layout/fiscal-context-selector";
import { PageHeader } from "@/components/design-system/PageHeader";
import { TechnicalDetailsDrawer } from "@/components/design-system/TechnicalDetailsDrawer";
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
      <PageHeader
        title="Configurações"
        description="Preferências do aplicativo. A conta e a sincronização em nuvem dependem de um serviço de armazenamento configurado."
      />

      <LocalPersistenceBanner />

      <Suspense fallback={<div className="skeleton h-40 rounded-xl" />}>
        <FiscalContextSelector />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Privacidade</CardTitle>
          <CardDescription>Mascaramento de CNPJ/CPF na interface</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Mascarar documentos por padrão</span>
            <input type="checkbox" checked={masking} onChange={(e) => persistMasking(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Modo de demonstração</span>
            <input type="checkbox" checked={demo} onChange={(e) => persistDemo(e.target.checked)} />
          </label>
        </CardContent>
      </Card>

      <TechnicalDetailsDrawer title="Diagnóstico técnico">
        <div className="space-y-4">
          <div>
            <p className="font-medium text-slate-200">Versão do sistema</p>
            <p className="font-mono text-xs text-slate-300">{formatReleaseLabel(getReleaseInfo())}</p>
            <p className="text-slate-500 text-xs">Canal: {getReleaseInfo().channel}</p>
          </div>

          <div>
            <p className="font-medium text-slate-200">Governança regulatória</p>
            <p className="text-slate-500 text-xs">
              Constantes embutidas na versão do sistema. Catálogo do serviço de armazenamento quando a
              nuvem estiver conectada.
            </p>
            <div className="mt-1 space-y-1">
              <div className="flex justify-between gap-3">
                <span>parser</span>
                <span className="text-slate-200">{PARSER_RUNTIME_VERSION}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>conjunto de regras</span>
                <span className="text-slate-200">{RULE_SET_RUNTIME_VERSION}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>modelo de dados</span>
                <span className="text-slate-200">{SCHEMA_RUNTIME_VERSION}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>fórmula de qualidade</span>
                <span className="text-slate-200">{QUALITY_FORMULA_VERSION}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>leiaute EFD ICMS/IPI</span>
                <span className="text-slate-200">{EFD_ICMS_IPI_LAYOUT_2026}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="font-medium text-slate-200">Suporte de parsers</p>
            <p className="text-slate-500 text-xs">Matriz declarada — não inventa cobertura.</p>
            <div className="mt-1 space-y-1">
              {parserSupportSummary().map((p) => (
                <div key={p.family} className="flex justify-between gap-3 border-b border-white/5 py-1">
                  <span>{p.family}</span>
                  <span className="text-slate-500 text-xs">{p.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="font-medium text-slate-200">Ambiente</p>
            <div className="mt-1 space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="xfi-max-upload-mb">Limite de upload (MB)</Label>
                <Input id="xfi-max-upload-mb" readOnly value={process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || "50"} />
              </div>
              <p>
                Armazenamento atual: neste dispositivo (veja o aviso acima). Modelo de dados do serviço
                de armazenamento em <code className="text-sky-300">supabase/migrations/</code> para
                evolução multiempresa.
              </p>
              <p>
                <Link href="/app/migrate" className="text-sky-300 hover:underline">
                  Assistente de migração (dispositivo → serviço de armazenamento)
                </Link>{" "}
                — falha de forma segura sem o serviço de nuvem.
              </p>
            </div>
          </div>
        </div>
      </TechnicalDetailsDrawer>
    </div>
  );
}
