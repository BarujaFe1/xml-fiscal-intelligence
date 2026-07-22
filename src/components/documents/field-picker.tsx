"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExportFieldDefinition, ExportFieldPreset } from "@/lib/export/fields/types";
import { searchFieldRegistry } from "@/lib/export/fields/registry";
import { buildDefaultPreset } from "@/lib/export/fields/defaults";

type LabelMode = "human" | "technical" | "both";

export function FieldPickerPanel({
  registry,
  preset,
  onChange,
  onSavePreset,
}: {
  registry: ExportFieldDefinition[];
  preset: ExportFieldPreset;
  onChange: (preset: ExportFieldPreset) => void;
  onSavePreset?: (preset: ExportFieldPreset) => void;
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<LabelMode>("both");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const selected = useMemo(() => new Set(preset.columns.map((c) => c.fieldId)), [preset]);
  const filtered = useMemo(() => {
    let list = searchFieldRegistry(registry, query);
    if (groupFilter !== "all") {
      list = list.filter((f) => String(f.scope).includes(groupFilter));
    }
    return list.slice(0, 400);
  }, [registry, query, groupFilter]);

  const groups = useMemo(() => {
    const s = new Set(registry.map((f) => String(f.scope)));
    return ["all", ...[...s].sort()];
  }, [registry]);

  function toggle(fieldId: string) {
    if (selected.has(fieldId)) {
      onChange({
        ...preset,
        columns: preset.columns.filter((c) => c.fieldId !== fieldId),
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    const def = registry.find((f) => f.fieldId === fieldId);
    onChange({
      ...preset,
      columns: [
        ...preset.columns,
        {
          fieldId,
          order: preset.columns.length + 1,
          headerMode: mode === "technical" ? "technical" : "human",
          headerOverride: def?.requestedHeader || def?.humanLabelPtBr,
          aggregation: def?.defaultAggregation,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
  }

  function move(fieldId: string, dir: -1 | 1) {
    const cols = [...preset.columns].sort((a, b) => a.order - b.order);
    const idx = cols.findIndex((c) => c.fieldId === fieldId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= cols.length) return;
    const tmp = cols[idx]!;
    cols[idx] = cols[j]!;
    cols[j] = tmp;
    onChange({
      ...preset,
      columns: cols.map((c, i) => ({ ...c, order: i + 1 })),
      updatedAt: new Date().toISOString(),
    });
  }

  const orderedSelected = [...preset.columns].sort((a, b) => a.order - b.order);

  return (
    <Card className="border-white/10 bg-slate-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Campos da exportação</CardTitle>
        <CardDescription>
          Alternar rótulo humano / path XML. Preset atual: {preset.name} · {preset.columns.length}{" "}
          colunas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["human", "technical", "both"] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "secondary" : "outline"}
              onClick={() => setMode(m)}
            >
              {m === "human" ? "Nome humano" : m === "technical" ? "Campo XML" : "Ambos"}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange(buildDefaultPreset())}
          >
            Restaurar padrão (13)
          </Button>
          {onSavePreset && (
            <Button
              size="sm"
              onClick={() => {
                const name = window.prompt("Nome do preset", preset.name);
                if (!name) return;
                onSavePreset({
                  ...preset,
                  id: `preset_${Date.now().toString(36)}`,
                  name,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }}
            >
              Salvar preset
            </Button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar rótulo, tag ou path…"
            aria-label="Buscar campos"
          />
          <select
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            aria-label="Grupo de campos"
          >
            {groups.map((g) => (
              <option key={g} value={g}>
                {g === "all" ? "Todos os grupos" : g}
              </option>
            ))}
          </select>
        </div>

        {orderedSelected.length > 0 && (
          <div className="rounded-xl border border-white/10 p-2">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Ordem selecionada</p>
            <ul className="space-y-1">
              {orderedSelected.map((c) => {
                const def = registry.find((f) => f.fieldId === c.fieldId);
                return (
                  <li
                    key={c.fieldId}
                    className="flex items-center gap-2 rounded-lg bg-slate-950/50 px-2 py-1 text-sm"
                  >
                    <span className="w-6 text-xs text-slate-500">{c.order}</span>
                    <span className="flex-1">
                      {c.headerOverride || def?.humanLabelPtBr || c.fieldId}
                      {def && (
                        <span className="block text-[11px] text-slate-500">
                          {def.technicalLabel}
                          {def.cardinality === "many" ? " · repetitivo" : ""}
                        </span>
                      )}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => move(c.fieldId, -1)}>
                      ↑
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => move(c.fieldId, 1)}>
                      ↓
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(c.fieldId)}>
                      ×
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10">
          {filtered.map((f) => {
            const checked = selected.has(f.fieldId);
            return (
              <label
                key={f.fieldId}
                className="flex cursor-pointer items-start gap-2 border-b border-white/5 px-3 py-2 text-sm hover:bg-white/5"
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(f.fieldId)} />
                <span className="flex-1">
                  {(mode === "human" || mode === "both") && (
                    <span className="block text-slate-100">
                      {f.requestedHeader || f.humanLabelPtBr}
                    </span>
                  )}
                  {(mode === "technical" || mode === "both") && (
                    <span className="block font-mono text-[11px] text-slate-500">
                      {f.xmlPaths[0] || f.technicalLabel}
                    </span>
                  )}
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {f.scope} · {f.dataType}
                    {f.cardinality === "many" ? " · Repetitivo" : ""}
                    {f.coverageHint?.pct ? ` · cobertura ~${f.coverageHint.pct}%` : ""}
                    {f.translationStatus === "review_needed" ? " · revisar" : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
