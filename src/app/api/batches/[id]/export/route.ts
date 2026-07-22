import { NextRequest, NextResponse } from "next/server";
import { buildExportDataset } from "@/lib/export/v2/dataset";
import { buildWorkbookFromDataset } from "@/lib/export/v2/excel";
import { buildDocumentsCsvFromDataset, buildItemsCsvFromDataset } from "@/lib/export/v2/csv";
import { buildHtmlFromDataset } from "@/lib/export/v2/html";
import { buildJsonFromDataset } from "@/lib/export/v2/json";
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
  const privacy =
    (req.nextUrl.searchParams.get("privacy") as "operational_full" | "shareable_masked" | null) ||
    "operational_full";
  const allIds = store.documents.map((d) => d.id);
  const dataset = buildExportDataset(store, allIds, {
    privacyProfile: privacy === "shareable_masked" ? "shareable_masked" : "operational_full",
    includeRawStructures: type === "json-flat",
  });

  if (type === "xlsx") {
    const buffer = await buildWorkbookFromDataset(dataset);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lote-${id}.xlsx"`,
      },
    });
  }

  if (type === "csv-documents") {
    const csv = buildDocumentsCsvFromDataset(dataset, "excel_pt_br");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="documentos-${id}.csv"`,
      },
    });
  }

  if (type === "csv-items") {
    const csv = buildItemsCsvFromDataset(dataset, "excel_pt_br");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="itens-${id}.csv"`,
      },
    });
  }

  if (type === "json") {
    const body = buildJsonFromDataset(dataset, "compact");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="lote-${id}.json"`,
      },
    });
  }

  if (type === "json-flat") {
    const body = buildJsonFromDataset(dataset, "flat");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="flat-${id}.json"`,
      },
    });
  }

  if (type === "html") {
    const html = buildHtmlFromDataset(dataset);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-${id}.html"`,
      },
    });
  }

  return NextResponse.json({ error: "Tipo de exportação inválido" }, { status: 400 });
}
