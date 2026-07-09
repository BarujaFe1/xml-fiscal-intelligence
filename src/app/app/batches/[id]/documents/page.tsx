"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, typeTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BatchStore } from "@/types";

function BatchTabs({ id, active }: { id: string; active: string }) {
  const tabs = [
    { href: "", label: "Dashboard" },
    { href: "/documents", label: "Documentos" },
    { href: "/items", label: "Itens" },
    { href: "/fields", label: "Campos" },
    { href: "/quality", label: "Quality" },
    { href: "/exports", label: "Exportações" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={`/app/batches/${id}${t.href}`}
          className={`rounded-xl px-3 py-1.5 text-sm border ${
            t.href === active
              ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
              : "border-white/10 text-slate-400 hover:bg-white/5"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const params = useParams<{ id: string }>();
  const [store, setStore] = useState<BatchStore | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");

  useEffect(() => {
    fetch(`/api/batches/${params.id}`)
      .then((r) => r.json())
      .then((d) => setStore(d.error ? null : d));
  }, [params.id]);

  const rows = useMemo(() => {
    if (!store) return [];
    return store.documents.filter((d) => {
      if (type !== "ALL" && d.documentType !== type) return false;
      if (!q) return true;
      const blob = [d.accessKey, d.number, d.emitterName, d.receiverName, d.fileName]
        .join(" ")
        .toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [store, q, type]);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{store.batch.name} · Documentos</h1>
      </div>
      <BatchTabs id={params.id} active="/documents" />
      <Card>
        <CardHeader>
          <CardTitle>Tabela de documentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Filtrar por chave, número, nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="NFE">NF-e</option>
              <option value="CTE">CT-e</option>
              <option value="NFSE">NFS-e</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Número</th>
                  <th className="py-2">Emissão</th>
                  <th className="py-2">Emitente</th>
                  <th className="py-2">Destinatário</th>
                  <th className="py-2">Valor</th>
                  <th className="py-2">Parse</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-white/5">
                    <td className="py-2">
                      <Badge tone={typeTone(d.documentType)}>{d.documentType}</Badge>
                    </td>
                    <td className="py-2">
                      <Link
                        className="text-sky-300 hover:underline"
                        href={`/app/batches/${params.id}/documents/${d.id}`}
                      >
                        {d.number || d.fileName}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-400">{formatDate(d.issueDate)}</td>
                    <td className="py-2">{d.emitterName || "—"}</td>
                    <td className="py-2">{d.receiverName || "—"}</td>
                    <td className="py-2">{formatCurrency(d.totalValue)}</td>
                    <td className="py-2 text-slate-400">{d.parseStatus}</td>
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
