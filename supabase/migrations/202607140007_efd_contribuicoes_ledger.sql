-- EFD-Contribuições domain (Fase 6) — cloud mirror; browser uses IndexedDB xfi_contrib_v1
create table if not exists contrib_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  period_key text not null,
  kind text not null,
  amount text not null,
  base_amount text,
  cst_pis text,
  cst_cofins text,
  cfop text,
  history text,
  document_ref text,
  origin text not null default 'manual',
  credit_explicit boolean not null default false,
  rateio_key text,
  mode text not null default 'current_fact_generation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contrib_rateio (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  rateio_key text not null,
  label text not null,
  weight numeric not null,
  target_center text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contrib_entries_ws on contrib_entries(workspace_id, company_id, period_key);
create index if not exists idx_contrib_rateio_ws on contrib_rateio(workspace_id, company_id);

alter table contrib_entries enable row level security;
alter table contrib_rateio enable row level security;

drop policy if exists contrib_entries_member on contrib_entries;
create policy contrib_entries_member on contrib_entries
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists contrib_rateio_member on contrib_rateio;
create policy contrib_rateio_member on contrib_rateio
  for all using (public.is_workspace_member(workspace_id));
