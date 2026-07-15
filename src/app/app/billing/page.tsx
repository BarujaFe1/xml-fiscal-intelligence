"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/design-system/PageHeader";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Store } from "lucide-react";
import { PLAN_SEEDS } from "@/lib/entitlements";

const FRIENDLY_LIMITS: Record<string, { label: string; format: (v: boolean | number) => string }> = {
  maxCompanies: { label: "Empresas", format: (v) => String(v) },
  maxEstablishments: { label: "Estabelecimentos", format: (v) => String(v) },
  maxUsers: { label: "Usuários", format: (v) => String(v) },
  maxDocumentsPerMonth: {
    label: "Documentos / mês",
    format: (v) => Number(v).toLocaleString("pt-BR"),
  },
  maxExportsPerMonth: { label: "Exportações / mês", format: (v) => String(v) },
  maxSpedGenerationsPerMonth: {
    label: "Gerações EFD / mês",
    format: (v) => String(v),
  },
  canGenerateEfdIcmsIpi: {
    label: "Diagnóstico EFD ICMS/IPI",
    format: (v) => (v ? "Incluído" : "Não incluído"),
  },
  hasAdvancedAudit: {
    label: "Auditoria avançada",
    format: (v) => (v ? "Incluída" : "Não incluída"),
  },
};

const billingConfigured = process.env.NEXT_PUBLIC_BILLING_READY === "true";
const commercialContact = process.env.NEXT_PUBLIC_COMMERCIAL_CONTACT;

type SubSnap = {
  status: string;
  planId: string | null;
  billingLive?: boolean;
  provider?: string;
};

export default function BillingPage() {
  const [sub, setSub] = useState<SubSnap | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Explicitly ignore redirect unlocks — show note only.
    if (params.get("checkout") === "success" || params.get("session_id")) {
      // do not set plan from query
    }
    void fetch("/api/billing/subscription?workspaceId=ws_local_demo")
      .then((r) => r.json())
      .then((data: SubSnap) => setSub(data))
      .catch(() => setSub(null));
  }, []);

  const hasPaid =
    billingConfigured && sub && (sub.status === "active" || sub.status === "trialing") && Boolean(sub.planId);

  if (!billingConfigured) {
    return (
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title="Planos e assinatura"
          description="Gerencie o plano da sua conta e a forma de pagamento quando a cobrança estiver disponível."
        />
        <EmptyState
          icon={Store}
          title="Assinaturas ainda não estão disponíveis neste ambiente"
          description="Este ambiente não possui cobrança configurada. O catálogo abaixo é ilustrativo e nenhuma assinatura é concedida automaticamente."
          action={
            commercialContact ? (
              <a
                href={commercialContact.startsWith("http") ? commercialContact : `mailto:${commercialContact}`}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400"
              >
                Falar com o comercial
              </a>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={hasPaid ? "Assinatura e planos" : "Planos"}
        description={
          hasPaid
            ? "Assinatura conforme estado verificado no serviço (webhook). Redirect de checkout não libera plano."
            : "Catálogo comercial. Não há assinatura ativa concedida por redirect — o provedor de pagamento precisa estar configurado e o webhook confirmado."
        }
      />

      <div className="flex flex-wrap gap-2">
        {sub && (
          <Badge tone={hasPaid ? "success" : "default"}>
            Status do serviço: {sub.status}
            {sub.planId ? ` · ${sub.planId}` : ""}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(PLAN_SEEDS).map(([id, plan]) => (
          <Card key={id} className="bg-slate-900/40">
            <CardHeader>
              <CardTitle>{plan.label}</CardTitle>
              <CardDescription>Disponível para contratação</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300 space-y-2">
              {Object.entries(FRIENDLY_LIMITS).map(([key, meta]) => {
                const value = plan.entitlements[key as keyof typeof plan.entitlements];
                if (value === undefined) return null;
                return (
                  <div key={key} className="flex justify-between gap-4 border-b border-white/5 py-1">
                    <span className="text-slate-400">{meta.label}</span>
                    <span>{meta.format(value)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
