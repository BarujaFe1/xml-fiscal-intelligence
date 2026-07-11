"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import { FiscalContextSelector } from "@/components/layout/fiscal-context-selector";

const links = [
  { href: "/app", label: "Visão geral" },
  { href: "/app/upload", label: "Importações" },
  { href: "/app/batches", label: "Lotes" },
  { href: "/app/search", label: "Busca" },
  { href: "/app/migrate", label: "Migrar" },
  { href: "/app/obligations", label: "Obrigações" },
  { href: "/app/billing", label: "Planos" },
  { href: "/app/settings", label: "Configurações" },
];

export function AppTopbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className="lg:hidden text-slate-300"
            aria-label="Abrir menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm text-slate-400 shrink-0">
            Ambiente <span className="text-slate-200">local de demonstração</span>
            <span className="hidden sm:inline text-slate-600"> · IndexedDB</span>
          </div>
          <Suspense fallback={null}>
            <FiscalContextSelector compact />
          </Suspense>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))
            }
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Busca rápida
            <kbd className="rounded border border-white/10 px-1">Ctrl K</kbd>
          </button>
          <Link
            href="/app/upload"
            className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"
          >
            Importar lote
          </Link>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-white/10 p-3 space-y-1 bg-slate-950">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm",
                pathname.startsWith(l.href) ? "bg-white/10 text-white" : "text-slate-400",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
