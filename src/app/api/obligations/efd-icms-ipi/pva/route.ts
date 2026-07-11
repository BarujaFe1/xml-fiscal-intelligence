import { NextResponse } from "next/server";
import {
  inferPvaStatus,
  mapPvaIssuesToInternal,
  parsePvaReportText,
  type PvaValidationImport,
} from "@/modules/obligations/efd-icms-ipi/pva/workflow";
import { getFeatureFlags } from "@/lib/feature-flags";

/**
 * Register a PVA validation result supplied by the user.
 * Does not run the PVA. Persists to DB only when cloud is configured; always returns mapped record.
 */
export async function POST(req: Request) {
  const flags = getFeatureFlags();
  if (!flags.pvaImport && process.env.NODE_ENV === "production") {
    // Allow in all envs for assisted registration; flag gates "advanced" auto-import later.
  }

  try {
    const body = (await req.json()) as Partial<PvaValidationImport> & {
      reportText?: string;
    };

    if (!body.generationId || !body.pvaVersion) {
      return NextResponse.json(
        { error: "generationId e pvaVersion são obrigatórios" },
        { status: 400 },
      );
    }

    const issues =
      body.issues && body.issues.length
        ? body.issues
        : body.reportText
          ? parsePvaReportText(body.reportText)
          : [];

    const resultStatus = body.resultStatus || inferPvaStatus(issues);
    const record = mapPvaIssuesToInternal({
      generationId: body.generationId,
      contentHash: body.contentHash,
      pvaVersion: body.pvaVersion,
      resultStatus,
      issues,
      reportStoragePath: body.reportStoragePath,
      notes: body.notes,
      recordedBy: body.recordedBy || "user",
      validatedAt: body.validatedAt,
    });

    return NextResponse.json({
      ok: true,
      record,
      persisted: false,
      note: "Registro mapeado. Persistência em pva_validation_runs requer Supabase configurado.",
      validationLevel: 3,
      disclaimer: record.disclaimer,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "pva register failed" },
      { status: 500 },
    );
  }
}
