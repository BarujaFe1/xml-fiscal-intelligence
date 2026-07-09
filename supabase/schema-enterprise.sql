-- Enterprise extensions for XML Fiscal Intelligence
-- Apply after supabase/schema.sql. Additive / idempotent where possible.

alter table if exists workspaces
  add column if not exists tax_id text,
  add column if not exists updated_at timestamptz default now();

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document text not null,
  document_type text not null default 'CNPJ',
  name text,
  fantasy_name text,
  ie text,
  city text,
  uf text,
  role_tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references companies(id),
  name text not null,
  source_type text default 'zip',
  period_start date,
  period_end date,
  status text not null default 'pending',
  total_files int default 0,
  total_xml int default 0,
  new_documents int default 0,
  duplicate_documents int default 0,
  failed_documents int default 0,
  processing_started_at timestamptz,
  processing_finished_at timestamptz,
  health_score int default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  batch_id uuid,
  document_type text not null,
  document_subtype text,
  access_key text,
  model text,
  series text,
  number text,
  issue_date timestamptz,
  operation_date timestamptz,
  emitter_id uuid references companies(id),
  receiver_id uuid references companies(id),
  transporter_id uuid references companies(id),
  total_value numeric(18,2),
  products_value numeric(18,2),
  services_value numeric(18,2),
  freight_value numeric(18,2),
  discount_value numeric(18,2),
  icms_value numeric(18,2),
  ipi_value numeric(18,2),
  pis_value numeric(18,2),
  cofins_value numeric(18,2),
  iss_value numeric(18,2),
  status text,
  protocol text,
  nature_operation text,
  cfop_main text,
  operation_classification text,
  schema_version text,
  xml_hash text,
  xml_storage_path text,
  pdf_storage_path text,
  raw_json jsonb,
  flattened_json jsonb,
  version int default 1,
  is_duplicate boolean default false,
  duplicate_of_id uuid,
  quality_score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fiscal_documents_access_key on fiscal_documents(access_key);
create index if not exists idx_fiscal_documents_type on fiscal_documents(document_type);
create index if not exists idx_fiscal_documents_issue_date on fiscal_documents(issue_date);
create index if not exists idx_fiscal_documents_xml_hash on fiscal_documents(xml_hash);
create index if not exists idx_fiscal_documents_batch on fiscal_documents(batch_id);
create index if not exists idx_fiscal_documents_cfop on fiscal_documents(cfop_main);
create index if not exists idx_fiscal_documents_raw_gin on fiscal_documents using gin (raw_json);
create index if not exists idx_fiscal_documents_flat_gin on fiscal_documents using gin (flattened_json);

create table if not exists audit_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  batch_id uuid,
  document_id uuid,
  item_id uuid,
  severity text not null,
  category text not null,
  code text not null,
  title text not null,
  description text,
  evidence_json jsonb,
  recommendation text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists document_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_document_id uuid not null,
  target_document_id uuid not null,
  relationship_type text not null,
  confidence_score numeric(5,4),
  evidence_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid,
  name text not null,
  query_text text,
  filters_json jsonb,
  is_favorite boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists custom_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  rule_json jsonb not null,
  severity text,
  enabled boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists import_logs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  file_id uuid,
  level text not null,
  step text,
  message text not null,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists user_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);
