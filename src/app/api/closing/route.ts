import { NextResponse } from "next/server";
import type { ClosingPeriodCard } from "@/modules/obligations/core/workflows/closing";

/**
 * Cloud mirror for closing cards — optional.
 * Local IndexedDB remains source of truth in the browser; this endpoint
 * accepts snapshots when cloud processing is on (same pattern as migrate).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { card?: ClosingPeriodCard };
    if (!body.card?.id) {
      return NextResponse.json({ error: "card.id obrigatório" }, { status: 400 });
    }
    // Persistence to Postgres deferred — acknowledge for API contract stability.
    return NextResponse.json({
      ok: true,
      persisted: false,
      message: "Snapshot recebido; persistência cloud de cockpit planejada (Fase 1 local-first)",
      cardId: body.card.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "closing upsert failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    store: "client_indexeddb",
    cloudPersisted: false,
  });
}
