-- SaaS foundation: identity, tenancy, companies, establishments
-- Prerequisites: schema.sql + schema-enterprise.sql (companies)

alter table workspace_members drop constraint if exists workspace_members_role_check;
alter table workspace_members
  add constraint workspace_members_role_check
  check (role in (
    'owner','admin','accountant','fiscal_analyst','operator','viewer','billing_manager','support_readonly','member'
  ));

alter table profiles enable row level security;

drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self on profiles
  for select using (id = auth.uid());

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

drop policy if exists workspaces_insert on workspaces;
create policy workspaces_insert on workspaces
  for insert with check (true);

drop policy if exists workspaces_update on workspaces;
create policy workspaces_update on workspaces
  for update using (public.is_workspace_member(id));

drop policy if exists workspace_members_select on workspace_members;
create policy workspace_members_select on workspace_members
  for select using (public.is_workspace_member(workspace_id) or user_id = auth.uid());

drop policy if exists workspace_members_insert on workspace_members;
create policy workspace_members_insert on workspace_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null,
  token_hash text not null,
  invited_by uuid references profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table workspace_invites enable row level security;

create table if not exists establishments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  document text not null,
  ie text,
  name text,
  fantasy_name text,
  city text,
  uf text not null,
  cod_mun text,
  address_json jsonb default '{}'::jsonb,
  ind_perfil text check (ind_perfil in ('A','B','C')),
  ind_ativ text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table establishments enable row level security;
drop policy if exists establishments_all on establishments;
create policy establishments_all on establishments
  for all using (public.is_workspace_member(workspace_id));

create table if not exists tax_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  layout_preference text,
  notes text,
  settings_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table tax_profiles enable row level security;
drop policy if exists tax_profiles_all on tax_profiles;
create policy tax_profiles_all on tax_profiles
  for all using (public.is_workspace_member(workspace_id));

alter table if exists companies enable row level security;
drop policy if exists companies_all on companies;
create policy companies_all on companies
  for all using (public.is_workspace_member(workspace_id));

alter table if exists fiscal_documents enable row level security;
drop policy if exists fiscal_documents_all on fiscal_documents;
create policy fiscal_documents_all on fiscal_documents
  for all using (public.is_workspace_member(workspace_id));

alter table if exists audit_findings enable row level security;
drop policy if exists audit_findings_all on audit_findings;
create policy audit_findings_all on audit_findings
  for all using (public.is_workspace_member(workspace_id));
