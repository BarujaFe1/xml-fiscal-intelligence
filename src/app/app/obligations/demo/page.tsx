"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EfdDiagnosticBanner } from "@/components/feedback/honesty-banners";
import { OBLIGATION_LABELS, type ObligationId } from "@/modules/obligations";

type DemoResult = {
  canGenerate: boolean;
  ok: boolean;
  recordCount: number;
  contentHash: string | null;
  contentPreview: string | null;
  content: string | null;
  warnings: string[];
  disclaimer: string | null;
  issues: Array<{ severity: string; message: string }>;
  readiness: Array<{ id: string; label: string; status: string; message?: string }>;
};

export default function ObligationsDemoPage() {
  const [loading, setLoading] = useState(false);
  const [sample, setSample] = useState<Record<string, unknown> | null>(null);
  const [results, setResults] = useState<Record<string, DemoResult> | null>(null);
  const [note, setNote] = useState("");

  async function runDemo() {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/obligations/demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Falha na demo");
        return;
      }
      setSample(data.sample);
      setResults(data.results);
      setNote(data.note || "");
      toast.success("Demonstração gerada para todas as obrigações");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  function download(id: string, content: string) {
    const ext = id === "reinf" ? "json" : "txt";
    const blob = new Blob([content], {
      type: ext === "json" ? "application/json" : "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `demo-${id}.${ext}`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Demonstração</p>
        <h1 className="text-2xl font-bold">Obrigações com NF-e de exemplo</h1>
        <p className="text-slate-400 mt-1 max-w-2xl">
          Executa EFD ICMS/IPI, EFD-Contribuições, ECD, ECF e Reinf sobre{" "}
          <code className="text-sky-300">samples/anonymized/nfe-example.xml</code>. Ideal para
          mostrar o pipeline sem ZIP real.
        </p>
        <Link href="/app/obligations" className="text-sm text-sky-300 hover:underline mt-2 inline-block">
          ← Voltar à lista
        </Link>
      </div>

      <EfdDiagnosticBanner />

      <Card>
        <CardHeader>
          <CardTitle>Rodar demonstração</CardTitle>
          <CardDescription>
            Gera rascunhos assistidos e exibe prévia + prontidão de cada plugin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" disabled={loading} onClick={() => void runDemo()}>
            {loading ? "Gerando…" : "Gerar todas as obrigações (sample NF-e)"}
          </Button>
          {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
          {sample && (
            <p className="mt-2 text-xs text-slate-400 font-mono">
              sample: tipo={String(sample.documentType)} nNF={String(sample.number)} itens=
              {String(sample.itemCount)} valor={String(sample.totalValue)}
            </p>
          )}
        </CardContent>
      </Card>

      {results && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(Object.keys(results) as ObligationId[]).map((id) => {
            const r = results[id];
            return (
              <Card key={id} className="bg-slate-900/40">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.canGenerate ? "success" : "warning"}>
                      {r.canGenerate ? "gerou" : "bloqueado"}
                    </Badge>
                    <Badge tone={r.ok ? "success" : "warning"}>
                      {r.ok ? "validação ok" : "avisos"}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{OBLIGATION_LABELS[id]}</CardTitle>
                  <CardDescription className="text-xs">{r.disclaimer}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="text-slate-400">
                    registros≈{r.recordCount} · hash={(r.contentHash || "").slice(0, 12)}
                  </p>
                  {r.warnings?.slice(0, 3).map((w) => (
                    <p key={w} className="text-amber-200/80">
                      • {w}
                    </p>
                  ))}
                  {r.contentPreview && (
                    <pre className="max-h-40 overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[10px] whitespace-pre-wrap">
                      {r.contentPreview}
                    </pre>
                  )}
                  {r.content && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => download(id, r.content!)}
                    >
                      Baixar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
