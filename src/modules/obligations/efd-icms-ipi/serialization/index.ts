import type {
  ObligationBuildResult,
  ObligationContext,
  ObligationRecord,
  SerializedObligation,
  ValidationResult,
  GenerationManifest,
} from "@/modules/obligations/core/types";
import { sha256Hex } from "@/lib/security/hash";
import { efdSanitize } from "@/modules/obligations/efd-icms-ipi/common";

export async function serializeEfd(
  build: ObligationBuildResult,
): Promise<SerializedObligation> {
  const lines = build.records.map(
    (r) =>
      `|${r.fields.map((f) => efdSanitize(f === undefined || f === null ? "" : String(f))).join("|")}|`,
  );
  const content = lines.join("\r\n") + "\r\n";
  const contentHash = await sha256Hex(content);
  return {
    encoding: "utf-8",
    lineEnding: "\r\n",
    content,
    contentHash,
    recordCount: build.records.length,
  };
}

export async function createEfdManifest(
  build: ObligationBuildResult,
  serialized: SerializedObligation,
  context: ObligationContext,
  validation: ValidationResult,
): Promise<GenerationManifest> {
  return {
    obligationId: "efd-icms-ipi",
    layoutVersion: build.layoutVersion,
    periodStart: context.periodStart,
    periodEnd: context.periodEnd,
    establishmentId: context.establishmentId,
    contentHash: serialized.contentHash,
    generatedAt: new Date().toISOString(),
    warnings: build.warnings,
    validationLevel: validation.level,
    disclaimer:
      "Pré-validação interna apenas. Não substitui o PVA oficial, assinatura ou transmissão. Não constitui parecer fiscal.",
  };
}
