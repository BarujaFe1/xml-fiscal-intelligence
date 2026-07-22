import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// Shell de aplicação reutilizável (prompt §13). Encapsula o layout
// sidebar + topbar + main, garantindo landmark <main> e skip link.
export function AppShell({
  sidebar,
  topbar,
  children,
  className,
}: {
  sidebar?: ReactNode;
  topbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-screen bg-slate-950 text-slate-200", className)}>
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-sky-500 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950"
      >
        Ir para o conteúdo
      </a>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main id="conteudo-principal" className="flex-1 px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
