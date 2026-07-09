"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BatchStore } from "@/types";

const exportsList = [
  { type: "xlsx", label: "Excel completo (múltiplas abas)", desc: "Resumo, Documentos, Itens, Campos, Erros, Insights" },
  { type: "csv-documents", label: "CSV Documentos", desc: "Uma linha por documento" },
  { type: "csv-items", label: "CSV Itens", desc: "Uma linha por item" },
  { type: "json", label: "JSON completo", desc: "Store inteiro do lote" },
  { type: "json-flat", label: "JSON achatado", desc: "Documentos com flattened paths" },
  { type: "html", label: "Relatório HTML", desc: "Resumo executivo para compartilhar" },
];

export default function ExportsPage() {
  const params = useParams<{ id: string }>();
  const [store, setStore] = useState<BatchStore | null>(null);

  useEffect(() => {
    fetch(`/api/batches/${params.id}`)
      .then((r) => r.json())
      .then((d) => setStore(d.error ? null : d));
  }, [params.id]);

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Exportações</h1>
      <div className="flex flex-wrap gap-2">
        {[
          ["", "Dashboard"],
          ["/documents", "Documentos"],
          ["/items", "Itens"],
          ["/fields", "Campos"],
          ["/quality", "Quality"],
          ["/exports", "Exportações"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={`/app/batches/${params.id}${href}`}
            className={`rounded-xl px-3 py-1.5 text-sm border ${
              href === "/exports"
                ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {exportsList.map((item) => (
          <Card key={item.type}>
            <CardHeader>
              <CardTitle>{item.label}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <a href={`/api/batches/${params.id}/export?type=${item.type}`}>
                <Button variant="secondary">
                  <Download className="h-4 w-4" /> Baixar
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
