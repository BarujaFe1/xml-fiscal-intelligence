-- XML Fiscal Intelligence — Supabase / Postgres schema
-- Ready for production migration. MVP currently uses local filesystem store.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  cnpj_label text,
  month int check (month between 1 and 12),
  year int,
  uploaded_file_name text not null,
  status text not null default 'pending',
  total_files int not null default 0,
  total_xml int not null default 0,
  valid_xml int not null default 0,
  invalid_xml int not null default 0,
  nfe_count int not null default 0,
  cte_count int not null default 0,
  nfse_count int not null default 0,
  unknown_count int not null default 0,
  total_value numeric(18,2) not null default 0,
  health_score int not null default 0,
  quality_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  document_type text not null,
  schema_version text,
  file_name text not null,
  access_key text,
  number text,
  series text,
  model text,
  issue_date timestamptz,
  authorization_date timestamptz,
  emitter_doc text,
  emitter_name text,
  emitter_city text,
  emitter_uf text,
  receiver_doc text,
  receiver_name text,
  receiver_city text,
  receiver_uf text,
  service_city text,
  total_value numeric(18,2),
  products_value numeric(18,2),
  services_value numeric(18,2),
  freight_value numeric(18,2),
  discount_value numeric(18,2),
  tax_value numeric(18,2),
  status text,
  protocol text,
  raw_xml_path text,
  raw_json jsonb not null default '{}'::jsonb,
  flattened_json jsonb not null default '{}'::jsonb,
  parse_status text not null default 'ok',
  parse_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists document_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  document_type text not null,
  item_number int not null,
  code text,
  description text,
  ncm text,
  cfop text,
  unit text,
  quantity numeric(18,6),
  unit_value numeric(18,6),
  total_value numeric(18,2),
  discount_value numeric(18,2),
  tax_json jsonb not null default '{}'::jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  flattened_json jsonb not null default '{}'::jsonb
);

create table if not exists document_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  document_type text not null,
  path_original text not null,
  path_normalized text not null,
  field_name text not null,
  value_text text,
  value_number numeric,
  value_date timestamptz,
  inferred_type text not null,
  is_empty boolean not null default false
);

create table if not exists parse_errors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  file_name text not null,
  error_type text not null,
  error_message text not null,
  raw_snippet text,
  created_at timestamptz not null default now()
);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  export_type text not null,
  file_path text not null,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_batch on documents(batch_id);
create index if not exists idx_documents_access_key on documents(access_key);
create index if not exists idx_documents_emitter on documents(emitter_doc);
create index if not exists idx_documents_receiver on documents(receiver_doc);
create index if not exists idx_items_batch on document_items(batch_id);
create index if not exists idx_items_ncm on document_items(ncm);
create index if not exists idx_items_cfop on document_items(cfop);
create index if not exists idx_fields_batch on document_fields(batch_id);
create index if not exists idx_fields_path on document_fields(path_normalized);
create index if not exists idx_fields_value on document_fields using gin (to_tsvector('simple', coalesce(value_text, '')));

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table batches enable row level security;
alter table documents enable row level security;
alter table document_items enable row level security;
alter table document_fields enable row level security;
alter table parse_errors enable row level security;
alter table exports enable row level security;

create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create policy workspaces_select on workspaces for select using (public.is_workspace_member(id));
create policy batches_all on batches for all using (public.is_workspace_member(workspace_id));
create policy documents_all on documents for all using (public.is_workspace_member(workspace_id));
create policy items_all on document_items for all using (public.is_workspace_member(workspace_id));
create policy fields_all on document_fields for all using (public.is_workspace_member(workspace_id));
create policy errors_all on parse_errors for all using (public.is_workspace_member(workspace_id));
create policy exports_all on exports for all using (public.is_workspace_member(workspace_id));
