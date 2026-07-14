-- ECF engine (Fase 5) — cloud mirror; browser uses IndexedDB xfi_ecf_v1
create table if not exists ecf_account_maps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  account_code text not null,
  referential_code text not null default '',
  suggested_referential_code text,
  suggestion_source text,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, company_id, account_code)
);

create table if not exists ecf_referential_tables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  table_code text not null,
  version_label text not null,
  effective_from date not null,
  effective_to date,
  entries_json jsonb not null default '[]'::jsonb,
  source_file_name text,
  content_hash text,
  imported_at timestamptz not null default now()
);

create table if not exists ecf_elalur (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  period_key text not null,
  version int not null default 1,
  part_a_json jsonb not null default '[]'::jsonb,
  part_b_json jsonb not null default '[]'::jsonb,
  content_hash text,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, company_id, period_key, version)
);

create table if not exists ecf_prior_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  period_key text not null,
  prior_json jsonb not null,
  imported_at timestamptz not null default now()
);

create index if not exists idx_ecf_maps_ws on ecf_account_maps(workspace_id, company_id);
create index if not exists idx_ecf_elalur_ws on ecf_elalur(workspace_id, company_id, period_key);
create index if not exists idx_ecf_refs_ws on ecf_referential_tables(workspace_id, table_code);

alter table ecf_account_maps enable row level security;
alter table ecf_referential_tables enable row level security;
alter table ecf_elalur enable row level security;
alter table ecf_prior_imports enable row level security;

drop policy if exists ecf_maps_member on ecf_account_maps;
create policy ecf_maps_member on ecf_account_maps
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists ecf_refs_member on ecf_referential_tables;
create policy ecf_refs_member on ecf_referential_tables
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists ecf_elalur_member on ecf_elalur;
create policy ecf_elalur_member on ecf_elalur
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists ecf_prior_member on ecf_prior_imports;
create policy ecf_prior_member on ecf_prior_imports
  for all using (public.is_workspace_member(workspace_id));
