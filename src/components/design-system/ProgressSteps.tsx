import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// Indicador de etapas (prompt §11.4 / §13): Importar → Conferir → Resolver → Fechar.
export function ProgressSteps({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number; // índice da etapa atual (0-based)
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-2", className)} aria-label="Etapas do processo">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-emerald-400/40 bg-emerald-400/15 text-emerald-300",
                active && "border-sky-400/50 bg-sky-500/20 text-sky-200",
                !done && !active && "border-white/10 bg-white/5 text-slate-500",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("text-sm", active ? "font-medium text-slate-100" : "text-slate-400")}>
              {step}
            </span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-white/10" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
