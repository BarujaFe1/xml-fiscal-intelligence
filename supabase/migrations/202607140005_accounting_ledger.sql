-- Accounting ledger (Fase 4 ECD) — cloud mirror; browser uses IndexedDB xfi_ledger_v1
create table if not exists chart_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  code text not null,
  name text not null,
  level int not null default 1,
  nature text not null,
  kind text not null default 'analytic',
  parent_code text,
  referential_code text,
  cost_center text,
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, company_id, code)
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  batch_label text not null,
  entry_date date not null,
  status text not null default 'draft',
  origin text not null default 'manual',
  origin_ref text,
  idempotency_key text,
  content_hash text,
  approved_by text,
  approved_at timestamptz,
  lines_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists idx_chart_accounts_ws on chart_accounts(workspace_id, company_id);
create index if not exists idx_journal_entries_ws on journal_entries(workspace_id, company_id, entry_date);

alter table chart_accounts enable row level security;
alter table journal_entries enable row level security;

drop policy if exists chart_accounts_member on chart_accounts;
create policy chart_accounts_member on chart_accounts
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists journal_entries_member on journal_entries;
create policy journal_entries_member on journal_entries
  for all using (public.is_workspace_member(workspace_id));
