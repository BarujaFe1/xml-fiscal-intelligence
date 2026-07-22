import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// Tabela de análise (prompt §13): usada para dados, não para configuração.
export function DataTable({
  columns,
  rows,
  className,
  emptyMessage = "Nenhum registro.",
}: {
  columns: { key: string; header: string; render?: (row: Record<string, unknown>) => ReactNode }[];
  rows: Record<string, unknown>[];
  className?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">{emptyMessage}</p>;
  }
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-white/10", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
            {columns.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/5 hover:bg-white/5">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-slate-200">
                  {c.render ? c.render(row) : String(row[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
