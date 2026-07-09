"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Dashboard" },
  { href: "/documents", label: "Documentos" },
  { href: "/items", label: "Itens" },
  { href: "/parties", label: "Partes" },
  { href: "/fields", label: "Campos" },
  { href: "/quality", label: "Quality" },
  { href: "/audit", label: "Auditoria" },
  { href: "/relationships", label: "Relações" },
  { href: "/sped", label: "SPED" },
  { href: "/exports", label: "Exportações" },
  { href: "/compare", label: "Comparar" },
] as const;

export function BatchTabs({ batchId }: { batchId: string }) {
  const pathname = usePathname();
  const base = `/app/batches/${batchId}`;

  return (
    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-slate-950/40 p-1.5">
      {TABS.map((t) => {
        const href = `${base}${t.href}`;
        const active =
          t.href === ""
            ? pathname === base
            : pathname.startsWith(`${base}${t.href}`);
        return (
          <Link
            key={t.href}
            href={href}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-sky-500/15 text-sky-100 border border-sky-400/30 shadow-[0_0_20px_rgba(56,189,248,0.08)]"
                : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
