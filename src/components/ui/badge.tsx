import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "nfe" | "cte" | "nfse" | "unknown" | "success" | "warning" | "error" | "info";
}) {
  const tones: Record<string, string> = {
    default: "bg-white/10 text-slate-200 border-white/10",
    nfe: "bg-sky-500/15 text-sky-300 border-sky-400/20",
    cte: "bg-violet-500/15 text-violet-300 border-violet-400/20",
    nfse: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    unknown: "bg-slate-500/20 text-slate-300 border-slate-400/20",
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    warning: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    error: "bg-rose-500/15 text-rose-300 border-rose-400/20",
    info: "bg-cyan-500/15 text-cyan-300 border-cyan-400/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function typeTone(type?: string) {
  if (type === "NFE" || type === "NFCE") return "nfe" as const;
  if (type === "CTE") return "cte" as const;
  if (type === "NFSE") return "nfse" as const;
  return "unknown" as const;
}
