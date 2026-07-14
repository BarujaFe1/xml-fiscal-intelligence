/**
 * Compliance / i18n / jurisdiction prep — Fase 15.
 * Sem selo SOC2 inventado · sem engines fiscais estrangeiros.
 */

export type CompliancePackVersion = {
  major: number;
  minor: number;
  patch: number;
  label: string;
};

export type CompliancePackSection = {
  id: string;
  title: string;
  markdown: string;
};

export type CompliancePack = {
  version: CompliancePackVersion;
  generatedAt: string;
  sections: CompliancePackSection[];
  /** Fingerprint de conteúdo — não é assinatura digital nem selo SOC2 */
  contentHash: string;
  soc2Certified: false;
  iso27001Certified: false;
  disclaimer: string;
};

export type AuditChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  evidenceRef?: string;
};

export type DataPurpose =
  | "xml_import"
  | "obligation_generation"
  | "lab_evidence"
  | "partner_share"
  | "billing_metering"
  | "telemetry_ops"
  | "audit_trail";

export type DataMapEntry = {
  purpose: DataPurpose;
  categories: string[];
  retentionClass: string;
  lawfulBasisHint: string;
  sharedWithPartners: boolean;
  notes: string[];
};

export type PrivacyRequestType = "export" | "erase";

export type PrivacyRequestStatus =
  | "received"
  | "in_review"
  | "fulfilled_partial"
  | "fulfilled"
  | "rejected"
  | "cancelled";

export type PrivacyRequest = {
  id: string;
  workspaceId: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requesterId: string;
  notes?: string;
  /** Sempre true — cloud backups não são auto-apagados */
  cloudBackupOutOfScope: true;
  createdAt: string;
  updatedAt: string;
  fulfilledAt?: string;
};

export type LocaleCode = "pt-BR" | "en";

export type JurisdictionId = "BR";

export type JurisdictionPack = {
  id: JurisdictionId;
  title: string;
  officialProgramsNoted: string[];
  /** Explicitamente fora */
  outOfScope: string[];
  maturityNote: string;
};

export type ComplianceMaturity = "development" | "internal_beta" | "official_validator_beta";
