export type CompanyDirectoryEntry = {
  name: string;
  /** Only digits — 14 (CNPJ) or 11 (CPF). */
  document: string;
  kind: "cnpj" | "cpf";
};

export type CompanyDirectoryParseResult = {
  source: "sieg-clients" | "key-value" | "mixed" | "unknown";
  entries: CompanyDirectoryEntry[];
  warnings: string[];
};
