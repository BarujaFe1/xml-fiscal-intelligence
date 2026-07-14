/**
 * Layout/guide resolution by competence — do not hardcode “versão atual” in UI.
 * Values must come from official_sources / guide vigência tables once seeded.
 */
export type EfdLayoutGuideResolution = {
  layoutCode: string;
  guideVersion: string;
  sourceNote: string;
  competenceStart: string;
  competenceEnd: string;
};

/**
 * Provisional matrix — confirm against Portal SPED before treating as production truth.
 * Guia 3.2.3 (PDF 06/05/2026) exists locally; applicability by month must be verified officially.
 */
export function resolveEfdLayoutGuide(periodStartIso: string): EfdLayoutGuideResolution {
  const y = Number(periodStartIso.slice(0, 4));
  const m = Number(periodStartIso.slice(5, 7));
  if (!y || !m) {
    throw new Error("periodStart inválido (YYYY-MM-DD)");
  }
  // Provisional: keep 2026 layout code used by plugin; mark guide as pending official cross-check.
  if (y < 2027) {
    return {
      layoutCode: "020",
      guideVersion: "3.2.2-or-confirm",
      sourceNote:
        "Provisório: confirmar Guia aplicável a 2026 no portal SPED antes de produção. PDF local 3.2.3 (06/05/2026) não substitui consulta oficial.",
      competenceStart: periodStartIso,
      competenceEnd: periodStartIso,
    };
  }
  return {
    layoutCode: "020",
    guideVersion: "3.2.3-confirm",
    sourceNote:
      "Provisório para ≥2027: cruzar Guia 3.2.3 e atos COTEPE vigentes. Não inventar COD_VER.",
    competenceStart: periodStartIso,
    competenceEnd: periodStartIso,
  };
}
