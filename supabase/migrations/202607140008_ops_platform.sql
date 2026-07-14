-- Ops platform (Fase 7) — cloud mirror; browser uses IndexedDB xfi_ops_v1
create table if not exists ops_closing_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  period_key text not null,
  obligation_id text not null,
  title text not null,
  status text not null default 'open',
  preparer_id text,
  approver_id text,
  generation_id text,
  audit_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ops_generations (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null,
  obligation_id text not null,
  period_key text not null,
  version int not null,
  rectifies_id text,
  content_hash text not null,
  layout_version text not null,
  content_preview text,
  locked boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists ops_evidence (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  generation_id text,
  obligation_id text not null,
  program text not null,
  program_version text not null,
  content_hash text not null,
  result_status text not null,
  responsible text,
  storage_ref text,
  notes text,
  imported_at timestamptz not null default now()
);

create table if not exists ops_notification_prefs (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  channels_json jsonb not null default '["internal"]'::jsonb,
  max_per_hour int not null default 30,
  updated_at timestamptz not null default now()
);

create table if not exists ops_sod_policies (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  require_distinct_approver boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_ops_tasks_ws on ops_closing_tasks(workspace_id, period_key);
create index if not exists idx_ops_gens_ws on ops_generations(workspace_id, obligation_id);
create index if not exists idx_ops_ev_ws on ops_evidence(workspace_id, content_hash);

alter table ops_closing_tasks enable row level security;
alter table ops_generations enable row level security;
alter table ops_evidence enable row level security;
alter table ops_notification_prefs enable row level security;
alter table ops_sod_policies enable row level security;

drop policy if exists ops_tasks_member on ops_closing_tasks;
create policy ops_tasks_member on ops_closing_tasks
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists ops_gens_member on ops_generations;
create policy ops_gens_member on ops_generations
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists ops_ev_member on ops_evidence;
create policy ops_ev_member on ops_evidence
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists ops_prefs_member on ops_notification_prefs;
create policy ops_prefs_member on ops_notification_prefs
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists ops_sod_member on ops_sod_policies;
create policy ops_sod_member on ops_sod_policies
  for all using (public.is_workspace_member(workspace_id));
