"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  obligationRegistry,
  OBLIGATION_LABELS,
  OBLIGATION_BLURBS,
  type ObligationId,
} from "@/modules/obligations";

export default function ObligationsIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Obrigações fiscais</h1>
        <p className="text-slate-400 mt-1">
          Plugins versionados com geração assistida. Nenhum arquivo substitui PVA/portal oficial.
        </p>
        <Link
          href="/app/obligations/demo"
          className="inline-block mt-3 text-sm text-sky-300 hover:underline"
        >
          Abrir demonstração com NF-e de exemplo →
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(obligationRegistry) as ObligationId[]).map((id) => {
          const status = obligationRegistry[id];
          return (
            <Card key={id} className="bg-slate-900/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge tone={status === "active" ? "success" : "warning"}>{status}</Badge>
                </div>
                <CardTitle className="text-lg">{OBLIGATION_LABELS[id]}</CardTitle>
                <CardDescription>{OBLIGATION_BLURBS[id]}</CardDescription>
              </CardHeader>
              <CardContent>
                {status === "active" ? (
                  <Link
                    href={`/app/obligations/${id}`}
                    className="text-sky-300 hover:underline text-sm"
                  >
                    Abrir assistente →
                  </Link>
                ) : (
                  <span className="text-xs text-slate-500">Roadmap</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
