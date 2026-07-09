"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSearch,
  FolderOpen,
  LayoutDashboard,
  Search,
  Settings,
  Upload,
  FileCode2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/app", label: "Visão geral", icon: LayoutDashboard },
  { href: "/app/upload", label: "Upload", icon: Upload },
  { href: "/app/batches", label: "Lotes", icon: FolderOpen },
  { href: "/app/search", label: "Busca", icon: Search },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950">
      <div className="p-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.15)]">
            <FileCode2 className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-50">XML Fiscal</div>
            <div className="text-[11px] text-slate-400 tracking-wide">INTELLIGENCE</div>
          </div>
        </Link>
      </div>
      <nav className="p-3 space-y-1 flex-1">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== "/app" && pathname.startsWith(link.href));
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sky-500/15 text-sky-200 border border-sky-400/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/5",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <FileSearch className="h-3.5 w-3.5" />
          Dados no IndexedDB · mascarados
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-slate-400">
          Atalho <kbd className="text-slate-200">Ctrl</kbd>+<kbd className="text-slate-200">K</kbd>
        </div>
      </div>
    </aside>
  );
}
