-- Align obligation_generations status vocabulary with EfdGenerationStatus.
-- Avoid recreating pva_validation_runs (already in 202607110003).

alter table obligation_generations
  add column if not exists guide_version text,
  add column if not exists company_id uuid,
  add column if not exists generation_status text;

comment on column obligation_generations.generation_status is
  'draft|readiness_blocked|internally_validated|txt_generated|pva_validation_pending|pva_rejected|pva_validated|signed_externally|transmitted_externally|receipt_registered';

alter table pva_validation_runs
  add column if not exists report_text text;

-- Optional cloud companies mirror for cadastro local → SaaS
create table if not exists cloud_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  local_key text,
  name text not null,
  cnpj text,
  kind text check (kind is null or kind in ('cnpj','cpf')),
  ie text,
  uf text,
  cod_mun text,
  cep text,
  address text,
  address_number text,
  neighborhood text,
  source text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, cnpj)
);

alter table cloud_companies enable row level security;

drop policy if exists cloud_companies_member on cloud_companies;
create policy cloud_companies_member on cloud_companies
  for all using (public.is_workspace_member(workspace_id));

create index if not exists idx_cloud_companies_ws on cloud_companies(workspace_id);
