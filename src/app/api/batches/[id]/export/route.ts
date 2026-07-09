import { NextRequest, NextResponse } from "next/server";
import {
  buildBatchWorkbook,
  buildDocumentsCsv,
  buildHtmlReport,
  buildItemsCsv,
} from "@/lib/export/excel";
import { getBatchStore } from "@/lib/store/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const store = await getBatchStore(id);
  if (!store) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });

  const type = req.nextUrl.searchParams.get("type") || "xlsx";

  if (type === "xlsx") {
    const buffer = await buildBatchWorkbook(store);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lote-${id}.xlsx"`,
      },
    });
  }

  if (type === "csv-documents") {
    const csv = buildDocumentsCsv(store);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="documentos-${id}.csv"`,
      },
    });
  }

  if (type === "csv-items") {
    const csv = buildItemsCsv(store);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="itens-${id}.csv"`,
      },
    });
  }

  if (type === "json") {
    return NextResponse.json(store, {
      headers: {
        "Content-Disposition": `attachment; filename="lote-${id}.json"`,
      },
    });
  }

  if (type === "json-flat") {
    const flat = store.documents.map((d) => ({
      id: d.id,
      type: d.documentType,
      ...d.flattenedJson,
    }));
    return NextResponse.json(flat, {
      headers: {
        "Content-Disposition": `attachment; filename="flat-${id}.json"`,
      },
    });
  }

  if (type === "html") {
    const html = buildHtmlReport(store);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-${id}.html"`,
      },
    });
  }

  return NextResponse.json({ error: "Tipo de exportação inválido" }, { status: 400 });
}
