"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, FolderOpen, Upload, Activity, FileStack, Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { mergeBatchLists } from "@/lib/store/idb-store";
import type { Batch } from "@/types";
import { PageHeader } from "@/components/design-system/PageHeader";
import { EnvironmentIndicator } from "@/components/design-system/EnvironmentIndicator";
import { EmptyState } from "@/components/design-system/EmptyState";
import { NextActionCard } from "@/components/design-system/NextActionCard";
import { ProgressSteps } from "@/components/design-system/ProgressSteps";

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export default function AppHomePage() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/batches");
        const data = await res.json();
        const merged = await mergeBatchLists(data.batches || []);
        setBatches(merged);
      } catch {
        const merged = await mergeBatchLists([]);
        setBatches(merged);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalDocs = batches.reduce((a, b) => a + b.validXml, 0);
  const totalValue = batches.reduce((a, b) => a + b.totalValue, 0);
  const scored = batches.filter((b) => b.healthScore != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, b) => a + (b.healthScore as number), 0) / scored.length)
    : null;

  const currentStep = batches.length > 0 ? 1 : 0;

  const checklist: ChecklistItem[] = useMemo(() => {
    const hasBatch = batches.length > 0;
    const hasAudit = batches.some(
      (b) =>
        (b.quality?.warnings?.length || 0) > 0 ||
        (b.healthScore != null && b.healthScore < 100) ||
        b.quality?.evaluationStatus === "duplicates_only" ||
        b.quality?.evaluationStatus === "no_new_documents",
    );
    return [
      {
        id: "local",
        label: "Armazenamento local ativo",
        done: true,
        href: "/app/settings",
      },
      {
        id: "batch",
        label: "Primeiro lote importado",
        done: hasBatch,
        href: "/app/upload",
      },
      {
        id: "audit",
        label: "Revisar qualidade / achados",
        done: hasBatch && hasAudit,
        href: hasBatch ? `/app/batches/${batches[0]!.id}/quality` : "/app/audit",
      },
      {
        id: "export",
        label: "Gerar primeira exportação",
        done: false,
        href: hasBatch ? `/app/batches/${batches[0]!.id}/exports` : "/app/batches",
      },
      {
        id: "efd",
        label: "Conhecer diagnóstico EFD ICMS/IPI",
        done: false,
        href: "/app/obligations/efd-icms-ipi",
      },
      {
        id: "team",
        label: "Convite de equipe (requer sincronização em nuvem)",
        done: false,
        href: "/app/settings",
      },
    ];
  }, [batches]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Análise de lotes XML fiscais — dados ficam neste dispositivo até você ativar a sincronização."
        actions={
          <EnvironmentIndicator mode="local" onExplain={() => router.push("/app/settings?secao=armazenamento")} />
        }
      />

      <ProgressSteps steps={["Importar", "Conferir", "Resolver", "Fechar"]} current={currentStep} />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Lotes", value: batches.length, icon: FolderOpen },
          { label: "Documentos válidos", value: totalDocs, icon: FileStack },
          { label: "Valor consolidado", value: formatCurrency(totalValue), icon: Activity },
          { label: "Índice médio", value: avgScore == null ? "—" : avgScore, icon: Activity },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 text-sm">
                {m.label}
                <m.icon className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-50">{loading ? "…" : m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lotes recentes</CardTitle>
            <CardDescription>Abra um lote para dashboard, busca e exportações.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!loading && batches.length === 0 && (
              <EmptyState
                icon={Inbox}
                title="Nenhum lote ainda"
                description="Importe um arquivo ZIP para popular a visão geral com dados reais deste dispositivo."
              />
            )}
            {batches.slice(0, 8).map((b) => (
              <Link
                key={b.id}
                href={`/app/batches/${b.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 hover:bg-white/5"
              >
                <div>
                  <div className="font-medium text-slate-100">{b.name}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(b.createdAt)} · {b.validXml} XMLs · índice {b.healthScore ?? "—"}
                  </div>
                </div>
                <Badge tone={b.status === "completed" ? "success" : b.status === "failed" ? "error" : "warning"}>
                  {b.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!loading && batches.length === 0 && (
            <NextActionCard
              icon={Upload}
              title="Comece importando os documentos deste período"
              description="Importe um arquivo ZIP com os XMLs fiscais para iniciar a análise."
              actionLabel="Iniciar importação"
              onAction={() => router.push("/app/upload")}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Checklist inicial</CardTitle>
              <CardDescription>
                Onboarding progressivo — itens de sincronização ficam pendentes sem o serviço de
                armazenamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {checklist.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-white/5"
                >
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
                  )}
                  <span className={item.done ? "text-slate-400 line-through" : ""}>{item.label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/app/upload"
                className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sky-100"
              >
                <Upload className="h-4 w-4" /> Importar ZIP
              </Link>
              <Link
                href="/app/obligations/efd-icms-ipi"
                className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-slate-200 hover:bg-white/5"
              >
                Diagnóstico EFD
              </Link>
              <Link
                href="/app/batches"
                className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-slate-200 hover:bg-white/5"
              >
                Histórico de lotes
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
