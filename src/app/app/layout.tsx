import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-sky-500 focus:px-3 focus:py-2 focus:text-slate-950"
      >
        Ir para o conteúdo
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <div className="px-4 pt-3 md:px-6 lg:px-8">
          <LocalPersistenceBanner compact />
        </div>
        <main id="conteudo-principal" className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
