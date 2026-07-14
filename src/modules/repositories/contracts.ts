/**
 * Repository contracts — React/UI must not talk to IndexedDB/Supabase directly.
 * Cloud (Postgres) is the SaaS source of truth; IndexedDB is cache/offline only.
 */

import type { Batch, BatchStore, DocumentSummary } from "@/types";
import type { LocalCompany, LocalEstablishment } from "@/lib/store/local-cadastro";
import type { EfdGenerationStatus } from "@/modules/obligations/efd-icms-ipi/status";

export type WorkspaceId = string;
export type CompanyId = string;
export type EstablishmentId = string;

export interface FiscalDocumentRepository {
  listByBatch(workspaceId: WorkspaceId, batchId: string): Promise<DocumentSummary[]>;
  getById(workspaceId: WorkspaceId, documentId: string): Promise<DocumentSummary | null>;
}

export interface BatchRepository {
  list(workspaceId: WorkspaceId): Promise<Batch[]>;
  getStore(workspaceId: WorkspaceId, batchId: string): Promise<BatchStore | null>;
  saveStore(workspaceId: WorkspaceId, store: BatchStore): Promise<void>;
  delete(workspaceId: WorkspaceId, batchId: string): Promise<void>;
}

export type ImportJobStatus =
  | "queued"
  | "validating"
  | "extracting"
  | "parsing"
  | "deduplicating"
  | "persisting"
  | "auditing"
  | "completed"
  | "partial"
  | "failed"
  | "canceled";

export interface ImportJob {
  id: string;
  workspaceId: WorkspaceId;
  status: ImportJobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface ImportJobRepository {
  create(job: Omit<ImportJob, "createdAt" | "updatedAt">): Promise<ImportJob>;
  updateStatus(id: string, status: ImportJobStatus, error?: string): Promise<void>;
  get(id: string): Promise<ImportJob | null>;
}

export interface CompanyRepository {
  list(workspaceId: WorkspaceId): Promise<LocalCompany[]>;
  upsert(workspaceId: WorkspaceId, company: LocalCompany): Promise<LocalCompany>;
  delete(workspaceId: WorkspaceId, companyId: CompanyId): Promise<void>;
}

export interface EstablishmentRepository {
  listByCompany(workspaceId: WorkspaceId, companyId: CompanyId): Promise<LocalEstablishment[]>;
  upsert(workspaceId: WorkspaceId, est: LocalEstablishment): Promise<LocalEstablishment>;
}

export interface EfdGenerationRecord {
  id: string;
  workspaceId: WorkspaceId;
  companyId: CompanyId;
  establishmentId: EstablishmentId;
  periodStart: string;
  periodEnd: string;
  status: EfdGenerationStatus;
  layoutVersion: string;
  guideVersion: string;
  contentHash?: string;
  storagePath?: string;
  createdAt: string;
  createdBy?: string;
}

export interface EfdGenerationRepository {
  create(rec: Omit<EfdGenerationRecord, "createdAt">): Promise<EfdGenerationRecord>;
  updateStatus(id: string, status: EfdGenerationStatus): Promise<void>;
  get(workspaceId: WorkspaceId, id: string): Promise<EfdGenerationRecord | null>;
  list(
    workspaceId: WorkspaceId,
    filter: { establishmentId?: EstablishmentId; periodStart?: string },
  ): Promise<EfdGenerationRecord[]>;
}

export interface StorageObjectRef {
  bucket: string;
  path: string;
}

export interface StorageProvider {
  /** Server-validated path under workspace/... */
  buildFiscalPath(parts: {
    workspaceId: string;
    companyId: string;
    establishmentId: string;
    period: string;
    kind: "zip" | "xml" | "efd-txt" | "manifest" | "pva-report" | "export";
    fileName: string;
  }): string;
  createSignedUploadUrl(ref: StorageObjectRef, expiresSec: number): Promise<{ url: string }>;
  createSignedDownloadUrl(ref: StorageObjectRef, expiresSec: number): Promise<{ url: string }>;
}
