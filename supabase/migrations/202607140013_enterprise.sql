-- Enterprise Fase 12 — marketplace listings + legal status; browser uses IndexedDB xfi_enterprise_v1
create table if not exists enterprise_marketplace_listings (
  id text primary key,
  tenant_id text not null,
  source_workspace_id text not null,
  title text not null,
  obligation_id text not null,
  uf text,
  regime text,
  period_key_pattern text not null,
  layout_version text not null,
  program text not null,
  golden_pack_version text not null,
  status text not null default 'draft',
  content_fingerprint text,
  cell_maturity_claim text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists enterprise_legal_status (
  tenant_id text primary key,
  dpa text not null default 'template_only',
  sla text not null default 'draft',
  soc2_certified boolean not null default false,
  iso27001_certified boolean not null default false,
  notes_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_mkt_tenant on enterprise_marketplace_listings(tenant_id, status);

alter table enterprise_marketplace_listings enable row level security;
alter table enterprise_legal_status enable row level security;

-- Espelho cloud; app local usa IndexedDB. RLS: autenticados (tenant filtrado na app).
drop policy if exists mkt_listings_auth on enterprise_marketplace_listings;
create policy mkt_listings_auth on enterprise_marketplace_listings
  for all using (auth.role() = 'authenticated');

drop policy if exists legal_auth on enterprise_legal_status;
create policy legal_auth on enterprise_legal_status
  for all using (auth.role() = 'authenticated');