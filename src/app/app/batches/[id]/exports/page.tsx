"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchTabs } from "@/components/batches/batch-tabs";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import { buildExportDataset } from "@/lib/export/v2/dataset";
import { buildWorkbookFromDataset } from "@/lib/export/v2/excel";
import { buildDocumentsCsvFromDataset, buildItemsCsvFromDataset } from "@/lib/export/v2/csv";
import { buildHtmlFromDataset } from "@/lib/export/v2/html";
import { buildJsonFromDataset } from "@/lib/export/v2/json";
import { useBatchStore } from "@/lib/store/use-batch-store";
import type { BatchStore } from "@/types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function workbookFromRows(name: string, rows: Record<string, unknown>[]) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(name.slice(0, 31));
  if (!rows.length) {
    sheet.addRow(["Sem dados"]);
  } else {
    const columns = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach((k) => set.add(k));
        return set;
      }, new Set<string>()),
    );
    sheet.columns = columns.map((key) => ({
      header: key,
      key,
      width: Math.min(40, Math.max(12, key.length + 2)),
    }));
    for (const row of rows) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true };
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function exportPreset(store: BatchStore, preset: string) {
  const id = store.batch.id;
  const meta = {
    empresa: store.batch.cnpjLabel || "",
    competencia:
      store.batch.month && store.batch.year
        ? `${String(store.batch.month).padStart(2, "0")}/${store.batch.year}`
        : "",
    lote: id,
    gerado_em: new Date().toISOString(),
    versao_sistema: "0.1.0",
    aviso:
      "Este arquivo lista itens por CFOP/NCM. NÃO é apuração de ICMS nem memória de cálculo tributário.",
  };

  if (preset === "icms" || preset === "itens-cfop-ncm") {
    const rows = store.items
      .filter((i) => i.documentType === "NFE" || i.documentType === "NFCE")
      .map((i) => {
        const d = store.documents.find((x) => x.id === i.documentId);
        return {
          ...meta,
          chave: d?.accessKey || "",
          numero: d?.number || "",
          emissao: d?.issueDate || "",
          emitente: d?.emitterName || "",
          cfop: i.cfop || "",
          ncm: i.ncm || "",
          item: i.itemNumber,
          descricao: i.description || "",
          valor_item: i.totalValue ?? "",
          valor_nota: d?.totalValue ?? "",
          uf_emit: d?.emitterUf || "",
          uf_dest: d?.receiverUf || "",
        };
      });
    const buf = await workbookFromRows("Itens CFOP NCM", rows);
    downloadBlob(
      new Blob([new Uint8Array(buf)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `itens-cfop-ncm-sem-calculo-${id}.xlsx`,
    );
    return;
  }

  if (preset === "entradas-saidas") {
    const rows = store.documents.map((d) => ({
      tipo: d.documentType,
      chave: d.accessKey || "",
      numero: d.number || "",
      emissao: d.issueDate || "",
      emitente_doc: d.emitterDoc || "",
      emitente: d.emitterName || "",
      dest_doc: d.receiverDoc || "",
      destinatario: d.receiverName || "",
      uf_emit: d.emitterUf || "",
      uf_dest: d.receiverUf || "",
      valor: d.totalValue ?? "",
      produtos: d.productsValue ?? "",
      servicos: d.servicesValue ?? "",
      frete: d.freightValue ?? "",
      impostos: d.taxValue ?? "",
    }));
    const buf = await workbookFromRows("Movimento", rows);
    downloadBlob(
      new Blob([new Uint8Array(buf)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `entradas-saidas-${id}.xlsx`,
    );
    return;
  }

  if (preset === "itens-ncm-cfop") {
    const rows = store.items.map((i) => {
      const d = store.documents.find((x) => x.id === i.documentId);
      return {
        tipo: i.documentType,
        chave: d?.accessKey || "",
        numero: d?.number || "",
        item: i.itemNumber,
        codigo: i.code || "",
        descricao: i.description || "",
        ncm: i.ncm || "",
        cfop: i.cfop || "",
        qtd: i.quantity ?? "",
        unidade: i.unit || "",
        valor_unit: i.unitValue ?? "",
        valor_total: i.totalValue ?? "",
      };
    });
    const buf = await workbookFromRows("Itens", rows);
    downloadBlob(
      new Blob([new Uint8Array(buf)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `itens-ncm-cfop-${id}.xlsx`,
    );
    return;
  }

  if (preset === "divergencias") {
    const warnings = store.batch.quality?.warnings || [];
    const noKey = store.documents.filter((d) => d.documentType !== "NFSE" && !d.accessKey);
    const noProt = store.documents.filter(
      (d) => (d.documentType === "NFE" || d.documentType === "CTE") && !d.protocol,
    );
    const rows = [
      ...noKey.map((d) => ({
        problema: "SEM_CHAVE",
        tipo: d.documentType,
        numero: d.number || "",
        arquivo: d.fileName,
        valor: d.totalValue ?? "",
      })),
      ...noProt.map((d) => ({
        problema: "SEM_PROTOCOLO",
        tipo: d.documentType,
        numero: d.number || "",
        arquivo: d.fileName,
        valor: d.totalValue ?? "",
      })),
      ...warnings.map((w) => ({
        problema: w.code,
        tipo: "",
        numero: "",
        arquivo: w.message,
        valor: w.count,
      })),
    ];
    const buf = await workbookFromRows("Divergencias", rows);
    downloadBlob(
      new Blob([new Uint8Array(buf)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `divergencias-${id}.xlsx`,
    );
    return;
  }

  const allIds = store.documents.map((d) => d.id);
  const dataset = buildExportDataset(store, allIds, {
    privacyProfile: "operational_full",
  });

  if (preset === "xlsx") {
    const buffer = await buildWorkbookFromDataset(dataset);
    downloadBlob(
      new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `lote-${id}.xlsx`,
    );
    return;
  }
  if (preset === "csv-documents") {
    downloadBlob(
      new Blob([buildDocumentsCsvFromDataset(dataset, "excel_pt_br")], {
        type: "text/csv;charset=utf-8",
      }),
      `documentos-${id}.csv`,
    );
    return;
  }
  if (preset === "csv-items") {
    downloadBlob(
      new Blob([buildItemsCsvFromDataset(dataset, "excel_pt_br")], {
        type: "text/csv;charset=utf-8",
      }),
      `itens-${id}.csv`,
    );
    return;
  }
  if (preset === "json") {
    downloadBlob(
      new Blob([buildJsonFromDataset(dataset, "compact")], { type: "application/json" }),
      `lote-${id}.json`,
    );
    return;
  }
  if (preset === "json-flat") {
    const flatDs = buildExportDataset(store, allIds, {
      privacyProfile: "operational_full",
      includeRawStructures: true,
    });
    downloadBlob(
      new Blob([buildJsonFromDataset(flatDs, "flat")], { type: "application/json" }),
      `flat-${id}.json`,
    );
    return;
  }
  if (preset === "html") {
    downloadBlob(
      new Blob([buildHtmlFromDataset(dataset)], { type: "text/html;charset=utf-8" }),
      `relatorio-${id}.html`,
    );
  }
}

const presets = [
  {
    type: "icms",
    label: "Itens por CFOP e NCM — sem cálculo tributário",
    desc: "Lista operacional de itens NF-e/NFC-e. Não é apuração de ICMS.",
  },
  { type: "entradas-saidas", label: "Entradas x Saídas", desc: "Movimento documental consolidado" },
  { type: "itens-ncm-cfop", label: "Itens com NCM/CFOP", desc: "Planilha operacional de itens" },
  { type: "divergencias", label: "Só divergências", desc: "Sem chave, sem protocolo e alertas" },
  { type: "xlsx", label: "Excel completo", desc: "Múltiplas abas padrão" },
  { type: "csv-documents", label: "CSV Documentos", desc: "Uma linha por documento" },
  { type: "csv-items", label: "CSV Itens", desc: "Uma linha por item" },
  { type: "html", label: "Relatório HTML", desc: "Resumo executivo" },
] as const;

export default function ExportsPage() {
  const params = useParams<{ id: string }>();
  const { store } = useBatchStore(params.id);
  const [busy, setBusy] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!store) return null;
    return {
      docs: store.documents.length,
      items: store.items.length,
      value: store.batch.totalValue,
    };
  }, [store]);

  async function handleExport(type: string) {
    if (!store) return;
    setBusy(type);
    try {
      await exportPreset(store, type);
      toast.success("Download iniciado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na exportação");
    } finally {
      setBusy(null);
    }
  }

  if (!store) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Exportações</p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Presets contábeis
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {summary?.docs} docs · {summary?.items} itens · gerado no navegador
        </p>
      </div>
      <BatchTabs batchId={params.id} />
      <LocalPersistenceBanner compact />
      <div className="grid gap-4 md:grid-cols-2">
        {presets.map((item) => (
          <Card key={item.type} className="hover:border-sky-400/20 transition-colors">
            <CardHeader>
              <CardTitle>{item.label}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                disabled={busy === item.type}
                onClick={() => handleExport(item.type)}
              >
                {busy === item.type ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}{" "}
                Baixar
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>JSON completo / flat</CardTitle>
            <CardDescription>Para pipelines e BI</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExport("json")}>
              JSON
            </Button>
            <Button variant="outline" onClick={() => handleExport("json-flat")}>
              JSON flat
            </Button>
            <Link href={`/app/batches/${params.id}/quality`} className="text-sm text-sky-300 self-center ml-2">
              Ver quality →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
