-- RTC domain (Fase 8) — cloud mirror; browser uses IndexedDB xfi_rtc_v1
create table if not exists rtc_facts (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  period_key text not null,
  split text not null,
  document_ref text,
  operation_label text,
  base_amount text,
  rate_explicit text,
  tax_kind text not null,
  tax_amount_explicit text,
  uf text,
  municipality_code text,
  credit_explicit boolean not null default false,
  credit_amount text,
  origin text not null default 'manual',
  source_id text not null,
  lineage_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rtc_facts_ws on rtc_facts(workspace_id, company_id, period_key);

alter table rtc_facts enable row level security;

drop policy if exists rtc_facts_member on rtc_facts;
create policy rtc_facts_member on rtc_facts
  for all using (public.is_workspace_member(workspace_id));
