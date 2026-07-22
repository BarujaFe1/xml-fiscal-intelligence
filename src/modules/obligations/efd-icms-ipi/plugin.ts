import type {
  FiscalObligationPlugin,
  ObligationBuildResult,
  ObligationRecord,
  ValidationResult,
} from "@/modules/obligations/core/types";
import { validateBlockOpenerOrder } from "@/modules/obligations/efd-icms-ipi/validate-structure";
import { validateEfdOffline } from "@/modules/obligations/efd-icms-ipi/layouts/020";
import {
  EFD_ICMS_IPI_LAYOUT_2026,
  EFD_SOURCE_ID,
  efdIcmsIpiCodVer,
} from "@/modules/obligations/efd-icms-ipi/constants";
import { efdSanitize } from "@/modules/obligations/efd-icms-ipi/common";
import {
  buildEfdIcmsIpi,
  detectEfdRequiredData,
} from "@/modules/obligations/efd-icms-ipi/builders";
import {
  serializeEfd,
  createEfdManifest,
} from "@/modules/obligations/efd-icms-ipi/serialization";

export { EFD_ICMS_IPI_LAYOUT_2026, EFD_SOURCE_ID, efdIcmsIpiCodVer };
export { efdSanitize };
export { buildEfdIcmsIpi, detectEfdRequiredData };
export { serializeEfd, createEfdManifest };

export async function validateEfdBuild(
  build: ObligationBuildResult,
): Promise<ValidationResult> {
  const issues: ValidationResult["issues"] = [];
  const types = build.records.map((r) => r.type);
  for (const s of validateBlockOpenerOrder(types)) {
    issues.push({
      code: s.code,
      severity: s.severity,
      message: s.message,
    });
  }
  for (const w of build.warnings) {
    issues.push({ code: "EFD_BUILD_WARNING", severity: "warning", message: w });
  }
  let sawC100 = false;
  for (const r of build.records) {
    if (r.type === "C100") sawC100 = true;
    if (r.type === "C170" && !sawC100) {
      issues.push({
        code: "EFD_C170_ORPHAN",
        severity: "error",
        record: "C170",
        message: "C170 sem C100 precedente",
      });
    }
    if (r.type === "C990") sawC100 = false;
  }
  const r0400 = build.records.find((r) => r.type === "0400");
  if (r0400 && r0400.fields.length !== 3) {
    issues.push({
      code: "EFD_0400_FIELD_COUNT",
      severity: "error",
      record: "0400",
      message: `0400 deve ter 3 campos (incl. REG); veio ${r0400.fields.length}`,
    });
  }
  // Validação offline por leiaute 020 (contagens, enums, ordem, x-refs, contadores)
  const serialized = await serializeEfd(build);
  const lines = serialized.content.split(/\r?\n/).filter(Boolean);
  for (const issue of validateEfdOffline({ lines })) {
    issues.push({
      code: issue.rule,
      severity: issue.severity,
      record: issue.recordCode,
      field: issue.field,
      message: issue.message,
    });
  }
  return { level: 1, ok: !issues.some((i) => i.severity === "error"), issues };
}

export const efdIcmsIpiPlugin: FiscalObligationPlugin = {
  id: "efd-icms-ipi",
  name: "EFD ICMS/IPI (SPED Fiscal)",
  jurisdiction: "federal",
  supportedVersions: [EFD_ICMS_IPI_LAYOUT_2026],
  async resolveVersion(context) {
    // Period-aware stub: always return registered draft until official_sources filled
    void context;
    return { layoutVersion: EFD_ICMS_IPI_LAYOUT_2026, sourceId: EFD_SOURCE_ID };
  },
  async detectRequiredData(context) {
    return detectEfdRequiredData(context);
  },
  async build(context) {
    return buildEfdIcmsIpi(context);
  },
  async validate(build) {
    return validateEfdBuild(build);
  },
  async serialize(build) {
    return serializeEfd(build);
  },
  async createManifest(build, serialized, context, validation) {
    return createEfdManifest(build, serialized, context, validation);
  },
};
