import { cn } from "@/lib/utils";
import type { EfdVerificationStatus } from "@/modules/obligations/efd-icms-ipi/verification-types";
import { EFD_VERIFICATION_LABELS } from "@/modules/obligations/efd-icms-ipi/verification-types";

const toneByStatus: Record<EfdVerificationStatus, string> = {
  draft: "border-white/15 bg-white/5 text-slate-300",
  internally_invalid: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  internally_valid: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  txt_generated: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  pva_pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  pva_rejected: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  pva_accepted_with_warnings: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  pva_accepted: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  business_approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  transmitted_externally: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  receipt_registered: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
};

export function StatusBadge({
  status,
  className,
}: {
  status: EfdVerificationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneByStatus[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {EFD_VERIFICATION_LABELS[status]}
    </span>
  );
}
