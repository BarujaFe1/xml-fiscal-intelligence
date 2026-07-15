import { cn } from "@/lib/utils";

// Indicador discreto de onde os dados vivem (prompt §11.1).
// Substitui os avisos repetidos "Ambiente local de demonstração · IndexedDB".
export type StorageMode = "local" | "syncing" | "cloud" | "unavailable";

export function EnvironmentIndicator({
  mode = "local",
  className,
  onExplain,
}: {
  mode?: StorageMode;
  className?: string;
  onExplain?: () => void;
}) {
  const config: Record<StorageMode, { label: string; dot: string; tone: string }> = {
    local: { label: "Dados neste dispositivo", dot: "bg-amber-400", tone: "text-amber-300 border-amber-400/30 bg-amber-400/10" },
    syncing: { label: "Sincronizando", dot: "bg-sky-400 animate-pulse", tone: "text-sky-300 border-sky-400/30 bg-sky-400/10" },
    cloud: { label: "Sincronizado", dot: "bg-emerald-400", tone: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" },
    unavailable: { label: "Sincronização não configurada", dot: "bg-slate-400", tone: "text-slate-300 border-white/10 bg-white/5" },
  };
  const c = config[mode];
  return (
    <button
      type="button"
      onClick={onExplain}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80",
        c.tone,
        className,
      )}
      aria-label={c.label}
      title={c.label}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} aria-hidden="true" />
      {c.label}
    </button>
  );
}
