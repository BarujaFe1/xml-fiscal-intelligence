import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, idempotencyKey } from "@/modules/ops/api-auth";
import { createEvidenceMeta, assertNoBinaryPayload } from "@/modules/ops/evidence";
import { recordOpsEvent } from "@/modules/ops/telemetry";
import type { ObligationId } from "@/modules/obligations";
import type { OfficialProgramId } from "@/modules/obligations/core/maturity";
import { createRequestId } from "@/lib/observability";

export const dynamic = "force-dynamic";

/** In-memory lab store for API smoke (serverless-friendly ephemeral). */
const memoryEvidence = new Map<string, ReturnType<typeof createEvidenceMeta>>();
const idempotency = new Map<string, string>();

export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  const auth = authenticateApiKey(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, requestId }, { status: auth.status });
  }
  const ws = req.nextUrl.searchParams.get("workspaceId") || "";
  const items = [...memoryEvidence.values()].filter((e) => !ws || e.workspaceId === ws);
  return NextResponse.json({ items, requestId });
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  const auth = authenticateApiKey(req);
  if (!auth.ok) {
    recordOpsEvent("api_denied", auth.error);
    return NextResponse.json({ error: auth.error, requestId }, { status: auth.status });
  }
  const idem = idempotencyKey(req);
  if (idem && idempotency.has(idem)) {
    const existing = memoryEvidence.get(idempotency.get(idem)!);
    return NextResponse.json({ item: existing, requestId, idempotentReplay: true });
  }
  try {
    const body = await req.json();
    assertNoBinaryPayload(body?.reportBinary ?? body?.binary);
    const item = createEvidenceMeta({
      workspaceId: String(body.workspaceId || "ws_api"),
      obligationId: body.obligationId as ObligationId,
      program: body.program as OfficialProgramId,
      programVersion: String(body.programVersion || ""),
      contentHash: String(body.contentHash || ""),
      resultStatus: body.resultStatus || "unknown",
      generationId: body.generationId,
      responsible: body.responsible,
      storageRef: body.storageRef,
      notes: body.notes,
    });
    if (!item.contentHash || item.contentHash.length < 8) {
      return NextResponse.json(
        { error: "contentHash obrigatório", requestId },
        { status: 400 },
      );
    }
    memoryEvidence.set(item.id, item);
    if (idem) idempotency.set(idem, item.id);
    recordOpsEvent("lab_import", `evidence ${item.id}`);
    return NextResponse.json({ item, requestId }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid", requestId },
      { status: 400 },
    );
  }
}
