-- Compliance Fase 15 — privacy requests; browser uses IndexedDB xfi_compliance_v1
create table if not exists compliance_privacy_requests (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null check (type in ('export', 'erase')),
  status text not null default 'received',
  requester_id text not null,
  notes text,
  cloud_backup_out_of_scope boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create table if not exists compliance_prefs (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  locale text not null default 'pt-BR',
  updated_at timestamptz not null default now()
);

create index if not exists idx_privacy_ws on compliance_privacy_requests(workspace_id, status);

alter table compliance_privacy_requests enable row level security;
alter table compliance_prefs enable row level security;

drop policy if exists privacy_member on compliance_privacy_requests;
create policy privacy_member on compliance_privacy_requests
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists prefs_member on compliance_prefs;
create policy prefs_member on compliance_prefs
  for all using (public.is_workspace_member(workspace_id));
