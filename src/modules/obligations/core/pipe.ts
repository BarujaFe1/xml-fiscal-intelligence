import { sha256Hex } from "@/lib/security/hash";
import type {
  FiscalObligationPlugin,
  GenerationManifest,
  ObligationBuildResult,
  ObligationContext,
  ObligationRecord,
  SerializedObligation,
  ValidationResult,
} from "@/modules/obligations/core/types";

export function pipeLine(fields: Array<string | number | undefined | null>): string {
  return `|${fields.map((f) => (f === undefined || f === null ? "" : String(f))).join("|")}|`;
}

export function flattenRecords(records: ObligationRecord[]): ObligationRecord[] {
  const out: ObligationRecord[] = [];
  for (const r of records) {
    out.push(r);
    if (r.children?.length) out.push(...flattenRecords(r.children));
  }
  return out;
}

export async function serializePipeRecords(
  records: ObligationRecord[],
): Promise<SerializedObligation> {
  const flat = flattenRecords(records);
  const lines = flat.map((r) => pipeLine([r.type, ...r.fields]));
  const content = `${lines.join("\r\n")}\r\n`;
  const contentHash = await sha256Hex(content);
  return {
    encoding: "utf-8",
    lineEnding: "\r\n",
    content,
    contentHash,
    recordCount: flat.length,
  };
}

export async function defaultManifest(input: {
  obligationId: string;
  build: ObligationBuildResult;
  serialized: SerializedObligation;
  context: ObligationContext;
  validation: ValidationResult;
  disclaimer: string;
}): Promise<GenerationManifest> {
  return {
    obligationId: input.obligationId,
    layoutVersion: input.build.layoutVersion,
    periodStart: input.context.periodStart,
    periodEnd: input.context.periodEnd,
    establishmentId: input.context.establishmentId,
    contentHash: input.serialized.contentHash,
    generatedAt: new Date().toISOString(),
    warnings: input.build.warnings,
    validationLevel: input.validation.level,
    disclaimer: input.disclaimer,
  };
}

export async function runObligationPlugin(
  plugin: FiscalObligationPlugin,
  context: ObligationContext,
): Promise<{
  readiness: Awaited<ReturnType<FiscalObligationPlugin["detectRequiredData"]>>;
  build?: ObligationBuildResult;
  validation?: ValidationResult;
  serialized?: SerializedObligation;
  manifest?: GenerationManifest;
}> {
  const readiness = await plugin.detectRequiredData(context);
  if (!readiness.canGenerate) {
    return { readiness };
  }
  const build = await plugin.build(context);
  const validation = await plugin.validate(build, context);
  const serialized = await plugin.serialize(build, context);
  const manifest = await plugin.createManifest(build, serialized, context, validation);
  return { readiness, build, validation, serialized, manifest };
}

/** Closing block counts for SPED-like files (9900 + 9990 + 9999). */
export function appendSpedClosers(
  records: ObligationRecord[],
  warnings: string[],
): ObligationRecord[] {
  const types = new Map<string, number>();
  for (const r of flattenRecords(records)) {
    types.set(r.type, (types.get(r.type) || 0) + 1);
  }
  const closers: ObligationRecord[] = [{ type: "9001", fields: ["0"] }];
  for (const [t, n] of [...types.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    closers.push({ type: "9900", fields: [t, String(n)] });
  }
  closers.push({ type: "9900", fields: ["9001", "1"] });
  closers.push({ type: "9900", fields: ["9900", String(types.size + 3)] });
  closers.push({ type: "9900", fields: ["9990", "1"] });
  closers.push({ type: "9900", fields: ["9999", "1"] });
  const with9900 = [...records, ...closers];
  const total = flattenRecords(with9900).length + 2; // +9990 +9999 about to add
  with9900.push({ type: "9990", fields: [String(closers.length + 1)] });
  with9900.push({ type: "9999", fields: [String(total)] });
  if (!warnings.includes("closers_auto")) {
    warnings.push("Contadores 9900/9990/9999 gerados automaticamente — conferir no PVA.");
  }
  return with9900;
}
