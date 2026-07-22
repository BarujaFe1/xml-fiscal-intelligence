import { NextResponse } from "next/server";
import {
  EFD_ICMS_IPI_LAYOUT_2026,
  efdIcmsIpiPlugin,
  buildObligationContextFromBatch,
  filterDocumentsByPeriod,
} from "@/modules/obligations";
import { assertBooleanEntitlement, getPlanEntitlements } from "@/lib/entitlements";
import { getStorageProvider } from "@/lib/storage/provider";
import type { BatchStore } from "@/types";

/**
 * Generate EFD ICMS/IPI TXT from a BatchStore payload (privacy/local or SaaS).
 * Entitlement checked server-side. Does NOT claim PVA validation.
 */
export async function POST(req: Request) {
  try {
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
    };

    const entitlements = getPlanEntitlements(body.planId || "trial");
    assertBooleanEntitlement(entitlements, "canGenerateEfdIcmsIpi");

    if (!body.store?.documents?.length) {
      return NextResponse.json({ error: "BatchStore sem documentos" }, { status: 400 });
    }

    const periodFilter = filterDocumentsByPeriod(
      body.store.documents,
      body.establishment?.periodStart,
      body.establishment?.periodEnd,
    );
    const context = buildObligationContextFromBatch({
      establishment: {
        workspaceId: body.workspaceId || body.store.batch.workspaceId || "ws_local",
        companyId: "co_local",
        establishmentId: "est_local",
        layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
        ...body.establishment,
      },
      documents: periodFilter.inPeriod,
      items: body.store.items,
    });
    context.outOfPeriodCount = periodFilter.outOfPeriodCount;

    const readiness = await efdIcmsIpiPlugin.detectRequiredData(context);
    if (!readiness.canGenerate) {
      return NextResponse.json(
        {
          error: "Geração bloqueada por pendências",
          readiness,
          validationLevel: "none",
          disclaimer:
            "Pré-validação/prontidão apenas. Não é validação PVA nem parecer fiscal.",
        },
        { status: 422 },
      );
    }

    const build = await efdIcmsIpiPlugin.build(context);
    const validation = await efdIcmsIpiPlugin.validate(build, context);
    const serialized = await efdIcmsIpiPlugin.serialize(build, context);
    const manifest = await efdIcmsIpiPlugin.createManifest(
      build,
      serialized,
      context,
      validation,
    );

    const storage = getStorageProvider();
    await storage.putObject({
      workspaceId: context.workspaceId,
      key: `efd/${manifest.establishmentId}/${manifest.contentHash}.txt`,
      body: serialized.content,
      contentType: "text/plain; charset=utf-8",
    });
    await storage.putObject({
      workspaceId: context.workspaceId,
      key: `efd/${manifest.establishmentId}/${manifest.contentHash}.manifest.json`,
      body: JSON.stringify(manifest, null, 2),
      contentType: "application/json",
    });

    return NextResponse.json({
      ok: validation.ok,
      readiness,
      validation,
      manifest,
      recordCount: serialized.recordCount,
      contentHash: serialized.contentHash,
      content: serialized.content,
      lineageSample: build.lineage.slice(0, 20),
      label: "pré-validação interna — importar no PVA oficial",
      disclaimer: manifest.disclaimer,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na geração" },
      { status: 500 },
    );
  }
}
