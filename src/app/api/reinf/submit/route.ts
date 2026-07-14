import { NextResponse } from "next/server";
import { submitReinfEvent, isReinfSubmitEnabled } from "@/modules/obligations/reinf/ws/client";

/** Dry-run / gated submit — never posts to RFB unless flags + future endpoint wiring. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: string;
      xmlSigned?: string;
      idempotencyKey?: string;
      eventCode?: string;
    };
    if (!body.id || !body.idempotencyKey || !body.eventCode) {
      return NextResponse.json(
        { error: "id, eventCode e idempotencyKey são obrigatórios" },
        { status: 400 },
      );
    }
    const result = await submitReinfEvent({
      id: body.id,
      xmlSigned: body.xmlSigned,
      idempotencyKey: body.idempotencyKey,
      eventCode: body.eventCode,
    });
    return NextResponse.json({
      ...result,
      featureSubmit: isReinfSubmitEnabled(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "reinf submit failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    featureSubmit: isReinfSubmitEnabled(),
    defaultEnvironment: "restricted",
    note: "Transmissão produção exige FEATURE_REINF_SUBMIT_PRODUCTION",
  });
}
