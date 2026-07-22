import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Estado vazio orientado a ação (prompt §11.4).
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/40 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
