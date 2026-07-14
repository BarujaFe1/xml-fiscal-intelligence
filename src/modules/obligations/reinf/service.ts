import { REINF_CATALOG } from "@/modules/obligations/reinf/catalog";
import type { ReinfCanonicalEvent, ReinfEnvironment } from "@/modules/obligations/reinf/lifecycle";
import {
  buildR1000Xml,
  buildR2010CandidateXml,
  buildR2099Xml,
  hashXml,
} from "@/modules/obligations/reinf/xml/builders";

export async function createDraftR1000(input: {
  workspaceId: string;
  companyId: string;
  cnpj: string;
  periodKey: string;
  contactName?: string;
  contactCpf?: string;
  environment?: ReinfEnvironment;
}): Promise<ReinfCanonicalEvent> {
  const xml = buildR1000Xml({
    cnpj: input.cnpj,
    periodKey: input.periodKey,
    contactName: input.contactName,
    contactCpf: input.contactCpf,
    tpAmb: 2,
  });
  const contentHash = await hashXml(xml);
  const now = new Date().toISOString();
  const id = `reinf_r1000_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    workspaceId: input.workspaceId,
    companyId: input.companyId,
    eventCode: "R-1000",
    catalogVersion: REINF_CATALOG.version,
    periodKey: input.periodKey,
    status: "draft",
    xmlUnsigned: xml,
    contentHash,
    environment: input.environment || "restricted",
    idempotencyKey: `R-1000:${input.cnpj}:${input.periodKey}:${contentHash.slice(0, 16)}`,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createDraftR2010Candidate(input: {
  workspaceId: string;
  companyId: string;
  cnpj: string;
  periodKey: string;
  tomadorDoc?: string;
  vlServico?: string;
  accessKey?: string;
}): Promise<ReinfCanonicalEvent> {
  const xml = buildR2010CandidateXml(input);
  const contentHash = await hashXml(xml);
  const now = new Date().toISOString();
  const id = `reinf_r2010_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    workspaceId: input.workspaceId,
    companyId: input.companyId,
    eventCode: "R-2010",
    catalogVersion: REINF_CATALOG.version,
    periodKey: input.periodKey,
    status: "draft",
    xmlUnsigned: xml,
    contentHash,
    environment: "restricted",
    idempotencyKey: `R-2010:${input.accessKey || id}:${contentHash.slice(0, 16)}`,
    sourceRefs: input.accessKey ? [input.accessKey] : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createDraftR2099(input: {
  workspaceId: string;
  companyId: string;
  cnpj: string;
  periodKey: string;
}): Promise<ReinfCanonicalEvent> {
  const xml = buildR2099Xml(input);
  const contentHash = await hashXml(xml);
  const now = new Date().toISOString();
  const id = `reinf_r2099_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    workspaceId: input.workspaceId,
    companyId: input.companyId,
    eventCode: "R-2099",
    catalogVersion: REINF_CATALOG.version,
    periodKey: input.periodKey,
    status: "draft",
    xmlUnsigned: xml,
    contentHash,
    environment: "restricted",
    idempotencyKey: `R-2099:${input.cnpj}:${input.periodKey}:${contentHash.slice(0, 16)}`,
    createdAt: now,
    updatedAt: now,
  };
}
