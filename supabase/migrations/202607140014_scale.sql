-- Scale Fase 13 — drills, metering, mass campaigns; browser uses IndexedDB xfi_scale_v1
create table if not exists scale_dr_drills (
  id text primary key,
  region_id text not null,
  environment text not null,
  status text not null,
  executed_at timestamptz,
  notes text not null default '',
  counts_as_evidence boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists scale_meter_samples (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  at timestamptz not null default now(),
  generations int not null default 0,
  api_calls int not null default 0,
  evidence_storage_mb numeric not null default 0
);

create table if not exists scale_workspace_plans (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  plan_id text not null default 'free',
  updated_at timestamptz not null default now()
);

create table if not exists scale_mass_campaigns (
  id text primary key,
  tenant_id text not null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  obligation_id text not null,
  target_ufs_json jsonb not null default '[]'::jsonb,
  target_regime text,
  listing_ids_json jsonb not null default '[]'::jsonb,
  scenario_ids_json jsonb not null default '[]'::jsonb,
  status text not null default 'planned',
  relab_queue_json jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scale_meter_ws on scale_meter_samples(workspace_id, at);
create index if not exists idx_scale_mass_ws on scale_mass_campaigns(workspace_id, status);

alter table scale_dr_drills enable row level security;
alter table scale_meter_samples enable row level security;
alter table scale_workspace_plans enable row level security;
alter table scale_mass_campaigns enable row level security;

drop policy if exists scale_drills_auth on scale_dr_drills;
create policy scale_drills_auth on scale_dr_drills
  for all using (auth.role() = 'authenticated');

drop policy if exists scale_meter_member on scale_meter_samples;
create policy scale_meter_member on scale_meter_samples
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists scale_plans_member on scale_workspace_plans;
create policy scale_plans_member on scale_workspace_plans
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists scale_mass_member on scale_mass_campaigns;
create policy scale_mass_member on scale_mass_campaigns
  for all using (public.is_workspace_member(workspace_id));
