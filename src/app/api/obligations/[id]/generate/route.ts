import { NextResponse } from "next/server";
import {
  buildObligationContextFromBatch,
  getObligationPlugin,
  isObligationId,
  EFD_ICMS_IPI_LAYOUT_2026,
  EFD_CONTRIB_LAYOUT_2026,
  ECD_LAYOUT_2026,
  ECF_LAYOUT_2026,
  REINF_LAYOUT_2026,
  runObligationPlugin,
} from "@/modules/obligations";
import { assertBooleanEntitlement, getPlanEntitlements } from "@/lib/entitlements";
import { getStorageProvider } from "@/lib/storage/provider";
import type { BatchStore } from "@/types";

const LAYOUTS: Record<string, string> = {
  "efd-icms-ipi": EFD_ICMS_IPI_LAYOUT_2026,
  "efd-contribuicoes": EFD_CONTRIB_LAYOUT_2026,
  ecd: ECD_LAYOUT_2026,
  ecf: ECF_LAYOUT_2026,
  reinf: REINF_LAYOUT_2026,
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!isObligationId(id)) {
      return NextResponse.json({ error: "Obrigação desconhecida" }, { status: 404 });
    }
    const plugin = getObligationPlugin(id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin indisponível" }, { status: 404 });
    }

    const body = (await req.json()) as {
      store: BatchStore;
      establishment: {
        cnpj: string;
        ie?: string;
        uf: string;
        companyName: string;
        profile: "A" | "B" | "C";
        activityCode: string;
        purpose: "0" | "1";
        periodStart: string;
        periodEnd: string;
        accountantName?: string;
        accountantCpf?: string;
      };
      planId?: string;
      workspaceId?: string;
      extras?: Record<string, unknown>;
    };

    const entitlements = getPlanEntitlements(body.planId || "trial");
    assertBooleanEntitlement(entitlements, "canGenerateObligations");

    // ECD/ECF can generate skeleton without NFe; others need docs
    const needsDocs = id === "efd-icms-ipi" || id === "efd-contribuicoes" || id === "reinf";
    if (needsDocs && !body.store?.documents?.length) {
      return NextResponse.json({ error: "BatchStore sem documentos" }, { status: 400 });
    }

    const context = buildObligationContextFromBatch({
      establishment: {
        workspaceId: body.workspaceId || body.store?.batch?.workspaceId || "ws_local",
        companyId: "co_local",
        establishmentId: "est_local",
        layoutVersion: LAYOUTS[id] || EFD_ICMS_IPI_LAYOUT_2026,
        ...body.establishment,
      },
      documents: body.store?.documents || [],
      items: body.store?.items || [],
    });
    if (body.extras) context.extras = { ...context.extras, ...body.extras };

    const result = await runObligationPlugin(plugin, context);
    if (!result.readiness.canGenerate || !result.serialized || !result.manifest) {
      return NextResponse.json(
        {
          error: "Geração bloqueada por pendências",
          readiness: result.readiness,
          validationLevel: "none",
          disclaimer: "Pré-validação/prontidão apenas. Não é validação PVA nem parecer fiscal.",
        },
        { status: 422 },
      );
    }

    const storage = getStorageProvider();
    const folder = id;
    await storage.putObject({
      workspaceId: context.workspaceId,
      key: `${folder}/${result.manifest.establishmentId}/${result.manifest.contentHash}.out`,
      body: result.serialized.content,
      contentType: id === "reinf" ? "application/json" : "text/plain; charset=utf-8",
    });
    await storage.putObject({
      workspaceId: context.workspaceId,
      key: `${folder}/${result.manifest.establishmentId}/${result.manifest.contentHash}.manifest.json`,
      body: JSON.stringify(result.manifest, null, 2),
      contentType: "application/json",
    });

    return NextResponse.json({
      ok: result.validation?.ok ?? false,
      obligationId: id,
      readiness: result.readiness,
      validation: result.validation,
      manifest: result.manifest,
      recordCount: result.serialized.recordCount,
      contentHash: result.serialized.contentHash,
      content: result.serialized.content,
      lineageSample: result.build?.lineage.slice(0, 20) || [],
      warnings: result.build?.warnings || [],
      label: "pré-validação interna — conferir no ambiente oficial",
      disclaimer: result.manifest.disclaimer,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na geração" },
      { status: 500 },
    );
  }
}
