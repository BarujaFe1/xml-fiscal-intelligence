"use client";

import { cn } from "@/lib/utils";

// Diálogo de confirmação acessível (prompt §13).
export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5">
        <h2 className="text-base font-semibold text-slate-50">{title}</h2>
        {message && <p className="mt-2 text-sm text-slate-400">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold",
              destructive ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-sky-500 text-slate-950 hover:bg-sky-400",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
