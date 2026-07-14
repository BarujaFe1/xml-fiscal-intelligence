-- Ecosystem Fase 14 — SLO samples + partner invites; browser uses IndexedDB xfi_ecosystem_v1
create table if not exists ecosystem_slo_samples (
  id text primary key,
  slo_id text not null,
  at timestamptz not null default now(),
  success boolean not null,
  latency_ms int,
  detail text
);

create table if not exists ecosystem_partner_invites (
  id text primary key,
  tenant_id text not null,
  host_workspace_id text not null,
  partner_email text not null,
  role text not null default 'partner_auditor',
  status text not null default 'pending',
  white_label_preview boolean not null default false,
  accepted_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ecosystem_partner_links (
  id text primary key,
  tenant_id text not null,
  host_workspace_id text not null,
  partner_workspace_id text not null,
  partner_user_id text not null,
  mode text not null default 'read_prepare',
  created_at timestamptz not null default now()
);

create index if not exists idx_slo_id on ecosystem_slo_samples(slo_id, at);
create index if not exists idx_pinv_tenant on ecosystem_partner_invites(tenant_id, status);

alter table ecosystem_slo_samples enable row level security;
alter table ecosystem_partner_invites enable row level security;
alter table ecosystem_partner_links enable row level security;

drop policy if exists eco_slo_auth on ecosystem_slo_samples;
create policy eco_slo_auth on ecosystem_slo_samples
  for all using (auth.role() = 'authenticated');

drop policy if exists eco_pinv_auth on ecosystem_partner_invites;
create policy eco_pinv_auth on ecosystem_partner_invites
  for all using (auth.role() = 'authenticated');

drop policy if exists eco_plink_auth on ecosystem_partner_links;
create policy eco_plink_auth on ecosystem_partner_links
  for all using (auth.role() = 'authenticated');

-- Allow partner_auditor in governance bindings if table exists
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_name = 'governance_role_bindings'
  ) then
    alter table governance_role_bindings drop constraint if exists governance_role_bindings_role_check;
    alter table governance_role_bindings
      add constraint governance_role_bindings_role_check
      check (role in ('owner', 'preparer', 'approver', 'auditor', 'partner_auditor'));
  end if;
end $$;
