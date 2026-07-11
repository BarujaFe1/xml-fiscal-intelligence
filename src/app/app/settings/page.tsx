"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import { FiscalContextSelector } from "@/components/layout/fiscal-context-selector";

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
