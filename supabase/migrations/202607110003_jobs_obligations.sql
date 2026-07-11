-- Jobs, obligation generations, rules registry (core)

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  batch_id uuid,
  type text not null,
  status text not null default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 5,
  idempotency_key text not null,
  payload_json jsonb not null default '{}'::jsonb,
  last_error text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index if not exists idx_import_jobs_status on import_jobs(status, created_at);

create table if not exists official_sources (
  id text primary key,
  title text not null,
  url text not null,
  version_label text,
  published_at date,
  effective_from date,
  effective_to date,
  layout_version text,
  pva_version text,
  document_hash text,
  last_verified_at date,
  notes text
);

create table if not exists rule_set_versions (
  id uuid primary key default gen_random_uuid(),
  obligation text not null,
  layout_version text not null,
  source_id text references official_sources(id),
  effective_from date not null,
  effective_to date,
  spec_json jsonb not null default '{}'::jsonb,
  unique (obligation, layout_version, effective_from)
);

create table if not exists obligation_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  establishment_id uuid,
  obligation text not null,
  layout_version text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft',
  content_hash text,
  storage_path text,
  manifest_json jsonb,
  validation_json jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists generation_lineage (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references obligation_generations(id) on delete cascade,
  record_type text not null,
  field_name text not null,
  value_text text,
  source_type text not null,
  source_ref text,
  xml_path text,
  rule_id text,
  transformation text
);

create table if not exists pva_validation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  generation_id uuid references obligation_generations(id) on delete cascade,
  pva_version text,
  imported_at timestamptz not null default now(),
  result_status text,
  report_storage_path text,
  notes text
);

alter table import_jobs enable row level security;
alter table obligation_generations enable row level security;
alter table pva_validation_runs enable row level security;

drop policy if exists import_jobs_all on import_jobs;
create policy import_jobs_all on import_jobs
  for all using (public.is_workspace_member(workspace_id));
drop policy if exists obligation_generations_all on obligation_generations;
create policy obligation_generations_all on obligation_generations
  for all using (public.is_workspace_member(workspace_id));
drop policy if exists pva_validation_runs_all on pva_validation_runs;
create policy pva_validation_runs_all on pva_validation_runs
  for all using (public.is_workspace_member(workspace_id));
