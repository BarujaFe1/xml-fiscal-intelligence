"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  obligationRegistry,
  OBLIGATION_LABELS,
  OBLIGATION_BLURBS,
  getSupportProfile,
  canOpenAssistant,
  type ObligationId,
} from "@/modules/obligations";
import { OBLIGATION_MATURITY_LABELS } from "@/modules/obligations/core/maturity";

function maturityTone(m: string): "success" | "warning" | "error" | "info" | "default" {
  if (m === "internal_beta" || m === "official_validator_beta") return "warning";
  if (m === "validated_scope" || m === "production") return "success";
  if (m === "planned") return "default";
  return "info";
}

export default function ObligationsIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Obrigações fiscais</h1>
        <p className="text-slate-400 mt-1">
          Maturidade honesta por obrigação. Página existente ≠ produção. Nenhum arquivo substitui o
          programa oficial.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/app/closing" className="text-sky-300 hover:underline">
            Cockpit de fechamento →
          </Link>
          <Link href="/app/masters" className="text-sky-300 hover:underline">
            Dados mestres →
          </Link>
          <Link href="/app/validators-lab" className="text-sky-300 hover:underline">
            Lab. validadores →
          </Link>
          <Link href="/app/obligations/demo" className="text-sky-300 hover:underline">
            Demo NF-e →
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(obligationRegistry) as ObligationId[]).map((id) => {
          const profile = getSupportProfile(id);
          const open = canOpenAssistant(id);
          return (
            <Card key={id} className="bg-slate-900/40">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={maturityTone(profile.maturity)}>
                    {OBLIGATION_MATURITY_LABELS[profile.maturity]}
                  </Badge>
                  {profile.officialProgramVersion ? (
                    <span className="text-[11px] text-slate-500">{profile.officialProgramVersion}</span>
                  ) : null}
                </div>
                <CardTitle className="text-lg">{OBLIGATION_LABELS[id]}</CardTitle>
                <CardDescription>{OBLIGATION_BLURBS[id]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-400">
                <p>
                  <span className="text-slate-500">Limitações: </span>
                  {profile.limitations[0]}
                </p>
                <p>
                  <span className="text-slate-500">Não suportado: </span>
                  {profile.unsupported.slice(0, 3).join("; ")}
                  {profile.unsupported.length > 3 ? "…" : ""}
                </p>
                {open ? (
                  <Link
                    href={`/app/obligations/${id}`}
                    className="inline-block text-sky-300 hover:underline text-sm"
                  >
                    Abrir assistente →
                  </Link>
                ) : (
                  <span className="text-slate-500">Somente roadmap</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
