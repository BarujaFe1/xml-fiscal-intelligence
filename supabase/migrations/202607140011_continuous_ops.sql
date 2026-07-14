-- Continuous ops (Fase 10) — NT inbox + quotas; browser uses IndexedDB xfi_continuous_ops_v1
create table if not exists continuous_nt_inbox (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_id text not null,
  title text not null,
  obligation_id text,
  status text not null default 'identified',
  impact_manifest_json jsonb not null default '[]'::jsonb,
  rule_set_activated boolean not null default false,
  draft_rule_set_code text,
  fixture_id text,
  reviewer_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists continuous_quota_policies (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  max_generations_per_hour int not null default 60,
  max_api_calls_per_hour int not null default 300,
  updated_at timestamptz not null default now()
);

create index if not exists idx_nt_inbox_ws on continuous_nt_inbox(workspace_id, status);

alter table continuous_nt_inbox enable row level security;
alter table continuous_quota_policies enable row level security;

drop policy if exists nt_inbox_member on continuous_nt_inbox;
create policy nt_inbox_member on continuous_nt_inbox
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists quota_member on continuous_quota_policies;
create policy quota_member on continuous_quota_policies
  for all using (public.is_workspace_member(workspace_id));
