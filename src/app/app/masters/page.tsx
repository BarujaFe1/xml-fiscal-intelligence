"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MASTER_ENTITY_CATALOG } from "@/modules/master-data";

export default function MasterDataHubPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hub de dados mestres</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Cadastros compartilhados entre obrigações. Empresas/estabelecimentos usam o cadastro
          local existente; demais entidades estão tipadas como foundation/planned — sem cópias
          divergentes por obrigação.
        </p>
        <Link href="/app/companies" className="text-sm text-sky-300 hover:underline mt-2 inline-block">
          Abrir cadastro de empresas →
        </Link>
      </div>
      <div className="grid gap-3">
        {MASTER_ENTITY_CATALOG.map((e) => (
          <Card key={e.kind} className="bg-slate-900/40">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    e.status === "live" ? "success" : e.status === "foundation" ? "warning" : "default"
                  }
                >
                  {e.status}
                </Badge>
                <CardTitle className="text-base">{e.label}</CardTitle>
              </div>
              <CardDescription>{e.notes}</CardDescription>
            </CardHeader>
            <CardContent>
              {e.kind === "company" || e.kind === "establishment" ? (
                <Link href="/app/companies" className="text-sm text-sky-300 hover:underline">
                  Gerenciar →
                </Link>
              ) : (
                <span className="text-xs text-slate-500">Sem CRUD dedicado neste ciclo</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
