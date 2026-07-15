import { cn } from "@/lib/utils";

export interface ContextItem {
  key: string;
  label: string; // ex.: "Organização", "Empresa"
  value: string; // valor atual
  options?: { value: string; label: string }[];
  onChange?: (value: string) => void;
}

// Barra de contexto fiscal (prompt §11.3): Organização / Empresa /
// Estabelecimento / Competência. Seletores acessíveis com <label>.
export function ContextBar({ items, className }: { items: ContextItem[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2",
        className,
      )}
      aria-label="Contexto fiscal"
    >
      {items.map((item) => (
        <div key={item.key} className="flex min-w-[140px] flex-col gap-1">
          <label htmlFor={`ctx-${item.key}`} className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {item.label}
          </label>
          {item.options ? (
            <select
              id={`ctx-${item.key}`}
              value={item.value}
              onChange={(e) => item.onChange?.(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              {item.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-sm font-medium text-slate-100" title={item.value}>
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
