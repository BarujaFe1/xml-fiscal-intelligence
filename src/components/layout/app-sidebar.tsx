"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  FileCode2,
  FolderOpen,
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Upload,
  Landmark,
  GitBranch,
  Scale,
  CloudUpload,
  HardDrive,
  Globe,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    title: "Operação",
    links: [
      { href: "/app", label: "Início", icon: LayoutDashboard },
      { href: "/app/upload", label: "Importar", icon: Upload },
      { href: "/app/batches", label: "Lotes", icon: FolderOpen },
      { href: "/app/companies", label: "Empresas", icon: Building2 },
      { href: "/app/reconciliation", label: "Conferir", icon: ArrowLeftRight },
      { href: "/app/closing", label: "Fechamentos", icon: CalendarDays },
    ],
  },
  {
    title: "Análise",
    links: [
      { href: "/app/search", label: "Busca", icon: Search },
      { href: "/app/audit", label: "Auditoria", icon: ShieldAlert },
      { href: "/app/relationships", label: "Relacionamentos", icon: GitBranch },
      { href: "/app/obligations", label: "Obrigações", icon: Landmark },
      { href: "/app/masters", label: "Dados mestres", icon: Building2 },
      { href: "/app/sped", label: "Diagnóstico EFD", icon: Scale },
    ],
  },
  {
    title: "Plataforma",
    links: [
      { href: "/app/migrate", label: "Migrar lotes", icon: CloudUpload },
      { href: "/app/validators-lab", label: "Validação oficial", icon: FlaskConical },
      { href: "/app/rtc", label: "Simulação tributária", icon: FlaskConical },
      { href: "/app/homologation", label: "Homologação", icon: Shield },
      { href: "/app/continuous-ops", label: "Operações contínuas", icon: CloudUpload },
      { href: "/app/governance", label: "Governança", icon: ShieldAlert },
      { href: "/app/billing", label: "Planos", icon: CreditCard },
      { href: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
] as const;

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
      <nav className="p-3 space-y-4 flex-1 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.links.map((link) => {
                const active =
                  pathname === link.href || (link.href !== "/app" && pathname.startsWith(link.href));
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
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
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2 text-xs text-slate-500">
        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
          Atalho <kbd className="text-slate-200">Ctrl</kbd>+<kbd className="text-slate-200">K</kbd>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-600">
          Auxílio de diagnóstico fiscal — não substitui PVA/SPED nem consultoria.
        </p>
      </div>
    </aside>
  );
}
