import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Cartão de próxima ação (prompt §11.4 / §13).
export function NextActionCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  disabled,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5", className)}>
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-slate-50">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {actionLabel && (
        <button
          type="button"
          disabled={disabled}
          onClick={onAction}
          className="mt-auto w-fit rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
