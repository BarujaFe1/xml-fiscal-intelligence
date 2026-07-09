"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { compareBatches } from "@/lib/analytics";
import { formatCurrency, formatCnpjCpf } from "@/lib/utils";
import { idbGetBatchStore, idbListBatches } from "@/lib/store/idb-store";
import { useBatchStore } from "@/lib/store/use-batch-store";
import type { Batch, BatchStore } from "@/types";

function Delta({ value, money = false }: { value: number; money?: boolean }) {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const tone = value > 0 ? "text-emerald-300" : value < 0 ? "text-rose-300" : "text-slate-400";
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {money ? formatCurrency(value) : value > 0 ? `+${value}` : value}
    </span>
  );
}

export default function ComparePage() {
  const params = useParams<{ id: string }>();
  const { store: current } = useBatchStore(params.id);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [otherId, setOtherId] = useState("");
  const [other, setOther] = useState<BatchStore | null>(null);

  useEffect(() => {
    idbListBatches().then((list) => {
      setBatches(list.filter((b) => b.id !== params.id));
    });
  }, [params.id]);

  useEffect(() => {
    if (!otherId) return;
    let cancelled = false;
    idbGetBatchStore(otherId).then((store) => {
      if (!cancelled) setOther(store);
    });
    return () => {
      cancelled = true;
    };
  }, [otherId]);

  const otherStore = otherId ? other : null;

  const result = useMemo(() => {
    if (!current || !otherStore) return null;
    // Treat selected "other" as baseline A, current as B (mês atual)
    return compareBatches(otherStore, current);
  }, [current, otherStore]);

  if (!current) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Comparador</p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Mês contra mês
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Compare este lote com outro processado neste navegador.
        </p>
      </div>

      <BatchTabs batchId={params.id} />

      <Card>
        <CardHeader>
          <CardTitle>Selecionar baseline</CardTitle>
          <CardDescription>
            Atual: <span className="text-slate-200">{current.batch.name}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              Processe outro ZIP (ex.: mês anterior) para comparar.
              <div className="mt-3">
                <Link href="/app/upload" className="text-sky-300 hover:underline">
                  Ir para upload
                </Link>
              </div>
            </div>
          ) : (
            <select
              className="h-11 w-full max-w-md rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={otherId}
              onChange={(e) => {
                setOtherId(e.target.value);
                setOther(null);
              }}
            >
              <option value="">Escolha o lote anterior…</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.validXml} XMLs · score {b.healthScore}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-slate-400">Documentos</div>
                <div className="mt-1 text-2xl font-semibold">{result.b.docs}</div>
                <div className="mt-1 text-sm">
                  vs {result.a.docs} · <Delta value={result.deltaDocs} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-slate-400">Valor</div>
                <div className="mt-1 text-2xl font-semibold">{formatCurrency(result.b.value)}</div>
                <div className="mt-1 text-sm">
                  vs {formatCurrency(result.a.value)} · <Delta value={result.deltaValue} money />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-slate-400">Health Score</div>
                <div className="mt-1 text-2xl font-semibold">{result.b.score}</div>
                <div className="mt-1 text-sm">
                  vs {result.a.score} · <Delta value={result.deltaScore} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Emitentes novos</CardTitle>
                <CardDescription>Aparecem no lote atual e não no baseline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.newEmitters.length === 0 && (
                  <div className="text-slate-500">Nenhum emitente novo.</div>
                )}
                {result.newEmitters.map((p) => (
                  <div key={p.doc} className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <div>
                      <div className="text-slate-200">{p.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{formatCnpjCpf(p.doc)}</div>
                    </div>
                    <div className="text-right">
                      <Badge tone="success">novo</Badge>
                      <div className="mt-1">{formatCurrency(p.total)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emitentes que sumiram</CardTitle>
                <CardDescription>Estavam no baseline e não no atual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.goneEmitters.length === 0 && (
                  <div className="text-slate-500">Nenhum emitente ausente.</div>
                )}
                {result.goneEmitters.map((p) => (
                  <div key={p.doc} className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <div>
                      <div className="text-slate-200">{p.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{formatCnpjCpf(p.doc)}</div>
                    </div>
                    <div className="text-right text-slate-400">{formatCurrency(p.total)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recorrentes com maior variação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.recurringEmitters.map((p) => (
                  <div key={p.doc} className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-slate-200">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {formatCurrency(p.prevTotal)} → {formatCurrency(p.total)}
                      </div>
                    </div>
                    <Delta value={p.delta} money />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>CFOP — variação de frequência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.cfopDelta.map((c) => (
                  <div key={c.cfop} className="flex justify-between border-b border-white/5 py-2">
                    <span className="font-mono text-sky-200">{c.cfop}</span>
                    <span className="text-slate-400">
                      {c.a} → {c.b} · <Delta value={c.delta} />
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
