/**
 * PVA validation workflow — import official PVA report results.
 * Does not automate or redistribute the PVA.
 */

export interface PvaValidationImport {
  generationId: string;
  pvaVersion: string;
  resultStatus: "ok" | "errors" | "warnings" | "unknown";
  issues: Array<{
    code?: string;
    message: string;
    recordType?: string;
    linkedGenerationIssueId?: string;
  }>;
  reportStoragePath?: string;
  notes?: string;
}

export function mapPvaIssuesToInternal(input: PvaValidationImport) {
  return {
    importedAt: new Date().toISOString(),
    ...input,
    disclaimer:
      "Resultado conforme relatório informado pelo usuário a partir do PVA oficial. O sistema não executa o PVA.",
  };
}
