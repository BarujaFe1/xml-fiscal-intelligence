"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { obligationRegistry } from "@/modules/obligations";

const LABELS: Record<string, string> = {
  "efd-icms-ipi": "EFD ICMS/IPI (SPED Fiscal)",
  "efd-contribuicoes": "EFD-Contribuições",
  ecd: "ECD",
  ecf: "ECF",
  reinf: "EFD-Reinf",
};

export default function ObligationsIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Obrigações fiscais</h1>
        <p className="text-slate-400 mt-1">
          Plugins versionados. Apenas cenários marcados como ativos geram arquivo — demais são stubs.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(obligationRegistry).map(([id, status]) => (
          <Card key={id} className="bg-slate-900/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge tone={status === "active" ? "success" : "warning"}>{status}</Badge>
              </div>
              <CardTitle className="text-lg">{LABELS[id] || id}</CardTitle>
              <CardDescription>
                {status === "active"
                  ? "Geração assistida com prontidão, TXT, manifesto e pré-validação interna."
                  : "Plugin reservado — sem geração nesta versão."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status === "active" ? (
                <Link href="/app/obligations/efd-icms-ipi" className="text-sky-300 hover:underline text-sm">
                  Abrir assistente →
                </Link>
              ) : (
                <span className="text-xs text-slate-500">Roadmap Fase 9</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
