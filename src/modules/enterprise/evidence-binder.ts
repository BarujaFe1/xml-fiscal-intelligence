/**
 * Evidence binder — export markdown/+zip §28 + audit + policies.
 */

import JSZip from "jszip";
import type { EvidenceBinder, EvidenceBinderSection } from "@/modules/enterprise/types";
import { controlMatrixMarkdown } from "@/modules/enterprise/controls";

export function buildEvidenceBinder(input: {
  auditCsv?: string;
  retentionMarkdown?: string;
  section28Extra?: string;
  slaMarkdown?: string;
}): EvidenceBinder {
  const sections: EvidenceBinderSection[] = [
    {
      id: "disclaimer",
      title: "Disclaimer",
      markdown: [
        "Este binder prepara evidências para auditoria externa.",
        "**Não** constitui certificação SOC2 Type I/II nem ISO 27001.",
      ].join(" "),
    },
    {
      id: "controls",
      title: "Control matrix",
      markdown: controlMatrixMarkdown(),
    },
    {
      id: "governance_capabilities",
      title: "Governance capabilities",
      markdown: [
        "- RBAC owner/preparer/approver/auditor",
        "- export trilha auditoria sanitizada",
        "- retenção versionada + DPA template",
        "- SLA draft + campanhas validated_scope",
        "- deny live ERP sem env",
      ].join("\n"),
    },
    {
      id: "section28",
      title: "§28 packs",
      markdown: input.section28Extra || "_Anexar exports §28 das fases 9–12._",
    },
    {
      id: "audit",
      title: "Audit CSV",
      markdown: input.auditCsv
        ? "```csv\n" + input.auditCsv.slice(0, 20000) + "\n```"
        : "_Sem audit CSV anexado nesta geração._",
    },
    {
      id: "retention",
      title: "Retention policies",
      markdown: input.retentionMarkdown || "_Sem políticas anexadas._",
    },
    {
      id: "sla",
      title: "SLA",
      markdown: input.slaMarkdown || "Ver docs/SLA.md (draft até status commercially_bound).",
    },
  ];
  return {
    generatedAt: new Date().toISOString(),
    sections,
    disclaimer:
      "Binder de preparação — sem selo SOC2/ISO. Células validated_scope ≠ production global.",
  };
}

export function binderToMarkdown(binder: EvidenceBinder): string {
  const parts = [
    `# Evidence binder`,
    "",
    `Gerado: ${binder.generatedAt}`,
    "",
    `> ${binder.disclaimer}`,
    "",
  ];
  for (const s of binder.sections) {
    parts.push(`## ${s.title}`, "", s.markdown, "");
  }
  return parts.join("\n");
}

export async function binderToZipBlob(binder: EvidenceBinder): Promise<Blob> {
  const zip = new JSZip();
  zip.file("README.md", binderToMarkdown(binder));
  for (const s of binder.sections) {
    const safe = s.id.replace(/[^a-z0-9_-]+/gi, "_");
    zip.file(`sections/${safe}.md`, `# ${s.title}\n\n${s.markdown}\n`);
  }
  zip.file(
    "MANIFEST.json",
    JSON.stringify(
      {
        generatedAt: binder.generatedAt,
        disclaimer: binder.disclaimer,
        sections: binder.sections.map((s) => s.id),
        soc2Certified: false,
        iso27001Certified: false,
      },
      null,
      2,
    ),
  );
  return zip.generateAsync({ type: "blob" });
}
