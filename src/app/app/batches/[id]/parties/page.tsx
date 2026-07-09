"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { buildParties } from "@/lib/analytics";
import { formatCurrency, formatCnpjCpf, formatDate } from "@/lib/utils";
import { useBatchStore } from "@/lib/store/use-batch-store";

export default function PartiesPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "emitter" | "receiver">("all");
  const [mask, setMask] = useState(true);

  const parties = useMemo(() => (store ? buildParties(store) : []), [store]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return parties.filter((p) => {
      if (role === "emitter" && p.role === "receiver") return false;
      if (role === "receiver" && p.role === "emitter") return false;
      if (!needle) return true;
      return (
        p.doc.toLowerCase().includes(needle) ||
        p.name.toLowerCase().includes(needle) ||
        p.doc.replace(/\D/g, "").includes(needle.replace(/\D/g, ""))
      );
    });
  }, [parties, q, role]);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Inteligência</p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Fornecedores & Clientes
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {rows.length} partes · clique para filtrar documentos
        </p>
      </div>

      <BatchTabs batchId={params.id} />

      <Card>
        <CardHeader>
          <CardTitle>Partes do lote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              className="max-w-sm"
              placeholder="Buscar CNPJ ou razão social…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="all">Todos os papéis</option>
              <option value="emitter">Emitentes / fornecedores</option>
              <option value="receiver">Destinatários / clientes</option>
            </select>
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setMask((v) => !v)}
            >
              {mask ? "Mostrar docs" : "Mascarar"}
            </button>
          </div>

          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-950">
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="py-2">Documento</th>
                  <th className="py-2">Nome</th>
                  <th className="py-2">Papel</th>
                  <th className="py-2">Qtd</th>
                  <th className="py-2 text-right">Valor</th>
                  <th className="py-2">Ticket médio</th>
                  <th className="py-2">Primeira</th>
                  <th className="py-2">Última</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.doc} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-2 font-mono text-xs">
                      <Link
                        className="text-sky-300 hover:underline"
                        href={`/app/batches/${params.id}/documents?${
                          p.role === "receiver" ? "receiver" : "emitter"
                        }=${encodeURIComponent(p.doc)}`}
                      >
                        {formatCnpjCpf(p.doc, mask)}
                      </Link>
                    </td>
                    <td className="py-2 max-w-[220px] truncate">{p.name}</td>
                    <td className="py-2">
                      <Badge
                        tone={
                          p.role === "emitter" ? "nfe" : p.role === "receiver" ? "nfse" : "info"
                        }
                      >
                        {p.role}
                      </Badge>
                    </td>
                    <td className="py-2">{p.count}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(p.total)}</td>
                    <td className="py-2 tabular-nums">{formatCurrency(p.total / Math.max(p.count, 1))}</td>
                    <td className="py-2 text-slate-400">{formatDate(p.firstDate)}</td>
                    <td className="py-2 text-slate-400">{formatDate(p.lastDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
