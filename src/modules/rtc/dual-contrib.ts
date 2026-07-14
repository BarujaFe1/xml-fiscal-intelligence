/**
 * Dualidade RTC × EFD-Contribuições — reconciliação de créditos históricos.
 */

import type { ContribEntry } from "@/modules/contrib/types";
import type { RtcFact } from "@/modules/rtc/types";
import { assertContribModulePreserved, resolveRtcPeriodSplit } from "@/modules/rtc/period";
import { listSupportedModes } from "@/modules/contrib/modes";

export type RtcContribReconFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
};

export function reconcileRtcVsContribCredits(input: {
  periodKey: string;
  rtcFacts: RtcFact[];
  contribEntries: ContribEntry[];
}): { ok: boolean; findings: RtcContribReconFinding[]; contribPreserved: true } {
  const findings: RtcContribReconFinding[] = [];
  const preserved = assertContribModulePreserved();
  findings.push({ code: "CONTRIB_PRESERVED", severity: "info", message: preserved.message });

  const modes = listSupportedModes();
  if (!modes.includes("historical_and_credit_management")) {
    findings.push({
      code: "CONTRIB_MODE_MISSING",
      severity: "error",
      message: "Modo historical_and_credit_management ausente — violação Fase 6/8",
    });
  }

  const profile = resolveRtcPeriodSplit(input.periodKey);
  findings.push({
    code: "SPLIT",
    severity: "info",
    message: `split=${profile.split} · contribHint=${profile.contribModeHint} · ${profile.sourceId}`,
  });

  const legacyCredits = input.contribEntries.filter(
    (e) => e.kind === "credit" && e.creditExplicit && e.periodKey <= input.periodKey,
  );
  const rtcCredits = input.rtcFacts.filter((f) => f.creditExplicit && f.creditAmount);

  if (profile.split !== "pre_reform" && legacyCredits.length && !rtcCredits.length) {
    findings.push({
      code: "LEGACY_CREDIT_UNLINKED",
      severity: "warning",
      message: `${legacyCredits.length} crédito(s) Contrib históricos sem vínculo RTC explícito — não aplicar silenciosamente`,
    });
  }

  for (const f of input.rtcFacts) {
    if (f.rateExplicit == null && f.taxAmountExplicit == null && f.baseAmount) {
      findings.push({
        code: "BASE_WITHOUT_RATE",
        severity: "info",
        message: `Fato ${f.id}: base sem alíquota/valor explícitos — não inventar CBS/IBS`,
      });
    }
  }

  // Proibir misturar: se alguém marcar credit de Contrib como RTC taxKind errado — N/A no modelo separado
  const ok = !findings.some((f) => f.severity === "error");
  return { ok, findings, contribPreserved: true };
}
