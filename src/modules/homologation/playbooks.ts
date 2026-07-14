/**
 * Playbooks: fixture → geração → programa oficial → evidência → matriz.
 */

import type { HomologationPlaybook } from "@/modules/homologation/types";

const STEPS = [
  "fixture_synthetic",
  "generate",
  "run_official_program",
  "import_result",
  "vault_evidence",
  "human_review",
  "matrix_cell",
] as HomologationPlaybook["steps"];

export const HOMOLOGATION_PLAYBOOKS: HomologationPlaybook[] = [
  {
    id: "pb_efd_icms_ipi_pva",
    obligationId: "efd-icms-ipi",
    program: "pva_efd_icms_ipi",
    title: "EFD ICMS/IPI ↔ PVA",
    steps: STEPS,
    notes: [
      "Não embutir PVA; registrar contentHash + versão + status",
      "homologationGrade via isHomologationGradePvaRun",
    ],
  },
  {
    id: "pb_efd_contrib_pge",
    obligationId: "efd-contribuicoes",
    program: "pge_efd_contribuicoes",
    title: "EFD-Contribuições ↔ PGE",
    steps: STEPS,
    notes: ["Domínio + Bloco M; isHomologationGradePgeRun"],
  },
  {
    id: "pb_ecd",
    obligationId: "ecd",
    program: "programa_ecd",
    title: "ECD ↔ Programa ECD",
    steps: STEPS,
    notes: ["Ledger oficial sem DEMO"],
  },
  {
    id: "pb_ecf",
    obligationId: "ecf",
    program: "programa_ecf",
    title: "ECF ↔ Programa ECF",
    steps: STEPS,
    notes: ["IRPJ flag off até evidência; isHomologationGradeEcfRun"],
  },
  {
    id: "pb_reinf",
    obligationId: "reinf",
    program: "efd_reinf_ambiente",
    title: "Reinf ↔ ambiente RFB",
    steps: STEPS,
    notes: ["FEATURE_REINF_SUBMIT off; assinatura só agente local"],
  },
];

export function getPlaybook(obligationId: string): HomologationPlaybook | undefined {
  return HOMOLOGATION_PLAYBOOKS.find((p) => p.obligationId === obligationId);
}
