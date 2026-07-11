"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  hasAiExplanations: {
    label: "Assistente IA",
    format: (v) => (v ? "Incluído" : "Não incluído"),
  },
};

const isDev = process.env.NODE_ENV === "development";
const billingConfigured = process.env.NEXT_PUBLIC_BILLING_READY === "true";

export default function BillingPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge tone={billingConfigured ? "success" : "warning"}>
            {billingConfigured ? "Billing configurado" : "Ambiente de demonstração"}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold">Planos</h1>
        <p className="text-slate-400 mt-1">
          {billingConfigured
            ? "Gerencie assinatura e uso conforme entitlements do workspace."
            : "Catálogo comercial ilustrativo. Não há assinatura ativa nem checkout — Stripe não está configurado neste ambiente."}
        </p>
      </div>

      {!billingConfigured && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-100/90">
            Cobrança indisponível. Nenhum plano pago será concedido por redirect ou query string.
            Configure <code className="text-sky-300">BILLING_PROVIDER=stripe</code> e chaves no
            servidor para habilitar checkout real.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(PLAN_SEEDS).map(([id, plan]) => (
          <Card key={id} className="bg-slate-900/40">
            <CardHeader>
              <CardTitle>{plan.label}</CardTitle>
              <CardDescription>
                {billingConfigured ? "Disponível para contratação" : "Prévia de limites"}
              </CardDescription>
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
              {isDev && (
                <p className="pt-2 text-[10px] text-slate-600 font-mono">dev plan id: {id}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
