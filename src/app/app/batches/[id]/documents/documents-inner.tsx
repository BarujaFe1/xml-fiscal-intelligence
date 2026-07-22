"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Columns3,
  Download,
  Filter,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Badge, typeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { VirtualList } from "@/components/data-table/virtual-list";
import { DocumentExportModal } from "@/components/documents/document-export-modal";
import {
  activeFilterEntries,
  countActiveFilters,
  filterDocuments,
  filtersFromSearchParams,
  filtersToSearchParams,
  sumDocumentValues,
  type DocFilterState,
} from "@/lib/analytics";
import {
  DOCUMENT_COLUMNS,
  defaultVisibleColumns,
  loadVisibleColumns,
  saveVisibleColumns,
  toggleColumnVisibility,
  type DocumentColumnId,
} from "@/lib/documents/columns";
import {
  clearSelection,
  countSelectedOutsideFilter,
  deselectFiltered,
  invertFilteredSelection,
  resolveSelectedDocuments,
  selectAllFiltered,
  selectionHeaderState,
  selectVisibleOnly,
  toggleDocumentSelection,
} from "@/lib/documents/selection";
import { idbHasRawXmlAvailability } from "@/lib/store/raw-xml-store";
import { useBatchStore } from "@/lib/store/use-batch-store";
import { formatCnpjCpf, formatCurrency, formatDateTime } from "@/lib/utils";
import { detectDocumentRtcLabels } from "@/lib/documents/rtc-labels";
import type { DocumentSummary } from "@/types";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function TriStateCheckbox({
  state,
  onChange,
  label,
}: {
  state: "none" | "some" | "all";
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 accent-sky-400"
      checked={state === "all"}
      onChange={onChange}
      aria-label={label}
      aria-checked={state === "some" ? "mixed" : state === "all"}
    />
  );
}

function TruncTip({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className || "truncate"} title={text || undefined}>
      {text || "—"}
    </span>
  );
}

export default function DocumentsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { store, loading } = useBatchStore(params.id);
  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [, startTransition] = useTransition();

  const [qDraft, setQDraft] = useState(filters.q);
  const [prevFiltersQ, setPrevFiltersQ] = useState(filters.q);
  if (filters.q !== prevFiltersQ) {
    setPrevFiltersQ(filters.q);
    setQDraft(filters.q);
  }
  const qDebounced = useDebouncedValue(qDraft, 300);
  const [moreOpen, setMoreOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [visibleCols, setVisibleCols] = useState<Set<DocumentColumnId>>(() =>
    typeof window === "undefined" ? defaultVisibleColumns() : loadVisibleColumns(),
  );
  const [xmlAvail, setXmlAvail] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (qDebounced === filters.q) return;
    updateFilters({ q: qDebounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync draft → URL
  }, [qDebounced]);

  function updateFilters(patch: Partial<DocFilterState>) {
    const next = { ...filters, ...patch };
    startTransition(() => {
      const sp = filtersToSearchParams(next);
      const qs = sp.toString();
      router.replace(`/app/batches/${params.id}/documents${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  }

  const rows = useMemo(() => (store ? filterDocuments(store, filters) : []), [store, filters]);
  const rtcById = useMemo(() => {
    if (!store) return new Map();
    const itemsByDoc = new Map<string, typeof store.items>();
    for (const item of store.items) {
      const list = itemsByDoc.get(item.documentId);
      if (list) list.push(item);
      else itemsByDoc.set(item.documentId, [item]);
    }
    const map = new Map<string, ReturnType<typeof detectDocumentRtcLabels>>();
    for (const d of store.documents) {
      map.set(d.id, detectDocumentRtcLabels(d, itemsByDoc.get(d.id)));
    }
    return map;
  }, [store]);
  const filteredIds = useMemo(() => rows.map((d) => d.id), [rows]);
  const filteredTotal = useMemo(() => sumDocumentValues(rows), [rows]);
  const headerState = useMemo(
    () => selectionHeaderState(filteredIds, selectedIds),
    [filteredIds, selectedIds],
  );
  const outsideCount = useMemo(
    () => countSelectedOutsideFilter(selectedIds, filteredIds),
    [selectedIds, filteredIds],
  );
  const selectedResolved = useMemo(
    () => (store ? resolveSelectedDocuments(store.documents, selectedIds) : null),
    [store, selectedIds],
  );

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    idbHasRawXmlAvailability(
      store.batch.id,
      store.documents.map((d) => d.id),
    ).then((map) => {
      if (!cancelled) setXmlAvail(map);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const selectedXmlStats = useMemo(() => {
    let withXml = 0;
    let withoutXml = 0;
    for (const id of selectedIds) {
      if (xmlAvail.get(id)) withXml += 1;
      else withoutXml += 1;
    }
    return { withXml, withoutXml };
  }, [selectedIds, xmlAvail]);

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
  const chips = activeFilterEntries(filters);
  const cols = DOCUMENT_COLUMNS.filter((c) => visibleCols.has(c.id));

  const onHeaderCheck = useCallback(() => {
    if (headerState === "all") {
      setSelectedIds((prev) => deselectFiltered(prev, filteredIds));
    } else {
      setSelectedIds((prev) => selectAllFiltered(prev, filteredIds));
    }
  }, [headerState, filteredIds]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Carregando documentos">
        <div className="skeleton h-16 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-100" role="alert">
        Lote não encontrado neste navegador. Importe o ZIP novamente ou selecione outro lote.
      </div>
    );
  }

  const gridTemplate = cols.map((c) => `${c.minWidth || 80}px`).join(" ");

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Lote</p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            Documentos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {rows.length.toLocaleString("pt-BR")} de {store.documents.length.toLocaleString("pt-BR")}{" "}
            documentos · total filtrado {formatCurrency(filteredTotal)}
            {active ? ` · ${active} filtro(s)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setCompact((v) => !v)}>
            {compact ? "Tabela" : "Compacto"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setColumnsOpen((v) => !v)}>
            <Columns3 className="h-4 w-4" /> Colunas
          </Button>
          {active > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQDraft("");
                router.replace(`/app/batches/${params.id}/documents`);
              }}
            >
              <X className="h-4 w-4" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <BatchTabs batchId={params.id} />

      {columnsOpen && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Colunas visíveis</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const next = defaultVisibleColumns();
                setVisibleCols(next);
                saveVisibleColumns(next);
              }}
            >
              Restaurar padrão
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {DOCUMENT_COLUMNS.map((col) => (
              <label key={col.id} className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="accent-sky-400"
                  checked={visibleCols.has(col.id)}
                  disabled={col.id === "select"}
                  onChange={() => {
                    const next = toggleColumnVisibility(visibleCols, col.id);
                    setVisibleCols(next);
                    saveVisibleColumns(next);
                  }}
                />
                {col.label}
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Filtros</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setMoreOpen((v) => !v)}>
            <Filter className="h-4 w-4" /> {moreOpen ? "Menos filtros" : "Mais filtros"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              placeholder="Busca livre (chave, CNPJ, nome…)"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              aria-label="Busca livre"
            />
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilters({ dateFrom: e.target.value })}
              aria-label="Data inicial"
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilters({ dateTo: e.target.value })}
              aria-label="Data final"
            />
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={filters.type}
              onChange={(e) => updateFilters({ type: e.target.value })}
              aria-label="Tipo documental"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="NFE">NF-e</option>
              <option value="NFCE">NFC-e</option>
              <option value="CTE">CT-e</option>
              <option value="NFSE">NFS-e</option>
              <option value="EVENT">Evento</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
            <Input
              placeholder="Emitente (CNPJ/nome)"
              value={filters.emitter}
              onChange={(e) => updateFilters({ emitter: e.target.value })}
              aria-label="Emitente"
            />
            <Input
              placeholder="Destinatário (CNPJ/nome)"
              value={filters.receiver}
              onChange={(e) => updateFilters({ receiver: e.target.value })}
              aria-label="Destinatário"
            />
            <Input
              placeholder="Valor mín."
              type="number"
              value={filters.minValue}
              onChange={(e) => updateFilters({ minValue: e.target.value })}
              aria-label="Valor mínimo"
            />
            <Input
              placeholder="Valor máx."
              type="number"
              value={filters.maxValue}
              onChange={(e) => updateFilters({ maxValue: e.target.value })}
              aria-label="Valor máximo"
            />
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={filters.cbs}
              onChange={(e) => updateFilters({ cbs: e.target.value })}
              aria-label="Filtro etiqueta CBS"
            >
              <option value="">CBS (todas)</option>
              <option value="with">Com etiqueta CBS</option>
              <option value="without">Sem etiqueta CBS</option>
            </select>
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={filters.ibs}
              onChange={(e) => updateFilters({ ibs: e.target.value })}
              aria-label="Filtro etiqueta IBS"
            >
              <option value="">IBS (todas)</option>
              <option value="with">Com etiqueta IBS</option>
              <option value="without">Sem etiqueta IBS</option>
            </select>
          </div>

          {moreOpen && (
            <div className="grid gap-3 rounded-xl border border-white/5 p-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                placeholder="Número"
                value={filters.number}
                onChange={(e) => updateFilters({ number: e.target.value })}
              />
              <Input
                placeholder="Série"
                value={filters.series}
                onChange={(e) => updateFilters({ series: e.target.value })}
              />
              <Input
                placeholder="Modelo"
                value={filters.model}
                onChange={(e) => updateFilters({ model: e.target.value })}
              />
              <Input
                placeholder="Chave de acesso"
                value={filters.accessKey}
                onChange={(e) => updateFilters({ accessKey: e.target.value })}
              />
              <Input
                placeholder="CNPJ/CPF emitente"
                value={filters.emitterDoc}
                onChange={(e) => updateFilters({ emitterDoc: e.target.value })}
              />
              <Input
                placeholder="CNPJ/CPF destinatário"
                value={filters.receiverDoc}
                onChange={(e) => updateFilters({ receiverDoc: e.target.value })}
              />
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.ufOrigin}
                onChange={(e) => updateFilters({ ufOrigin: e.target.value })}
                aria-label="UF origem"
              >
                <option value="">UF origem</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.ufDest}
                onChange={(e) => updateFilters({ ufDest: e.target.value })}
                aria-label="UF destino"
              >
                <option value="">UF destino</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.uf}
                onChange={(e) => updateFilters({ uf: e.target.value })}
                aria-label="UF emitente ou destinatário"
              >
                <option value="">UF (emit/dest)</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Natureza da operação"
                value={filters.nature}
                onChange={(e) => updateFilters({ nature: e.target.value })}
              />
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.classification}
                onChange={(e) => updateFilters({ classification: e.target.value })}
                aria-label="Classificação"
              >
                <option value="">Classificação</option>
                {(
                  [
                    "compra",
                    "venda",
                    "devolucao",
                    "transferencia",
                    "remessa",
                    "transporte",
                    "servico",
                    "desconhecido",
                  ] as const
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.cfop}
                onChange={(e) => updateFilters({ cfop: e.target.value })}
                aria-label="CFOP"
              >
                <option value="">CFOP</option>
                {cfops.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input
                placeholder="NCM"
                value={filters.ncm}
                onChange={(e) => updateFilters({ ncm: e.target.value })}
              />
              <Input
                placeholder="Situação"
                value={filters.status}
                onChange={(e) => updateFilters({ status: e.target.value })}
              />
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.protocol}
                onChange={(e) => updateFilters({ protocol: e.target.value })}
                aria-label="Protocolo"
              >
                <option value="">Protocolo</option>
                <option value="with">Com protocolo</option>
                <option value="without">Sem protocolo</option>
              </select>
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.duplicate}
                onChange={(e) => updateFilters({ duplicate: e.target.value })}
                aria-label="Duplicidade"
              >
                <option value="">Duplicidade</option>
                <option value="normal">Normal</option>
                <option value="duplicate">Duplicada</option>
                <option value="possible">Possível duplicidade</option>
              </select>
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.parse}
                onChange={(e) => updateFilters({ parse: e.target.value })}
                aria-label="Status de parse"
              >
                <option value="">Parse status</option>
                <option value="ok">ok</option>
                <option value="partial">partial</option>
                <option value="error">error</option>
              </select>
              <select
                className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
                value={filters.alert}
                onChange={(e) => updateFilters({ alert: e.target.value })}
                aria-label="Alertas"
              >
                <option value="">Alerta</option>
                <option value="HAS_CBS">Com etiqueta CBS</option>
                <option value="NO_CBS">Sem etiqueta CBS (avisar fornecedor)</option>
                <option value="HAS_IBS">Com etiqueta IBS</option>
                <option value="NO_IBS">Sem etiqueta IBS</option>
                <option value="HAS_ALERTS">Com alertas</option>
                <option value="NO_ALERTS">Sem alertas</option>
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
                placeholder="Score mín."
                type="number"
                value={filters.qualityMin}
                onChange={(e) => updateFilters({ qualityMin: e.target.value })}
              />
              <Input
                placeholder="Score máx."
                type="number"
                value={filters.qualityMax}
                onChange={(e) => updateFilters({ qualityMax: e.target.value })}
              />
            </div>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Filtros ativos">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    if (chip.key === "q") setQDraft("");
                    updateFilters({
                      [chip.key]: chip.key === "type" ? "ALL" : "",
                    } as Partial<DocFilterState>);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-xs text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  {chip.label}: {chip.value} <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-sky-300"
                onClick={() => {
                  setQDraft("");
                  router.replace(`/app/batches/${params.id}/documents`);
                }}
              >
                Limpar todos
              </button>
            </div>
          )}

          {!compact ? (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <div className="min-w-[1100px]">
              <div
                className="sticky top-0 z-10 grid gap-2 border-b border-white/10 bg-slate-950/95 px-2 py-2 text-left text-xs text-slate-500 backdrop-blur"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {cols.map((col) => {
                  if (col.id === "select") {
                    return (
                      <span key={col.id} className="flex items-center">
                        <TriStateCheckbox
                          state={headerState}
                          onChange={onHeaderCheck}
                          label="Selecionar todos os resultados filtrados"
                        />
                      </span>
                    );
                  }
                  return (
                    <span
                      key={col.id}
                      className={col.align === "right" ? "text-right" : undefined}
                    >
                      {col.label}
                    </span>
                  );
                })}
              </div>
              <VirtualList
                items={rows}
                estimateSize={56}
                height={560}
                getItemKey={(d) => d.id}
                empty={
                  <div className="p-10 text-center text-slate-400">
                    Nenhum documento com esses filtros.
                    <div className="mt-2">
                      <button
                        className="text-sky-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                        onClick={() => {
                          setQDraft("");
                          router.replace(`/app/batches/${params.id}/documents`);
                        }}
                      >
                        Limpar e ver todos
                      </button>
                    </div>
                  </div>
                }
                renderRow={(d: DocumentSummary) => (
                  <div
                    className="grid h-full items-center gap-2 border-b border-white/5 px-2 text-sm hover:bg-white/[0.03]"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {cols.map((col) => {
                      switch (col.id) {
                        case "select":
                          return (
                            <span key={col.id}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-sky-400"
                                checked={selectedIds.has(d.id)}
                                onChange={() =>
                                  setSelectedIds((prev) => toggleDocumentSelection(prev, d.id))
                                }
                                aria-label={`Selecionar documento ${d.number || d.fileName}`}
                              />
                            </span>
                          );
                        case "type":
                          return (
                            <span key={col.id}>
                              <Badge tone={typeTone(d.documentType)}>{d.documentType}</Badge>
                            </span>
                          );
                        case "number":
                          return (
                            <TruncTip key={col.id} text={d.number || d.fileName} className="font-medium" />
                          );
                        case "series":
                          return <TruncTip key={col.id} text={d.series || "—"} />;
                        case "model":
                          return <TruncTip key={col.id} text={d.model || "—"} />;
                        case "issueDate":
                          return (
                            <span key={col.id} className="whitespace-nowrap text-slate-400">
                              {formatDateTime(d.issueDate)}
                            </span>
                          );
                        case "emitter":
                          return (
                            <div key={col.id} className="min-w-0">
                              <TruncTip text={d.emitterName || "—"} className="block truncate" />
                              <span className="block truncate text-xs text-slate-500">
                                {formatCnpjCpf(d.emitterDoc, false)}
                              </span>
                            </div>
                          );
                        case "receiver":
                          return (
                            <div key={col.id} className="min-w-0">
                              <TruncTip text={d.receiverName || "—"} className="block truncate" />
                              <span className="block truncate text-xs text-slate-500">
                                {formatCnpjCpf(d.receiverDoc, false)}
                              </span>
                            </div>
                          );
                        case "ufOrigin":
                          return <span key={col.id}>{d.emitterUf || "—"}</span>;
                        case "ufDest":
                          return <span key={col.id}>{d.receiverUf || "—"}</span>;
                        case "nature":
                          return <TruncTip key={col.id} text={d.natureOperation || "—"} />;
                        case "cfop":
                          return <span key={col.id}>{d.cfopMain || "—"}</span>;
                        case "value":
                          return (
                            <span key={col.id} className="text-right tabular-nums">
                              {formatCurrency(d.totalValue)}
                            </span>
                          );
                        case "status":
                          return (
                            <span key={col.id}>
                              <Badge tone="default">{d.status || "—"}</Badge>
                            </span>
                          );
                        case "protocol":
                          return <TruncTip key={col.id} text={d.protocol || "—"} />;
                        case "duplicate":
                          return (
                            <span key={col.id}>
                              {d.isDuplicate ? (
                                <Badge tone="warning">Duplicada</Badge>
                              ) : (
                                <span className="text-slate-500">Normal</span>
                              )}
                            </span>
                          );
                        case "parse":
                          return (
                            <span key={col.id} className="text-slate-400">
                              {d.parseStatus}
                            </span>
                          );
                        case "quality":
                          return (
                            <span key={col.id}>
                              {d.qualityScore != null ? (
                                <Badge
                                  tone={
                                    d.qualityScore >= 80
                                      ? "success"
                                      : d.qualityScore >= 50
                                        ? "warning"
                                        : "error"
                                  }
                                >
                                  {d.qualityScore}
                                </Badge>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </span>
                          );
                        case "cbs": {
                          const rtc = rtcById.get(d.id);
                          return (
                            <span
                              key={col.id}
                              className="min-w-0"
                              title={
                                rtc?.hasCbs
                                  ? rtc.cbsKeys.join(", ")
                                  : "Sem etiqueta CBS — candidato a aviso ao fornecedor"
                              }
                            >
                              {rtc?.hasCbs ? (
                                <Badge tone="success">
                                  CBS
                                  {rtc.somaCbs != null ? ` ${formatCurrency(rtc.somaCbs)}` : ""}
                                </Badge>
                              ) : (
                                <Badge tone="warning">Sem CBS</Badge>
                              )}
                            </span>
                          );
                        }
                        case "ibs": {
                          const rtc = rtcById.get(d.id);
                          return (
                            <span
                              key={col.id}
                              className="min-w-0"
                              title={rtc?.hasIbs ? rtc.ibsKeys.join(", ") : "Sem etiqueta IBS"}
                            >
                              {rtc?.hasIbs ? (
                                <Badge tone="info">
                                  IBS
                                  {rtc.somaIbs != null ? ` ${formatCurrency(rtc.somaIbs)}` : ""}
                                </Badge>
                              ) : (
                                <span className="text-slate-500">Sem IBS</span>
                              )}
                            </span>
                          );
                        }
                        case "actions":
                          return (
                            <span key={col.id}>
                              <Link
                                className="text-sky-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                                href={`/app/batches/${params.id}/documents/${d.id}`}
                              >
                                Detalhes
                              </Link>
                            </span>
                          );
                        default:
                          return null;
                      }
                    })}
                  </div>
                )}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 text-xs text-slate-500">
                <span>
                  {rows.length.toLocaleString("pt-BR")} linha(s) · virtualização ativa
                </span>
                <div className="relative">
                  <Button size="sm" variant="ghost" onClick={() => setActionsOpen((v) => !v)}>
                    <MoreHorizontal className="h-4 w-4" /> Seleção
                  </Button>
                  {actionsOpen && (
                    <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-white/10 bg-slate-950 p-2 shadow-xl">
                      <button
                        type="button"
                        className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5"
                        onClick={() => {
                          setSelectedIds((prev) => selectAllFiltered(prev, filteredIds));
                          setActionsOpen(false);
                        }}
                      >
                        Selecionar todos os filtrados
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5"
                        onClick={() => {
                          setSelectedIds((prev) => deselectFiltered(prev, filteredIds));
                          setActionsOpen(false);
                        }}
                      >
                        Desmarcar filtrados
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5"
                        onClick={() => {
                          setSelectedIds((prev) => invertFilteredSelection(prev, filteredIds));
                          setActionsOpen(false);
                        }}
                      >
                        Inverter filtrados
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5"
                        onClick={() => {
                          const visible = rows.slice(0, 20).map((d) => d.id);
                          setSelectedIds((prev) => selectVisibleOnly(prev, visible));
                          setActionsOpen(false);
                        }}
                      >
                        Selecionar visíveis (amostra)
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-lg px-2 py-2 text-left text-sm text-amber-200 hover:bg-white/5"
                        onClick={() => {
                          setSelectedIds(clearSelection());
                          setActionsOpen(false);
                        }}
                      >
                        Limpar toda a seleção
                      </button>
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 200).map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 accent-sky-400"
                      checked={selectedIds.has(d.id)}
                      onChange={() =>
                        setSelectedIds((prev) => toggleDocumentSelection(prev, d.id))
                      }
                      aria-label={`Selecionar ${d.number || d.fileName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={typeTone(d.documentType)}>{d.documentType}</Badge>
                        <span className="font-medium">{d.number || d.fileName}</span>
                        {rtcById.get(d.id)?.hasCbs ? (
                          <Badge tone="success">CBS</Badge>
                        ) : (
                          <Badge tone="warning">Sem CBS</Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-400">{d.emitterName}</p>
                      <p className="text-right text-sm tabular-nums">
                        {formatCurrency(d.totalValue)}
                      </p>
                      <Link
                        className="text-sm text-sky-300"
                        href={`/app/batches/${params.id}/documents/${d.id}`}
                      >
                        Detalhes
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {rows.length > 200 && (
                <p className="text-center text-xs text-slate-500">
                  Mostrando 200 de {rows.length} no modo compacto — use a tabela no desktop.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-4 left-1/2 z-40 w-[min(960px,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-sky-400/30 bg-slate-950/95 p-3 shadow-2xl backdrop-blur"
          role="region"
          aria-label="Ações da seleção"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-200">
              <strong>{selectedIds.size}</strong> selecionado(s) ·{" "}
              {formatCurrency(selectedResolved?.totalValue || 0)}
              <span className="mt-1 block text-xs text-slate-400">
                XML: {selectedXmlStats.withXml} disponível · {selectedXmlStats.withoutXml}{" "}
                indisponível
                {outsideCount > 0
                  ? ` · ${outsideCount} fora do filtro atual (seleção preservada)`
                  : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4" /> Exportar selecionados
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(clearSelection())}>
                Limpar seleção
              </Button>
            </div>
          </div>
        </div>
      )}

      <DocumentExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        store={store}
        selectedIds={selectedIds}
        filters={filters}
        xmlAvailableCount={selectedXmlStats.withXml}
        xmlMissingCount={selectedXmlStats.withoutXml}
      />
    </div>
  );
}
