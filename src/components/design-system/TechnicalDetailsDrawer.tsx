"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

// Gaveta de detalhes técnicos: esconde linguagem de laboratório da
// interface comum e a expõe apenas sob demanda (prompt §11.5).
export function TechnicalDetailsDrawer({
  title = "Detalhes técnicos",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("rounded-xl border border-white/10 bg-slate-900/40", className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:text-slate-100"
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-400">{children}</div>}
    </div>
  );
}
