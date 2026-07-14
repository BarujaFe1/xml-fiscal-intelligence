-- Governance (Fase 11) — roles, retention, campaigns; browser uses IndexedDB xfi_governance_v1
create table if not exists governance_role_bindings (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner', 'preparer', 'approver', 'auditor')),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id, role)
);

create table if not exists governance_retention_policies (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  version int not null,
  class text not null,
  retain_days int not null,
  notes text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists governance_campaigns (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  obligation_id text not null,
  target_uf text,
  target_regime text,
  status text not null default 'planned',
  scenario_ids_json jsonb not null default '[]'::jsonb,
  revalidation_due_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gov_roles_ws on governance_role_bindings(workspace_id);
create index if not exists idx_gov_ret_ws on governance_retention_policies(workspace_id);
create index if not exists idx_gov_camp_ws on governance_campaigns(workspace_id, status);

alter table governance_role_bindings enable row level security;
alter table governance_retention_policies enable row level security;
alter table governance_campaigns enable row level security;

drop policy if exists gov_roles_member on governance_role_bindings;
create policy gov_roles_member on governance_role_bindings
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists gov_ret_member on governance_retention_policies;
create policy gov_ret_member on governance_retention_policies
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists gov_camp_member on governance_campaigns;
create policy gov_camp_member on governance_campaigns
  for all using (public.is_workspace_member(workspace_id));
