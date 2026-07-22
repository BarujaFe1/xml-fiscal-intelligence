import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// Assistente multi-etapa (prompt §13). Uma única ação primária por etapa.
export function Wizard({
  steps,
  current,
  children,
  onNext,
  onBack,
  nextLabel = "Continuar",
  backLabel = "Voltar",
  className,
}: {
  steps: string[];
  current: number;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Etapas">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className={cn(i === current ? "font-semibold text-sky-200" : i < current ? "text-emerald-300" : "text-slate-500")}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <div>{children}</div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={current === 0}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
        >
          {backLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
