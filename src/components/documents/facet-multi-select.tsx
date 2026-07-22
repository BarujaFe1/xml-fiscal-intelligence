"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FacetOption, PartyFacetOption } from "@/lib/documents/facets";
import { filterPartyOptions } from "@/lib/documents/facets";

type Option = FacetOption | PartyFacetOption;

/**
 * Faceted multi-select: local search does NOT apply to the main dataset.
 * Changes commit only via checkbox toggle or "Aplicar".
 */
export function FacetMultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  partyMode = false,
  placeholder = "Buscar…",
}: {
  label: string;
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  partyMode?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [draftSelected, setDraftSelected] = useState<string[]>(selectedIds);

  useEffect(() => {
    setDraftSelected(selectedIds);
  }, [selectedIds, open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(draftQuery), 300);
    return () => clearTimeout(t);
  }, [draftQuery]);

  const filtered = useMemo(() => {
    if (partyMode) return filterPartyOptions(options as PartyFacetOption[], debounced);
    const q = debounced.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  }, [options, debounced, partyMode]);

  const visible = filtered.slice(0, 200);

  function toggle(id: string) {
    setDraftSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function apply() {
    onChange(draftSelected);
    setOpen(false);
  }

  const chips = selectedIds
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean) as Option[];

  return (
    <div className="relative">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-left text-sm text-slate-200"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <span>
          {label}
          {selectedIds.length ? ` (${selectedIds.length})` : ""}
        </span>
        <span className="text-xs text-slate-500">lista</span>
      </button>

      {chips.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {chips.slice(0, 8).map((c) => (
            <button
              key={c.id}
              type="button"
              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-100"
              onClick={() => onChange(selectedIds.filter((id) => id !== c.id))}
            >
              {c.label.length > 40 ? `${c.label.slice(0, 40)}…` : c.label} ×
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          className="absolute z-40 mt-1 w-full min-w-[280px] rounded-xl border border-white/10 bg-slate-950 p-2 shadow-2xl"
          role="listbox"
          aria-label={label}
        >
          <Input
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={`Buscar em ${label}`}
            className="mb-2"
          />
          <div className="max-h-56 overflow-y-auto">
            {visible.map((o) => {
              const checked = draftSelected.includes(o.id);
              return (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(o.id)} />
                  <span className="flex-1 text-slate-200">
                    {o.label}
                    <span className="ml-1 text-xs text-slate-500">
                      · {o.count}
                      {o.totalValue ? ` · R$ ${o.totalValue}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
            {!visible.length && (
              <p className="px-2 py-3 text-xs text-slate-500">Nenhuma opção</p>
            )}
            {filtered.length > visible.length && (
              <p className="px-2 py-1 text-[11px] text-slate-500">
                Exibindo {visible.length} de {filtered.length} — refine a busca
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 border-t border-white/10 pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDraftSelected(filtered.map((o) => o.id))}
            >
              Selecionar resultados da busca
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraftSelected([])}>
              Limpar
            </Button>
            <Button size="sm" className="ml-auto" onClick={apply}>
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
