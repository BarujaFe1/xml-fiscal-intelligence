import { NextRequest, NextResponse } from "next/server";
import { deleteBatchStore, getBatchStore } from "@/lib/store/fs-store";
import { requireApiSession } from "@/lib/auth/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const store = await getBatchStore(auth.userId, id);
  if (!store) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  return NextResponse.json(store);
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const ok = await deleteBatchStore(auth.userId, id);
  if (!ok) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
