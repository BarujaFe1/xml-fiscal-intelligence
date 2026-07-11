"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Label } from "@/components/ui/input";

const STORAGE_KEY = "xfi_fiscal_context_v1";

export type FiscalContext = {
  organization: string;
  company: string;
  establishment: string;
  competence: string; // YYYY-MM
};

const DEFAULT: FiscalContext = {
  organization: "Ambiente local de demonstração",
  company: "",
  establishment: "",
  competence: "",
};

function readStorage(): FiscalContext {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as FiscalContext) };
  } catch {
    return DEFAULT;
  }
}

function writeStorage(ctx: FiscalContext) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
}

/**
 * Global fiscal context: URL query + local preference.
 * Never treats browser-sent workspace IDs as authorization.
 */
export function FiscalContextSelector({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ctx = useMemo((): FiscalContext => {
    const stored = readStorage();
    return {
      organization: searchParams.get("org") || stored.organization || DEFAULT.organization,
      company: searchParams.get("company") || stored.company || "",
      establishment: searchParams.get("est") || stored.establishment || "",
      competence: searchParams.get("comp") || stored.competence || "",
    };
  }, [searchParams]);

  const crumb = useMemo(() => {
    return [
      ctx.organization || "Organização",
      ctx.company || "Empresa",
      ctx.establishment || "Estabelecimento",
      ctx.competence || "Competência",
    ].join(" › ");
  }, [ctx]);

  const apply = useCallback(
    (next: FiscalContext) => {
      writeStorage(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next.organization) params.set("org", next.organization);
      else params.delete("org");
      if (next.company) params.set("company", next.company);
      else params.delete("company");
      if (next.establishment) params.set("est", next.establishment);
      else params.delete("est");
      if (next.competence) params.set("comp", next.competence);
      else params.delete("comp");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (compact) {
    return (
      <div className="hidden xl:block max-w-md truncate text-xs text-slate-400" title={crumb}>
        {crumb}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Contexto fiscal</p>
      <p className="text-xs text-slate-400">{crumb}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="fc-org">Organização</Label>
          <Input
            id="fc-org"
            value={ctx.organization}
            onChange={(e) => apply({ ...ctx, organization: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fc-co">Empresa</Label>
          <Input
            id="fc-co"
            value={ctx.company}
            onChange={(e) => apply({ ...ctx, company: e.target.value })}
            placeholder="Razão / CNPJ"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fc-est">Estabelecimento</Label>
          <Input
            id="fc-est"
            value={ctx.establishment}
            onChange={(e) => apply({ ...ctx, establishment: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fc-comp">Competência (AAAA-MM)</Label>
          <Input
            id="fc-comp"
            value={ctx.competence}
            onChange={(e) => apply({ ...ctx, competence: e.target.value })}
            placeholder="2026-03"
            pattern="\d{4}-\d{2}"
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Preferência local + URL. Não autoriza acesso — validação real exige sessão e RLS.
      </p>
    </div>
  );
}
