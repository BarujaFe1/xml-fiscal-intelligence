"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_SEEDS } from "@/lib/entitlements";

export default function BillingPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Assinatura</h1>
        <p className="text-slate-400 mt-1">
          Planos via entitlements (não por nome mágico no código). Checkout Stripe quando{" "}
          <code className="text-sky-300">BILLING_PROVIDER=stripe</code> e chaves configuradas; local usa mock.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(PLAN_SEEDS).map(([id, plan]) => (
          <Card key={id} className="bg-slate-900/40">
            <CardHeader>
              <CardTitle>{plan.label}</CardTitle>
              <CardDescription>id: {id}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-slate-400 space-y-1 font-mono">
              <div>maxCompanies: {plan.entitlements.maxCompanies}</div>
              <div>maxDocumentsPerMonth: {plan.entitlements.maxDocumentsPerMonth}</div>
              <div>maxSpedGenerationsPerMonth: {plan.entitlements.maxSpedGenerationsPerMonth}</div>
              <div>canGenerateEfdIcmsIpi: {String(plan.entitlements.canGenerateEfdIcmsIpi)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4 text-sm text-slate-400">
          Preços ficam no Stripe Dashboard / tabela <code>billing_prices</code> — não hardcode BRL no app.
          Webhooks em <code>/api/billing/webhook</code> com assinatura + idempotência.
        </CardContent>
      </Card>
    </div>
  );
}
