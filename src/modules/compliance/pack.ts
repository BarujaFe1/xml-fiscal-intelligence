/**
 * Compliance pack versionado + checklist pré-auditoria.
 * Hash via sha256Hex (browser + Node) — fingerprint, não assinatura notarizada.
 */

import { sha256Hex } from "@/lib/security/hash";
import type {
  AuditChecklistItem,
  CompliancePack,
  CompliancePackSection,
  CompliancePackVersion,
} from "@/modules/compliance/types";
import { controlMatrixMarkdown } from "@/modules/enterprise/controls";
import { binderToMarkdown, buildEvidenceBinder } from "@/modules/enterprise/evidence-binder";
import { defaultLegalStatus } from "@/modules/enterprise/legal-status";
import { defaultDrTargets, drTargetsMarkdown, backupRestoreProcedureMarkdown } from "@/modules/scale/dr";
import { persistenceInventoryMarkdown } from "@/modules/scale/persistence";
import { residualRisksMarkdown } from "@/modules/scale/hardening";
import {
  SLO_DEFINITIONS,
  computeSloSnapshot,
  seedStagingApiStatusSamples,
  computeErrorBudget,
} from "@/modules/ecosystem/slo";
import { section28Phase14Report } from "@/modules/ecosystem/platform";

export const COMPLIANCE_PACK_VERSION: CompliancePackVersion = {
  major: 1,
  minor: 0,
  patch: 0,
  label: "1.0.0-phase15",
};

export function formatPackVersion(v: CompliancePackVersion = COMPLIANCE_PACK_VERSION): string {
  return v.label;
}

export function preAuditChecklist(): AuditChecklistItem[] {
  return [
    { id: "controls", label: "Control matrix revisada", done: true, evidenceRef: "controls.ts" },
    { id: "binder", label: "Evidence binder gerável", done: true, evidenceRef: "evidence-binder.ts" },
    { id: "dr_drill", label: "Pelo menos 1 DR drill staging documentado", done: false },
    { id: "slo", label: "SLO api_status staging amostrado", done: true, evidenceRef: "ecosystem/slo" },
    { id: "dpa", label: "DPA template revisado por jurídico", done: false },
    { id: "sla", label: "SLA draft → commercially_bound (se aplicável)", done: false },
    { id: "secrets", label: "Secret path scan CI verde", done: true, evidenceRef: "secrets:scan-paths" },
    { id: "no_soc2_claim", label: "Marketing sem claim SOC2/ISO sem relatório", done: true },
  ];
}

export function checklistMarkdown(items: AuditChecklistItem[] = preAuditChecklist()): string {
  const lines = ["# Checklist pré-auditoria SOC2 (renovável)", "", "_Não é certificação._", ""];
  for (const i of items) {
    lines.push(`- [${i.done ? "x" : " "}] ${i.label}${i.evidenceRef ? ` (\`${i.evidenceRef}\`)` : ""}`);
  }
  return lines.join("\n");
}

function buildSections(input?: {
  section28Extra?: string;
  residualFindingsMarkdown?: string;
  auditCsv?: string;
}): CompliancePackSection[] {
  const legal = defaultLegalStatus();
  const staging = seedStagingApiStatusSamples(100);
  const snap = computeSloSnapshot("api_status_availability", staging);
  const budget = computeErrorBudget(snap);
  const binder = buildEvidenceBinder({
    section28Extra: input?.section28Extra || section28Phase14Report(),
    slaMarkdown: `SLA status: ${legal.sla} · DPA: ${legal.dpa}`,
    auditCsv: input?.auditCsv,
  });

  const sloMd = [
    "# SLO snapshots (staging seed)",
    "",
    ...SLO_DEFINITIONS.map((d) => {
      const s = computeSloSnapshot(d.id, d.id === "api_status_availability" ? staging : []);
      return `- **${d.id}**: samples=${s.sampleCount} avail=${s.availabilityPct ?? "n/a"} meets=${s.meetsTarget}`;
    }),
    "",
    `Error budget api_status: remaining=${budget.remainingPct.toFixed(0)}% exhausted=${budget.exhausted}`,
  ].join("\n");

  return [
    {
      id: "disclaimer",
      title: "Disclaimer",
      markdown:
        "Compliance pack de **preparação**. Não constitui SOC2 Type I/II nem ISO 27001. Hash = fingerprint de conteúdo, não assinatura digital notarizada.",
    },
    { id: "checklist", title: "Pré-auditoria", markdown: checklistMarkdown() },
    { id: "controls", title: "Control matrix", markdown: controlMatrixMarkdown() },
    { id: "binder", title: "Evidence binder", markdown: binderToMarkdown(binder) },
    {
      id: "dr",
      title: "DR",
      markdown: [drTargetsMarkdown(defaultDrTargets()), persistenceInventoryMarkdown(), backupRestoreProcedureMarkdown()].join(
        "\n\n",
      ),
    },
    { id: "slo", title: "SLO", markdown: sloMd },
    {
      id: "legal",
      title: "DPA / SLA status",
      markdown: [
        `# Legal status`,
        "",
        `- DPA: ${legal.dpa}`,
        `- SLA: ${legal.sla}`,
        `- soc2Certified: false`,
        `- iso27001Certified: false`,
        ...legal.notes.map((n) => `- ${n}`),
      ].join("\n"),
    },
    {
      id: "residual",
      title: "Residual risks",
      markdown: input?.residualFindingsMarkdown || residualRisksMarkdown([]),
    },
  ];
}

function bodyFromSections(sections: CompliancePackSection[]): string {
  return sections.map((s) => `# ${s.title}\n\n${s.markdown}`).join("\n\n---\n\n");
}

export async function buildCompliancePack(input?: {
  section28Extra?: string;
  residualFindingsMarkdown?: string;
  auditCsv?: string;
}): Promise<CompliancePack> {
  const sections = buildSections(input);
  const version = COMPLIANCE_PACK_VERSION;
  const generatedAt = new Date().toISOString();
  const contentHash = await sha256Hex(
    `${formatPackVersion(version)}\n${generatedAt}\n${bodyFromSections(sections)}`,
  );

  return {
    version,
    generatedAt,
    sections,
    contentHash,
    soc2Certified: false,
    iso27001Certified: false,
    disclaimer:
      "Pack preparatório — sem selo SOC2/ISO. production global não elevado. Regras fiscais estrangeiras fora de escopo.",
  };
}

export function packManifestJson(pack: CompliancePack): string {
  return JSON.stringify(
    {
      version: pack.version.label,
      generatedAt: pack.generatedAt,
      contentHash: pack.contentHash,
      sections: pack.sections.map((s) => s.id),
      soc2Certified: false,
      iso27001Certified: false,
      hashNote: "content fingerprint only — not a notarized signature",
    },
    null,
    2,
  );
}

export function packToMarkdown(pack: CompliancePack): string {
  return [
    `# Compliance pack ${pack.version.label}`,
    "",
    `Gerado: ${pack.generatedAt}`,
    `contentHash: \`${pack.contentHash}\``,
    "",
    `> ${pack.disclaimer}`,
    "",
    ...pack.sections.flatMap((s) => [`## ${s.title}`, "", s.markdown, ""]),
  ].join("\n");
}

export async function verifyPackHash(pack: CompliancePack): Promise<boolean> {
  const expect = await sha256Hex(
    `${formatPackVersion(pack.version)}\n${pack.generatedAt}\n${bodyFromSections(pack.sections)}`,
  );
  return expect === pack.contentHash;
}
