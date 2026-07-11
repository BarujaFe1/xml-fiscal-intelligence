-- Regulatory governance tables (official sources versioning + fiscal rule sets)
-- Incremental; does not drop existing official_sources / rule_set_versions.

comment on table official_sources is
  'Catálogo de fontes oficiais (SPED, RFB, etc.). Hash/versão preenchidos após download verificado.';

create table if not exists official_source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references official_sources(id) on delete cascade,
  organ text,
  name text not null,
  url text not null,
  version_label text,
  published_at date,
  effective_from date,
  effective_to date,
  jurisdiction text default 'BR',
  affected_document text,
  document_hash text,
  consulted_at date not null default current_date,
  status text not null default 'watch'
    check (status in ('watch', 'active', 'superseded', 'withdrawn', 'pending_hash')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_official_source_versions_source
  on official_source_versions(source_id, effective_from);

create table if not exists fiscal_rule_sets (
  id text primary key,
  name text not null,
  domain text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists fiscal_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_set_id text not null references fiscal_rule_sets(id) on delete cascade,
  version_label text not null,
  source_version_id uuid references official_source_versions(id),
  effective_from date not null,
  effective_to date,
  jurisdiction text default 'BR',
  spec_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'superseded')),
  notes text,
  unique (rule_set_id, version_label, effective_from)
);

create table if not exists official_table_versions (
  id uuid primary key default gen_random_uuid(),
  table_code text not null,
  name text not null,
  uf text,
  version_label text,
  url text,
  published_at date,
  effective_from date,
  effective_to date,
  document_hash text,
  source_version_id uuid references official_source_versions(id),
  notes text
);
create unique index if not exists uq_official_table_versions
  on official_table_versions (
    table_code,
    coalesce(uf, ''),
    coalesce(version_label, ''),
    coalesce(effective_from, '1900-01-01'::date)
  );

create table if not exists schema_catalog (
  id text primary key,
  document_family text not null,
  name text not null,
  notes text
);

create table if not exists schema_versions (
  id uuid primary key default gen_random_uuid(),
  schema_id text not null references schema_catalog(id) on delete cascade,
  version_label text not null,
  namespace text,
  xsd_url text,
  effective_from date,
  effective_to date,
  document_hash text,
  status text not null default 'watch',
  notes text,
  unique (schema_id, version_label)
);

create table if not exists regulatory_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  published_at date,
  noticed_at date not null default current_date,
  impact text,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'applied', 'deferred')),
  notes text
);

insert into fiscal_rule_sets (id, name, domain, description) values
  ('efd-icms-ipi', 'EFD ICMS/IPI', 'obligation', 'Regras de leiaute e prontidão — não substitui PVA'),
  ('audit-core', 'Auditoria fiscal objetiva', 'audit', 'Regras determinísticas versionadas'),
  ('rtc-observe', 'RTC observação', 'rtc', 'Detecção de tags CBS/IBS/IS sem inventar alíquotas')
on conflict (id) do nothing;

insert into schema_catalog (id, document_family, name, notes) values
  ('nfe', 'NFe', 'NF-e / NFC-e', 'Schemas oficiais portal NF-e'),
  ('cte', 'CTe', 'CT-e', 'Schemas oficiais portal CT-e'),
  ('nfse', 'NFSe', 'NFS-e', 'Municipal / ABRASF best-effort')
on conflict (id) do nothing;

-- RLS: regulatory catalog is readable by authenticated; writes via service role only.
alter table official_source_versions enable row level security;
alter table fiscal_rule_sets enable row level security;
alter table fiscal_rule_versions enable row level security;
alter table official_table_versions enable row level security;
alter table schema_catalog enable row level security;
alter table schema_versions enable row level security;
alter table regulatory_updates enable row level security;

drop policy if exists official_source_versions_read on official_source_versions;
create policy official_source_versions_read on official_source_versions
  for select to authenticated using (true);

drop policy if exists fiscal_rule_sets_read on fiscal_rule_sets;
create policy fiscal_rule_sets_read on fiscal_rule_sets
  for select to authenticated using (true);

drop policy if exists fiscal_rule_versions_read on fiscal_rule_versions;
create policy fiscal_rule_versions_read on fiscal_rule_versions
  for select to authenticated using (true);

drop policy if exists official_table_versions_read on official_table_versions;
create policy official_table_versions_read on official_table_versions
  for select to authenticated using (true);

drop policy if exists schema_catalog_read on schema_catalog;
create policy schema_catalog_read on schema_catalog
  for select to authenticated using (true);

drop policy if exists schema_versions_read on schema_versions;
create policy schema_versions_read on schema_versions
  for select to authenticated using (true);

drop policy if exists regulatory_updates_read on regulatory_updates;
create policy regulatory_updates_read on regulatory_updates
  for select to authenticated using (true);
