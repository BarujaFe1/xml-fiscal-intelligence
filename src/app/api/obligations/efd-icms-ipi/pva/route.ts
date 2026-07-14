import {
  inferPvaStatus,
  mapPvaIssuesToInternal,
  parsePvaReportText,
  pvaResultToGenerationStatus,
  type PvaValidationImport,
} from "@/modules/obligations/efd-icms-ipi/pva/workflow";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServiceClient, hasServiceRole } from "@/lib/auth/supabase-service";
import { getStorageProvider } from "@/lib/storage/provider";
import { uuidFromLocalKey } from "@/lib/cloud/stable-uuid";
import { ensureWorkspace } from "@/modules/repositories/supabase-batch-repository";

export { pvaResultToGenerationStatus } from "@/modules/obligations/efd-icms-ipi/pva/workflow";

/**
 * Register a PVA validation result supplied by the user.
 * Persists when Supabase service role is available.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<PvaValidationImport> & {
      reportText?: string;
      workspaceId?: string;
      persistReport?: boolean;
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

    const generationStatus = pvaResultToGenerationStatus(resultStatus);
    let persisted = false;
    let reportStoragePath = body.reportStoragePath;

    if (isSupabaseConfigured() && hasServiceRole() && body.workspaceId) {
      const workspaceId = await ensureWorkspace(body.workspaceId, "Workspace PVA");
      const supabase = createServiceClient();

      if (body.persistReport !== false && body.reportText) {
        const storage = getStorageProvider();
        const key = `efd/${body.generationId}/pva-${Date.now()}.txt`;
        const put = await storage.putObject({
          workspaceId,
          key,
          body: body.reportText,
          contentType: "text/plain;charset=utf-8",
        });
        reportStoragePath = put.path;
      }

      const genId = uuidFromLocalKey("efd-gen", body.generationId);
      await supabase.from("obligation_generations").upsert(
        {
          id: genId,
          workspace_id: workspaceId,
          obligation: "efd-icms-ipi",
          layout_version: "assisted",
          period_start: body.validatedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          period_end: body.validatedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          status: generationStatus,
          content_hash: body.contentHash || null,
          validation_json: { pva: resultStatus, issues, generationStatus },
        },
        { onConflict: "id" },
      );

      const { error } = await supabase.from("pva_validation_runs").insert({
        workspace_id: workspaceId,
        generation_id: genId,
        pva_version: body.pvaVersion,
        result_status: resultStatus,
        report_storage_path: reportStoragePath || null,
        notes: body.notes || (body.reportText ? body.reportText.slice(0, 4000) : null),
      });
      if (!error) persisted = true;
    }

    return NextResponse.json({
      ok: true,
      record: { ...record, reportStoragePath },
      persisted,
      generationStatus,
      validationLevel: 3,
      disclaimer: record.disclaimer,
      note: persisted
        ? "Persistido em pva_validation_runs"
        : "Registro mapeado localmente. Configure Supabase + workspaceId para persistir.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "pva register failed" },
      { status: 500 },
    );
  }
}
