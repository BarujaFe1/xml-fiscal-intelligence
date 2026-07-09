"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { Badge, typeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatCnpjCpf, formatDate } from "@/lib/utils";
import type { DocumentField, DocumentItem, DocumentSummary } from "@/types";

function TreeNode({ data, name }: { data: unknown; name?: string }) {
  const [open, setOpen] = useState(true);
  if (data === null || data === undefined) {
    return (
      <div className="font-mono text-xs">
        {name && <span className="text-sky-300">{name}: </span>}
        <span className="text-slate-500">null</span>
      </div>
    );
  }
  if (typeof data !== "object") {
    return (
      <div className="font-mono text-xs">
        {name && <span className="text-sky-300">{name}: </span>}
        <span className="text-emerald-200">{String(data)}</span>
      </div>
    );
  }
  const entries = Array.isArray(data)
    ? data.map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>);
  return (
    <div className="font-mono text-xs">
      <button type="button" className="text-slate-400 hover:text-slate-200" onClick={() => setOpen((v) => !v)}>
        {open ? "▼" : "▶"} {name || "root"}
      </button>
      {open && (
        <div className="ml-4 border-l border-white/10 pl-3 space-y-1 mt-1">
          {entries.map(([k, v]) => (
            <TreeNode key={k} name={k} data={v} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string; documentId: string }>();
  const [document, setDocument] = useState<DocumentSummary | null>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [tab, setTab] = useState<"resumo" | "itens" | "tags" | "tree" | "json">("resumo");
  const [mask, setMask] = useState(true);

  useEffect(() => {
    fetch(`/api/batches/${params.id}/documents/${params.documentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setDocument(d.document);
        setItems(d.items || []);
        setFields(d.fields || []);
      });
  }, [params.id, params.documentId]);

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.pathNormalized.localeCompare(b.pathNormalized)),
    [fields],
  );

  if (!document) return <div className="skeleton h-64 rounded-2xl" />;

  async function copyKey() {
    if (!document?.accessKey) return;
    await navigator.clipboard.writeText(document.accessKey);
    toast.success("Chave copiada");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/app/batches/${params.id}/documents`} className="text-sm text-slate-500 hover:text-slate-300">
            ← Documentos
          </Link>
          <h1 className="mt-2 text-2xl font-bold flex items-center gap-3">
            <Badge tone={typeTone(document.documentType)}>{document.documentType}</Badge>
            {document.number || document.fileName}
          </h1>
          <p className="text-slate-400 mt-1 font-mono text-xs break-all">{document.accessKey || "Sem chave"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={copyKey}>
            <Copy className="h-4 w-4" /> Copiar chave
          </Button>
          <a href={`/api/batches/${params.id}/documents/${params.documentId}?format=xml`}>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4" /> XML
            </Button>
          </a>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const blob = new Blob([JSON.stringify(document.flattenedJson, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = window.document.createElement("a");
              a.href = url;
              a.download = `${document.number || document.id}-flat.json`;
              a.click();
            }}
          >
            JSON flat
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMask((v) => !v)}>
            {mask ? "Mostrar docs" : "Mascarar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["resumo", "Resumo"],
            ["itens", "Itens"],
            ["tags", "Todas as tags"],
            ["tree", "XML tree"],
            ["json", "JSON"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-xl px-3 py-1.5 text-sm border ${
              tab === id
                ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                : "border-white/10 text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Cabeçalho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Série" value={document.series} />
              <Row label="Modelo" value={document.model} />
              <Row label="Emissão" value={formatDate(document.issueDate)} />
              <Row label="Autorização" value={formatDate(document.authorizationDate)} />
              <Row label="Protocolo" value={document.protocol} />
              <Row label="Status" value={document.status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Emitente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Nome" value={document.emitterName} />
              <Row label="Doc" value={formatCnpjCpf(document.emitterDoc, mask)} />
              <Row label="Município" value={document.emitterCity} />
              <Row label="UF" value={document.emitterUf} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Destinatário / Tomador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Nome" value={document.receiverName} />
              <Row label="Doc" value={formatCnpjCpf(document.receiverDoc, mask)} />
              <Row label="Município" value={document.receiverCity} />
              <Row label="UF" value={document.receiverUf} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Valores</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 md:grid-cols-6 text-sm">
              {[
                ["Total", document.totalValue],
                ["Produtos", document.productsValue],
                ["Serviços", document.servicesValue],
                ["Frete", document.freightValue],
                ["Desconto", document.discountValue],
                ["Impostos", document.taxValue],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="font-semibold">{formatCurrency(value as number)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "itens" && (
        <Card>
          <CardHeader>
            <CardTitle>Itens ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="py-2">#</th>
                  <th className="py-2">Código</th>
                  <th className="py-2">Descrição</th>
                  <th className="py-2">NCM</th>
                  <th className="py-2">CFOP</th>
                  <th className="py-2">Qtd</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-white/5">
                    <td className="py-2">{i.itemNumber}</td>
                    <td className="py-2">{i.code || "—"}</td>
                    <td className="py-2">{i.description || "—"}</td>
                    <td className="py-2">{i.ncm || "—"}</td>
                    <td className="py-2">{i.cfop || "—"}</td>
                    <td className="py-2">
                      {i.quantity ?? "—"} {i.unit || ""}
                    </td>
                    <td className="py-2">{formatCurrency(i.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "tags" && (
        <Card>
          <CardHeader>
            <CardTitle>Todas as tags ({sortedFields.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-950">
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="py-2">Path</th>
                  <th className="py-2">Valor</th>
                  <th className="py-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {sortedFields.map((f) => (
                  <tr key={f.id} className="border-b border-white/5">
                    <td className="py-2 font-mono text-xs text-sky-200">{f.pathNormalized}</td>
                    <td className="py-2 text-slate-300">{f.valueText || "—"}</td>
                    <td className="py-2 text-slate-500">{f.inferredType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "tree" && (
        <Card>
          <CardHeader>
            <CardTitle>XML tree viewer</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-auto rounded-xl bg-slate-950/60 p-4">
            <TreeNode data={document.rawJson} name="root" />
          </CardContent>
        </Card>
      )}

      {tab === "json" && (
        <Card>
          <CardHeader>
            <CardTitle>JSON achatado</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[70vh] overflow-auto rounded-xl bg-slate-950/60 p-4 text-xs text-slate-300">
              {JSON.stringify(document.flattenedJson, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value || "—"}</span>
    </div>
  );
}
