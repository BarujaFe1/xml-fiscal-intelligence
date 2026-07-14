/**
 * Evidence binder export para CI — markdown/manifest sem claim SOC2.
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { buildEvidenceBinder, binderToMarkdown } from "@/modules/enterprise/evidence-binder";
import { buildCompliancePack, packManifestJson, packToMarkdown } from "@/modules/compliance/pack";
import {
  readinessMarkdown,
  soaMarkdown,
  soc2ReadinessChecklist,
} from "@/modules/assurance/soc2-readiness";
import { section28Phase17Report } from "@/modules/assurance/platform";

export type BinderCiExportResult = {
  dir: string;
  files: string[];
};

/**
 * Exporta artefatos de evidência para um diretório (CI/local).
 * Default: `artifacts/assurance-binder`
 */
export async function exportAssuranceBinderCi(input?: {
  outDir?: string;
  hasStagingDrDrillEvidence?: boolean;
}): Promise<BinderCiExportResult> {
  const dir = path.resolve(input?.outDir || "artifacts/assurance-binder");
  await mkdir(dir, { recursive: true });

  const section28 = await section28Phase17Report();
  const binder = buildEvidenceBinder({
    section28Extra: section28,
    slaMarkdown: "Ver docs/SLA.md",
  });
  const pack = await buildCompliancePack({ section28Extra: section28 });
  const readiness = readinessMarkdown(
    soc2ReadinessChecklist({
      hasStagingDrDrillEvidence: input?.hasStagingDrDrillEvidence,
    }),
  );

  const files: Array<[string, string]> = [
    ["README.md", "# Assurance binder CI export\n\nNão constitui SOC2 Type I.\n"],
    ["evidence-binder.md", binderToMarkdown(binder)],
    ["compliance-pack.md", packToMarkdown(pack)],
    ["compliance-manifest.json", packManifestJson(pack)],
    ["soc2-readiness.md", readiness],
    ["statement-of-applicability.md", soaMarkdown()],
  ];

  const written: string[] = [];
  for (const [name, content] of files) {
    await writeFile(path.join(dir, name), content, "utf8");
    written.push(name);
  }
  return { dir, files: written };
}
