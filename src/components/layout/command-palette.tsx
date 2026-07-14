"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  FileSearch,
  FolderOpen,
  GitCompare,
  LayoutDashboard,
  Search,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { idbListBatches } from "@/lib/store/idb-store";
import type { Batch } from "@/types";

const NAV = [
  { href: "/app", label: "Visão geral", icon: LayoutDashboard },
  { href: "/app/upload", label: "Importações", icon: Upload },
  { href: "/app/batches", label: "Histórico de lotes", icon: FolderOpen },
  { href: "/app/search", label: "Busca global", icon: Search },
  { href: "/app/audit", label: "Auditoria fiscal", icon: FileSearch },
  { href: "/app/relationships", label: "Relacionamentos", icon: GitCompare },
  { href: "/app/obligations", label: "Obrigações / EFD", icon: FileSearch },
  { href: "/app/closing", label: "Cockpit de fechamento", icon: FileSearch },
  { href: "/app/masters", label: "Dados mestres", icon: Users },
  { href: "/app/validators-lab", label: "Lab. validadores", icon: FileSearch },
  { href: "/app/homologation", label: "Homologação", icon: FileSearch },
  { href: "/app/continuous-ops", label: "Ops contínua", icon: Upload },
  { href: "/app/governance", label: "Governança", icon: Settings },
  { href: "/app/enterprise", label: "Enterprise", icon: FolderOpen },
  { href: "/app/scale", label: "Scale / DR", icon: Upload },
  { href: "/app/ecosystem", label: "Ecosystem", icon: GitCompare },
  { href: "/app/compliance", label: "Compliance", icon: FileSearch },
  { href: "/app/growth", label: "Growth", icon: FileSearch },
  { href: "/app/assurance", label: "Assurance", icon: FileSearch },
  { href: "/app/m", label: "Mobile RO", icon: Users },
  { href: "/app/ops", label: "Plataforma ops", icon: Settings },
  { href: "/app/rtc", label: "RTC CBS/IBS", icon: FileSearch },
  { href: "/app/sped", label: "Diagnóstico EFD", icon: FileSearch },
  { href: "/app/billing", label: "Planos", icon: Settings },
  { href: "/app/settings", label: "Configurações", icon: Settings },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          const next = !v;
          if (next) setQ("");
          return next;
        });
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    idbListBatches().then((list) => {
      if (!cancelled) setBatches(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredBatches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return batches.slice(0, 8);
    return batches
      .filter((b) => b.name.toLowerCase().includes(needle) || b.uploadedFileName.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [batches, q]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative mx-auto mt-[12vh] w-full max-w-xl px-4">
        <Command
          className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-sky-500/10"
          shouldFilter={false}
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4">
            <Search className="h-4 w-4 text-slate-500" />
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Buscar páginas, lotes, ações… (Ctrl+K)"
              className="h-12 w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <kbd className="hidden sm:inline rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-slate-500">
              Nada encontrado.
            </Command.Empty>

            <Command.Group heading="Navegação" className="px-2 py-1 text-[11px] uppercase tracking-wide text-slate-500">
              {NAV.filter((n) => !q || n.label.toLowerCase().includes(q.toLowerCase())).map((n) => (
                <Command.Item
                  key={n.href}
                  value={n.label}
                  onSelect={() => go(n.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 aria-selected:bg-sky-500/15"
                >
                  <n.icon className="h-4 w-4 text-sky-300" />
                  {n.label}
                </Command.Item>
              ))}
            </Command.Group>

            {filteredBatches.length > 0 && (
              <Command.Group
                heading="Lotes"
                className="mt-2 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-500"
              >
                {filteredBatches.map((b) => (
                  <Command.Item
                    key={b.id}
                    value={`lote ${b.name}`}
                    onSelect={() => go(`/app/batches/${b.id}`)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 aria-selected:bg-sky-500/15"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <FileSearch className="h-4 w-4 shrink-0 text-emerald-300" />
                      <span className="truncate">{b.name}</span>
                    </span>
                    <span className="text-xs text-slate-500">{b.validXml} XMLs</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {filteredBatches[0] && (
              <Command.Group
                heading="Ações rápidas"
                className="mt-2 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-500"
              >
                <Command.Item
                  value="partes fornecedores"
                  onSelect={() => go(`/app/batches/${filteredBatches[0].id}/parties`)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 aria-selected:bg-sky-500/15"
                >
                  <Users className="h-4 w-4 text-violet-300" />
                  Abrir partes do lote recente
                </Command.Item>
                <Command.Item
                  value="comparar lotes"
                  onSelect={() => go(`/app/batches/${filteredBatches[0].id}/compare`)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 aria-selected:bg-sky-500/15"
                >
                  <GitCompare className="h-4 w-4 text-amber-300" />
                  Comparar mês a mês
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
