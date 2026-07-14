/**
 * Readiness RTC por período — sem misturar em Contrib Bloco M.
 */

import type { RtcSnapshot } from "@/modules/rtc/types";
import { resolveRtcPeriodSplit } from "@/modules/rtc/period";
import { reconcileRtcVsContribCredits } from "@/modules/rtc/dual-contrib";
import type { ContribEntry } from "@/modules/contrib/types";

export type RtcReadinessItem = {
  id: string;
  label: string;
  status: "complete" | "blocking" | "review" | "na" | "warning";
  message?: string;
};

export type RtcReadiness = {
  items: RtcReadinessItem[];
  canMaterializeLab: boolean;
  blockingCount: number;
};

export function detectRtcReadiness(input: {
  periodKey: string;
  snapshot?: RtcSnapshot;
  contribEntries?: ContribEntry[];
}): RtcReadiness {
  const profile = resolveRtcPeriodSplit(input.periodKey);
  const items: RtcReadinessItem[] = [
    {
      id: "source",
      label: "Fonte oficial",
      status: "complete",
      message: profile.sourceId,
    },
    {
      id: "split",
      label: `Split ${profile.split}`,
      status: "complete",
      message: profile.notes[0],
    },
    {
      id: "contrib_preserved",
      label: "Módulo Contribuições preservado",
      status: "complete",
      message: "historical_and_credit_management permanece disponível",
    },
  ];

  const facts = input.snapshot?.facts || [];
  if (profile.split === "pre_reform") {
    items.push({
      id: "facts",
      label: "Fatos RTC",
      status: "na",
      message: "Pré-reforma — fatos RTC opcionais",
    });
  } else {
    items.push({
      id: "facts",
      label: "Fatos RTC",
      status: facts.length ? "complete" : "review",
      message: facts.length
        ? `${facts.length} fato(s)`
        : "Sem fatos — lab estrutural apenas (não inventar)",
    });
  }

  const invented = facts.filter(
    (f) => f.origin === "manual" && f.rateExplicit && !f.sourceId,
  );
  if (invented.length) {
    items.push({
      id: "no_invent",
      label: "Alíquotas sem sourceId",
      status: "blocking",
      message: `${invented.length} fato(s)`,
    });
  }

  const recon = reconcileRtcVsContribCredits({
    periodKey: input.periodKey,
    rtcFacts: facts,
    contribEntries: input.contribEntries || [],
  });
  if (!recon.ok) {
    items.push({
      id: "dual",
      label: "Dualidade Contrib",
      status: "blocking",
      message: recon.findings.find((f) => f.severity === "error")?.message,
    });
  } else {
    items.push({
      id: "dual",
      label: "Dualidade Contrib",
      status: "complete",
      message: `${recon.findings.length} finding(s)`,
    });
  }

  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return {
    items,
    canMaterializeLab: blockingCount === 0,
    blockingCount,
  };
}
