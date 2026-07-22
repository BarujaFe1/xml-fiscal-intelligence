"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FacetMultiSelect } from "@/components/documents/facet-multi-select";
import { FieldPickerPanel } from "@/components/documents/field-picker";
import { DocumentExportModal } from "@/components/documents/document-export-modal";
import type { BatchStore } from "@/types";
import { buildFacetIndex } from "@/lib/documents/facets";
import {
  emptyAppliedFacets,
  emptyFilterDraft,
  type AppliedFacetFilters,
  type DocumentWorkspaceScope,
  type FilterDraft,
  selectionId,
} from "@/lib/documents/workspace-types";
import { filterWorkspaceDocuments, sumWorkspaceValues } from "@/lib/documents/workspace-filter";
import {
  clearSelection,
  invertFilteredSelection,
  selectAllFiltered,
  selectionHeaderState,
} from "@/lib/documents/selection";
import { buildFieldRegistry } from "@/lib/export/fields/registry";
import { buildDefaultPreset } from "@/lib/export/fields/defaults";
import type { ExportFieldPreset } from "@/lib/export/fields/types";
import { loadFieldPresets, upsertPreset } from "@/lib/export/fields/presets";
import { buildFieldSelectionWorkbook } from "@/lib/export/fields/workbook";
import { createGenerationId } from "@/lib/export/manifest";
import { emptyDocFilters } from "@/lib/analytics";
import { idbListRawXmlMetaForBatch } from "@/lib/store/raw-xml-store";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export function DocumentExportWorkspace({
  scope,
  stores,
  title = "Documentos",
  onBatchIdsChange,
}: {
  scope: DocumentWorkspaceScope;
  stores: BatchStore[];
  title?: string;
  onBatchIdsChange?: (ids: string[]) => void;
}) {
  const [facets, setFacets] = useState<AppliedFacetFilters>(() => {
    const base = emptyAppliedFacets();
    if (scope.mode === "single_batch") base.batchIds = [...scope.batchIds];
    else if (scope.batchIds.length) base.batchIds = [...scope.batchIds];
    return base;
  });
  const [draft, setDraft] = useState<FilterDraft>(emptyFilterDraft());
  const [committed, setCommitted] = useState<Partial<FilterDraft>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [preset, setPreset] = useState<ExportFieldPreset>(() => buildDefaultPreset());
  const [presets, setPresets] = useState<ExportFieldPreset[]>([]);
  const [busyXlsx, setBusyXlsx] = useState(false);
  const [xmlMeta, setXmlMeta] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    setPresets(loadFieldPresets());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = new Map<string, number>();
      for (const s of stores) {
        try {
          const metas = await idbListRawXmlMetaForBatch(s.batch.id);
          map.set(s.batch.id, metas.length);
        } catch {
          map.set(s.batch.id, 0);
        }
      }
      if (!cancelled) setXmlMeta(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [stores]);

  const facetIndex = useMemo(() => buildFacetIndex(stores), [stores]);
  const registry = useMemo(() => buildFieldRegistry(stores), [stores]);

  const rows = useMemo(
    () => filterWorkspaceDocuments(stores, facets, committed),
    [stores, facets, committed],
  );
  const filteredIds = useMemo(() => rows.map((r) => r.selectionId), [rows]);
  const headerState = selectionHeaderState(selectedIds, new Set(filteredIds));
  const filteredTotal = useMemo(() => sumWorkspaceValues(rows), [rows]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.selectionId)),
    [rows, selectedIds],
  );
  // Also keep selection outside current filter
  const selectedOutside = useMemo(() => {
    let n = 0;
    const filteredSet = new Set(filteredIds);
    for (const id of selectedIds) if (!filteredSet.has(id)) n += 1;
    return n;
  }, [selectedIds, filteredIds]);

  const selectedBatchCount = useMemo(() => {
    const s = new Set<string>();
    for (const id of selectedIds) s.add(id.split(":")[0] || "");
    return s.size;
  }, [selectedIds]);

  const selectedXmlStats = useMemo(() => {
    let withXml = 0;
    let withoutXml = 0;
    for (const id of selectedIds) {
      const batchId = id.split(":")[0] || "";
      const available = xmlMeta.get(batchId) || 0;
      // Approximate: if batch has any raw xml, count optimistic; exact check at export
      if (available > 0) withXml += 1;
      else withoutXml += 1;
    }
    return { withXml, withoutXml };
  }, [selectedIds, xmlMeta]);

  const applyFreeFilters = useCallback(() => {
    setCommitted({
      freeText: draft.freeText,
      number: draft.number,
      series: draft.series,
      accessKey: draft.accessKey,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
      minValue: draft.minValue,
      maxValue: draft.maxValue,
    });
  }, [draft]);

  // Single store view for legacy export modal (first selected batch or scope)
  const primaryStore = stores[0] || null;
  const legacySelectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const id of selectedIds) {
      const parts = id.split(":");
      const batchId = parts[0];
      const docId = parts.slice(1).join(":");
      if (primaryStore && batchId === primaryStore.batch.id) set.add(docId);
    }
    return set;
  }, [selectedIds, primaryStore]);

  async function exportFieldWorkbook() {
    if (!selectedIds.size) return;
    setBusyXlsx(true);
    try {
      // Resolve selected docs across stores (snapshot)
      const snapshotIds = [...selectedIds];
      const selectedDocs = [];
      for (const store of stores) {
        for (const d of store.documents) {
          const sid = selectionId(store.batch.id, d.id);
          if (!snapshotIds.includes(sid)) continue;
          selectedDocs.push({
            selectionId: sid,
            batchId: store.batch.id,
            batchName: store.batch.name,
            competence:
              store.batch.month && store.batch.year
                ? `${String(store.batch.month).padStart(2, "0")}/${store.batch.year}`
                : undefined,
            origin: (store.batch.syncStatus === "synced" ? "cloud" : "local") as "local" | "cloud",
            importedAt: store.batch.createdAt,
            document: d,
          });
        }
      }
      const defs = preset.columns
        .map((c) => registry.find((f) => f.fieldId === c.fieldId))
        .filter(Boolean) as NonNullable<ReturnType<typeof registry.find>>[];
      const gid = createGenerationId();
      const buf = await buildFieldSelectionWorkbook({
        rows: selectedDocs,
        fieldDefs: defs,
        preset,
        registry,
        generationId: gid,
        privacyNote: "operational_full",
      });
      downloadBlob(
        new Blob([new Uint8Array(buf)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `campos-selecionados-${gid.slice(0, 8)}.xlsx`,
      );
      toast.success("Excel gerado (Campos Selecionados + Todos os Campos)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar Excel");
    } finally {
      setBusyXlsx(false);
    }
  }

  if (!stores.length) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 text-sm text-amber-100">
        Nenhum lote carregado neste navegador.
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {scope.mode === "multi_batch" ? "Multilote" : "Lote"}
          </p>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {rows.length.toLocaleString("pt-BR")} documentos · {stores.length} lote(s) · total filtrado
            R$ {filteredTotal}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={applyFreeFilters}>
            Aplicar filtros de texto
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!selectedIds.size || busyXlsx}
            onClick={() => void exportFieldWorkbook()}
          >
            {busyXlsx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{" "}
            Excel campos
          </Button>
          <Button
            size="sm"
            disabled={!selectedIds.size}
            onClick={() => setExportOpen(true)}
          >
            Exportar…
          </Button>
        </div>
      </div>

      {scope.mode === "multi_batch" && (
        <Card className="border-white/10 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lotes</CardTitle>
            <CardDescription>
              Somente lotes deste workspace/navegador. Origem local ≠ outros dispositivos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FacetMultiSelect
              label="Lotes"
              options={facetIndex.batches}
              selectedIds={facets.batchIds}
              onChange={(ids) => {
                setFacets((f) => ({ ...f, batchIds: ids }));
                onBatchIdsChange?.(ids);
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-slate-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtros facetados</CardTitle>
          <CardDescription>
            Digitar na busca da lista não altera o dataset. Use Aplicar / checkbox para confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <FacetMultiSelect
            label="Destinatários"
            options={facetIndex.receivers}
            selectedIds={facets.receiverIds}
            onChange={(ids) => setFacets((f) => ({ ...f, receiverIds: ids }))}
            partyMode
            placeholder="Nome, CPF ou CNPJ…"
          />
          <FacetMultiSelect
            label="Emitentes"
            options={facetIndex.emitters}
            selectedIds={facets.emitterIds}
            onChange={(ids) => setFacets((f) => ({ ...f, emitterIds: ids }))}
            partyMode
          />
          <FacetMultiSelect
            label="Tipo documental"
            options={facetIndex.documentTypes}
            selectedIds={facets.documentTypes}
            onChange={(ids) => setFacets((f) => ({ ...f, documentTypes: ids }))}
          />
          <FacetMultiSelect
            label="Modelo"
            options={facetIndex.models}
            selectedIds={facets.models}
            onChange={(ids) => setFacets((f) => ({ ...f, models: ids }))}
          />
          <FacetMultiSelect
            label="UF origem"
            options={facetIndex.ufOrigin}
            selectedIds={facets.ufOrigin}
            onChange={(ids) => setFacets((f) => ({ ...f, ufOrigin: ids }))}
          />
          <FacetMultiSelect
            label="UF destino"
            options={facetIndex.ufDest}
            selectedIds={facets.ufDest}
            onChange={(ids) => setFacets((f) => ({ ...f, ufDest: ids }))}
          />
          <FacetMultiSelect
            label="CFOP"
            options={facetIndex.cfops}
            selectedIds={facets.cfops}
            onChange={(ids) => setFacets((f) => ({ ...f, cfops: ids }))}
          />
          <FacetMultiSelect
            label="cClassTrib"
            options={facetIndex.cClassTribs}
            selectedIds={facets.cClassTribs}
            onChange={(ids) => setFacets((f) => ({ ...f, cClassTribs: ids }))}
          />
          <FacetMultiSelect
            label="Parse"
            options={facetIndex.parseStatuses}
            selectedIds={facets.parseStatuses}
            onChange={(ids) => setFacets((f) => ({ ...f, parseStatuses: ids }))}
          />
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtros livres</CardTitle>
          <CardDescription>Aplicados só ao pausar e clicar em Aplicar (não a cada tecla).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Busca livre"
            value={draft.freeText}
            onChange={(e) => setDraft((d) => ({ ...d, freeText: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && applyFreeFilters()}
          />
          <Input
            placeholder="Número"
            value={draft.number}
            onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
          />
          <Input
            type="date"
            value={draft.dateFrom}
            onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
          />
          <Input
            type="date"
            value={draft.dateTo}
            onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
          />
        </CardContent>
      </Card>

      <FieldPickerPanel
        registry={registry}
        preset={preset}
        onChange={setPreset}
        onSavePreset={(p) => {
          setPresets(upsertPreset(p, presets));
          setPreset(p);
          toast.success(`Preset salvo: ${p.name}`);
        }}
      />

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="flex items-center gap-3 border-b border-white/10 bg-slate-950/80 px-3 py-2 text-sm">
          <input
            type="checkbox"
            aria-label="Selecionar todos os resultados filtrados"
            checked={headerState === "all"}
            ref={(el) => {
              if (el) el.indeterminate = headerState === "some";
            }}
            onChange={() => {
              if (headerState === "all") {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  for (const id of filteredIds) next.delete(id);
                  return next;
                });
              } else {
                setSelectedIds((prev) => selectAllFiltered(prev, filteredIds));
              }
            }}
          />
          <span className="text-slate-400">
            {rows.length} linhas · {selectedIds.size} selecionado(s)
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds((prev) => invertFilteredSelection(prev, filteredIds))}
          >
            Inverter filtrados
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(clearSelection())}>
            Limpar
          </Button>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs text-slate-400">
              <tr>
                <th className="p-2" />
                {scope.mode === "multi_batch" && <th className="p-2">Lote</th>}
                <th className="p-2">Tipo</th>
                <th className="p-2">Número</th>
                <th className="p-2">Emissão</th>
                <th className="p-2">Emitente</th>
                <th className="p-2">Destinatário</th>
                <th className="p-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r) => (
                <tr key={r.selectionId} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar documento ${r.document.number || r.document.id}`}
                      checked={selectedIds.has(r.selectionId)}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(r.selectionId)) next.delete(r.selectionId);
                          else next.add(r.selectionId);
                          return next;
                        });
                      }}
                    />
                  </td>
                  {scope.mode === "multi_batch" && (
                    <td className="p-2 text-xs text-slate-400">
                      {r.batchName}
                      <span className="block text-[10px]">
                        {r.competence || "—"} · {r.origin}
                      </span>
                    </td>
                  )}
                  <td className="p-2">{r.document.documentType}</td>
                  <td className="p-2">{r.document.number}</td>
                  <td className="p-2 whitespace-nowrap">
                    {r.document.issueDate?.slice(0, 10) || "—"}
                  </td>
                  <td className="p-2">{r.document.emitterName || r.document.emitterDoc}</td>
                  <td className="p-2">{r.document.receiverName || r.document.receiverDoc}</td>
                  <td className="p-2 text-right">
                    {(r.document.totalValue || 0).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 500 && (
            <p className="p-3 text-xs text-slate-500">
              Exibindo 500 de {rows.length}. A seleção/exportação usa todos os filtrados.
            </p>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-4 left-1/2 z-40 flex w-[min(920px,94vw)] -translate-x-1/2 flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-400/30 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur"
          aria-label="Ações da seleção"
        >
          <div className="text-sm text-slate-200">
            <strong>{selectedIds.size}</strong> selecionado(s) · {selectedBatchCount} lote(s)
            {selectedOutside > 0 ? ` · ${selectedOutside} fora do filtro` : ""}
            {" · "}
            XML ~{selectedXmlStats.withXml}/{selectedIds.size}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(clearSelection())}>
              Limpar
            </Button>
            <Button size="sm" disabled={busyXlsx} onClick={() => void exportFieldWorkbook()}>
              Excel campos
            </Button>
            <Button size="sm" onClick={() => setExportOpen(true)}>
              Exportar selecionados
            </Button>
          </div>
        </div>
      )}

      {primaryStore && (
        <DocumentExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          store={primaryStore}
          selectedIds={legacySelectedIds}
          filters={emptyDocFilters()}
          xmlAvailableCount={selectedXmlStats.withXml}
          xmlMissingCount={selectedXmlStats.withoutXml}
        />
      )}
    </div>
  );
}
