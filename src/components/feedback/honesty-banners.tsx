"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_MESSAGE =
  "Os dados deste período ficam neste dispositivo até você ativar a sincronização. Limpar os dados do navegador, trocar de dispositivo ou usar outro perfil poderá tornar os lotes indisponíveis.";

export function LocalPersistenceBanner({
  className,
  message = DEFAULT_MESSAGE,
  compact = false,
}: {
  className?: string;
  message?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-100/90",
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
        className,
      )}
    >
      <AlertTriangle className={cn("shrink-0 text-amber-300", compact ? "h-4 w-4 mt-0.5" : "h-5 w-5 mt-0.5")} />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

export function EfdDiagnosticBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90",
        className,
      )}
    >
      Este módulo realiza diagnóstico e pré-validação interna. O arquivo deve ser conferido no PVA
      oficial e revisado por profissional responsável antes de qualquer transmissão.
    </div>
  );
}
