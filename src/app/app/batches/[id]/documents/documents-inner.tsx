"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { X } from "lucide-react";
import { Badge, typeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BatchTabs } from "@/components/batches/batch-tabs";
import {
  countActiveFilters,
  filterDocuments,
  filtersFromSearchParams,
  filtersToSearchParams,
  type DocFilterState,
} from "@/lib/analytics";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useBatchStore } from "@/lib/store/use-batch-store";
import { VirtualList } from "@/components/data-table/virtual-list";
import type { DocumentSummary } from "@/types";

export default function DocumentsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { store } = useBatchStore(params.id);
  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [, startTransition] = useTransition();

  function updateFilters(patch: Partial<DocFilterState>) {
    const next = { ...filters, ...patch };
    startTransition(() => {
      const sp = filtersToSearchParams(next);
      const qs = sp.toString();
      router.replace(`/app/batches/${params.id}/documents${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  }

  const rows = useMemo(() => (store ? filterDocuments(store, filters) : []), [store, filters]);

  const ufs = useMemo(() => {
    if (!store) return [];
    return [
      ...new Set(
        store.documents.flatMap((d) => [d.emitterUf, d.receiverUf].filter(Boolean) as string[]),
      ),
    ].sort();
  }, [store]);

  const cfops = useMemo(() => {
    if (!store) return [];
    return [...new Set(store.items.map((i) => i.cfop).filter(Boolean) as string[])]
      .sort()
      .slice(0, 80);
  }, [store]);

  const active = countActiveFilters(filters);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Lote</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            Documentos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {rows.length} de {store.documents.length} documentos
            {active ? ` · ${active} filtro(s)` : ""}
          </p>
        </div>
        {active > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              router.replace(`/app/batches/${params.id}/documents`);
            }}
          >
            <X className="h-4 w-4" /> Limpar filtros
          </Button>
        )}
      </div>

      <BatchTabs batchId={params.id} />

      <Card>
        <CardHeader>
          <CardTitle>Filtros densos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Busca livre (chave, CNPJ, nome…)"
              value={filters.q}
              onChange={(e) => updateFilters({ q: e.target.value })}
            />
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={filters.type}
              onChange={(e) => updateFilters({ type: e.target.value })}
            >
              <option value="ALL">Todos os tipos</option>
              <option value="NFE">NF-e</option>
              <option value="CTE">CT-e</option>
              <option value="NFSE">NFS-e</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={filters.uf}
              onChange={(e) => updateFilters({ uf: e.target.value })}
            >
              <option value="">UF (emit/dest)</option>
              {ufs.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={filters.parse}
              onChange={(e) => updateFilters({ parse: e.target.value })}
            >
              <option value="">Parse status</option>
              <option value="ok">ok</option>
              <option value="partial">partial</option>
              <option value="error">error</option>
            </select>
            <Input
              placeholder="Emitente (CNPJ/nome)"
              value={filters.emitter}
              onChange={(e) => updateFilters({ emitter: e.target.value })}
            />
            <Input
              placeholder="Destinatário (CNPJ/nome)"
              value={filters.receiver}
              onChange={(e) => updateFilters({ receiver: e.target.value })}
            />
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={filters.cfop}
              onChange={(e) => updateFilters({ cfop: e.target.value })}
            >
              <option value="">CFOP</option>
              {cfops.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={filters.alert}
              onChange={(e) => updateFilters({ alert: e.target.value })}
            >
              <option value="">Alerta</option>
              <option value="NO_KEY">Sem chave</option>
              <option value="NO_PROTOCOL">Sem protocolo</option>
              <option value="DUPLICATES">Duplicatas</option>
              <option value="NO_NCM">Itens sem NCM</option>
              <option value="NO_CFOP">Itens sem CFOP</option>
              <option value="OUTSIDE_PERIOD">Fora do período</option>
              <option value="ITEM_SUM_DIVERGENCE">Divergência soma</option>
              <option value="PARSE_ERROR">Erro de parse</option>
            </select>
            <Input
              placeholder="Valor mín."
              type="number"
              value={filters.minValue}
              onChange={(e) => updateFilters({ minValue: e.target.value })}
            />
            <Input
              placeholder="Valor máx."
              type="number"
              value={filters.maxValue}
              onChange={(e) => updateFilters({ maxValue: e.target.value })}
            />
            <Input
              placeholder="NCM"
              value={filters.ncm}
              onChange={(e) => updateFilters({ ncm: e.target.value })}
            />
          </div>

          {active > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(filters).map(([k, v]) => {
                if (!v || (k === "type" && v === "ALL")) return null;
                return (
                  <button
                    key={k}
                    onClick={() =>
                      updateFilters({
                        [k]: k === "type" ? "ALL" : "",
                      } as Partial<DocFilterState>)
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-xs text-sky-200"
                  >
                    {k}: {v} <X className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-white/5">
            <div className="sticky top-0 z-10 grid grid-cols-7 gap-2 border-b border-white/10 bg-slate-950/95 px-2 py-2 text-left text-xs text-slate-500 backdrop-blur">
              <span>Tipo</span>
              <span>Número</span>
              <span>Emissão</span>
              <span>Emitente</span>
              <span>Destinatário</span>
              <span className="text-right">Valor</span>
              <span>Parse</span>
            </div>
            <VirtualList
              items={rows}
              estimateSize={48}
              height={560}
              empty={
                <div className="p-10 text-center text-slate-400">
                  Nenhum documento com esses filtros.
                  <div className="mt-2">
                    <button
                      className="text-sky-300 hover:underline"
                      onClick={() => {
                        router.replace(`/app/batches/${params.id}/documents`);
                      }}
                    >
                      Limpar e ver todos
                    </button>
                  </div>
                </div>
              }
              renderRow={(d: DocumentSummary) => (
                <div className="grid grid-cols-7 gap-2 border-b border-white/5 px-2 py-2 text-sm hover:bg-white/[0.03]">
                  <span>
                    <Badge tone={typeTone(d.documentType)}>{d.documentType}</Badge>
                  </span>
                  <Link
                    className="truncate text-sky-300 hover:underline font-medium"
                    href={`/app/batches/${params.id}/documents/${d.id}`}
                  >
                    {d.number || d.fileName}
                  </Link>
                  <span className="text-slate-400 whitespace-nowrap">{formatDate(d.issueDate)}</span>
                  <span className="truncate">{d.emitterName || "—"}</span>
                  <span className="truncate">{d.receiverName || "—"}</span>
                  <span className="text-right tabular-nums">{formatCurrency(d.totalValue)}</span>
                  <span className="text-slate-400">{d.parseStatus}</span>
                </div>
              )}
            />
            <div className="p-2 text-xs text-slate-500">
              {rows.length.toLocaleString("pt-BR")} linha(s) · virtualização ativa
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
