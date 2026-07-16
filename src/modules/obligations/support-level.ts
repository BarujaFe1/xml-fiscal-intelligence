/**
 * Registry de suporte por obrigação × UF.
 * Substitui a heurística "emptyUfPlugin" como fonte única de verdade sobre
 * o que cada obrigação fiscal suporta, por estado.
 */

export type ObligationSupportLevel = "supported" | "partial" | "unsupported" | "planned";

export type ObligationSupportEntry = {
  obligationId: string;
  /** undefined = todas as UFs (fallback global). */
  uf?: string;
  level: ObligationSupportLevel;
  notes?: string;
  /** Catálogo de fonte oficial (quando houver). */
  sourceId?: string;
};

const REGISTRY: ObligationSupportEntry[] = [
  {
    obligationId: "efd-icms-ipi",
    level: "supported",
    notes: "Leiaute 020 (NT 2025.001) validado offline — 301/301 arquivos, 0 erros (PR3).",
    sourceId: "internal:pr3",
  },
  {
    obligationId: "efd-contribuicoes",
    level: "partial",
    notes: "Engine de apuração em desenvolvimento (ledger EFD-Contribuições).",
  },
  {
    obligationId: "reinf",
    level: "partial",
    notes: "Event engine presente; apuração de cruzamento WIP.",
  },
  {
    obligationId: "ecd",
    level: "planned",
    notes: "Escrituração Contábil Digital — fora do escopo inicial.",
  },
  {
    obligationId: "ecf",
    level: "planned",
    notes: "Escrituração Contábil Fiscal — engine presente, cadastro WIP.",
  },
];

export function getObligationSupport(
  obligationId: string,
  uf?: string,
): ObligationSupportEntry {
  const specific = REGISTRY.find(
    (e) => e.obligationId === obligationId && (uf ? e.uf === uf : e.uf === undefined),
  );
  if (specific) return specific;
  const global = REGISTRY.find((e) => e.obligationId === obligationId && e.uf === undefined);
  if (global) return global;
  return {
    obligationId,
    uf,
    level: "planned",
    notes: "Não mapeado no registry de suporte.",
  };
}

export function listObligationSupport(): ObligationSupportEntry[] {
  return [...REGISTRY];
}

export function isObligationSupported(obligationId: string, uf?: string): boolean {
  return getObligationSupport(obligationId, uf).level === "supported";
}
