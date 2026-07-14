/**
 * Plataforma operacional — Fase 7: tipos transversais.
 */

import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { OfficialProgramId } from "@/modules/obligations/core/maturity";

export type SodPolicy = {
  workspaceId: string;
  /** Se true, preparador não pode aprovar a própria geração */
  requireDistinctApprover: boolean;
  updatedAt: string;
};

export type ClosingTaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";

export type ClosingTask = {
  id: string;
  workspaceId: string;
  companyId: string;
  periodKey: string;
  obligationId: ObligationId;
  title: string;
  status: ClosingTaskStatus;
  preparerId?: string;
  approverId?: string;
  generationId?: string;
  createdAt: string;
  updatedAt: string;
  audit: AuditDecision[];
};

export type AuditDecision = {
  at: string;
  actorId: string;
  action: "create" | "assign" | "submit" | "approve" | "reject" | "cancel";
  note?: string;
};

export type ImmutableGeneration = {
  id: string;
  workspaceId: string;
  companyId: string;
  obligationId: ObligationId;
  periodKey: string;
  version: number;
  /** Retificação aponta para geração anterior */
  rectifiesId?: string;
  contentHash: string;
  layoutVersion: string;
  /** Trecho ou fingerprint do conteúdo — não precisa do TXT completo no vault */
  contentPreview?: string;
  locked: boolean;
  createdBy?: string;
  createdAt: string;
};

export type EvidenceMeta = {
  id: string;
  workspaceId: string;
  generationId?: string;
  obligationId: ObligationId;
  program: OfficialProgramId;
  programVersion: string;
  contentHash: string;
  resultStatus: "ok" | "errors" | "warnings" | "unknown";
  responsible?: string;
  /** Path lógico no storage privado — nunca binário RFB no git */
  storageRef?: string;
  notes?: string;
  importedAt: string;
};

export type NotificationChannel = "internal" | "email" | "webhook";

export type NotificationPayload = {
  id: string;
  workspaceId: string;
  channel: NotificationChannel;
  title: string;
  /** Corpo já sanitizado (sem XML, CNPJ mascarado) */
  body: string;
  createdAt: string;
  delivered: boolean;
};

export type NotificationPrefs = {
  workspaceId: string;
  channels: NotificationChannel[];
  /** Máx. eventos por hora (rate limit lógico) */
  maxPerHour: number;
  updatedAt: string;
};

export type RegulatoryItemStatus = "identified" | "reviewed" | "published";

export type RegulatoryCatalogItem = {
  id: string;
  sourceId: string;
  title: string;
  obligationId?: ObligationId | "platform";
  status: RegulatoryItemStatus;
  /** Nunca auto-ativa rule_set */
  activatesRuleSet: false;
  notes?: string;
  updatedAt: string;
};

export type PlatformMaturity = "development" | "internal_beta";
