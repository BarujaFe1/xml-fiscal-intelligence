/**
 * Master data hub — single cadastro for all obligations.
 * Concrete CRUDs reuse local-cadastro; other entities are typed stubs.
 */

import {
  listCompanies,
  saveCompany,
  deleteCompany,
  listEstablishments,
  saveEstablishment,
  type LocalCompany,
  type LocalEstablishment,
} from "@/lib/store/local-cadastro";

export type MasterEntityKind =
  | "company"
  | "establishment"
  | "accountant"
  | "signatory"
  | "participant"
  | "product"
  | "service"
  | "unit"
  | "ncm"
  | "cfop"
  | "cst"
  | "account"
  | "cost_center"
  | "benefit"
  | "other";

export type MasterEntityStatus = "live" | "foundation" | "planned";

export const MASTER_ENTITY_CATALOG: Array<{
  kind: MasterEntityKind;
  label: string;
  status: MasterEntityStatus;
  notes: string;
}> = [
  {
    kind: "company",
    label: "Empresas",
    status: "live",
    notes: "IndexedDB local-cadastro + sync cloud opcional",
  },
  {
    kind: "establishment",
    label: "Estabelecimentos",
    status: "live",
    notes: "Vinculados à empresa no cadastro local",
  },
  {
    kind: "accountant",
    label: "Contabilistas",
    status: "foundation",
    notes: "Campos no LocalCompany por enquanto — extrair entidade própria depois",
  },
  {
    kind: "signatory",
    label: "Signatários",
    status: "planned",
    notes: "ECD/ECF/Reinf — sem CRUD dedicado",
  },
  {
    kind: "participant",
    label: "Participantes",
    status: "foundation",
    notes: "Derivados de XML (0150) — cadastro central WIP",
  },
  {
    kind: "product",
    label: "Produtos",
    status: "foundation",
    notes: "Itens de lote — sem merge cross-batch ainda",
  },
  {
    kind: "service",
    label: "Serviços",
    status: "planned",
    notes: "Reinf / NFS-e",
  },
  {
    kind: "unit",
    label: "Unidades",
    status: "foundation",
    notes: "0190 a partir do lote",
  },
  {
    kind: "ncm",
    label: "NCM",
    status: "planned",
    notes: "Tabela oficial versionada — não hardcode",
  },
  {
    kind: "cfop",
    label: "CFOP",
    status: "planned",
    notes: "Tabela oficial versionada",
  },
  {
    kind: "cst",
    label: "CST / CSOSN",
    status: "planned",
    notes: "Tabelas oficiais",
  },
  {
    kind: "account",
    label: "Contas contábeis",
    status: "planned",
    notes: "Motor ECD",
  },
  {
    kind: "cost_center",
    label: "Centros de custo",
    status: "planned",
    notes: "ECD / ECF",
  },
  {
    kind: "benefit",
    label: "Benefícios / ajustes",
    status: "planned",
    notes: "UF / Contribuições",
  },
  {
    kind: "other",
    label: "Reinf: obra / tomador / prestador / beneficiário",
    status: "foundation",
    notes: "Fase 3 — entidades tipadas no motor; CRUD dedicado ainda parcial",
  },
  {
    kind: "other",
    label: "Demais (NBS, processos, códigos receita…)",
    status: "planned",
    notes: "Ver docs/MASTER_DATA_HUB.md",
  },
];

export async function listMasterCompanies(): Promise<LocalCompany[]> {
  return listCompanies();
}

export async function saveMasterCompany(c: LocalCompany): Promise<LocalCompany> {
  await saveCompany(c);
  return c;
}

export async function removeMasterCompany(id: string): Promise<void> {
  return deleteCompany(id);
}

export async function listMasterEstablishments(companyId: string): Promise<LocalEstablishment[]> {
  const all = await listEstablishments();
  return all.filter((e) => e.companyId === companyId);
}

export async function saveMasterEstablishment(e: LocalEstablishment): Promise<LocalEstablishment> {
  await saveEstablishment(e);
  return e;
}
