import { NextRequest, NextResponse } from "next/server";
import { deleteBatchStore, getBatchStore } from "@/lib/store/fs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const store = await getBatchStore(id);
  if (!store) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  return NextResponse.json(store);
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ok = await deleteBatchStore(id);
  if (!ok) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
