import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type AlertTone = "info" | "success" | "warning" | "error";

const tones: Record<AlertTone, { wrap: string; icon: typeof Info }> = {
  info: { wrap: "border-sky-400/30 bg-sky-400/10 text-sky-100", icon: Info },
  success: { wrap: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100", icon: CheckCircle2 },
  warning: { wrap: "border-amber-400/30 bg-amber-400/10 text-amber-100", icon: AlertTriangle },
  error: { wrap: "border-rose-400/30 bg-rose-400/10 text-rose-100", icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role = "status",
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  role?: "status" | "alert" | "note";
}) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div
      role={role}
      className={cn("flex gap-3 rounded-xl border p-3 text-sm", t.wrap, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm/relaxed opacity-90">{children}</div>}
      </div>
    </div>
  );
}
