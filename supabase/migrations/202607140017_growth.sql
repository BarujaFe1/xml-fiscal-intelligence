-- Growth Fase 16 — public marketplace; browser uses IndexedDB xfi_growth_v1
create table if not exists growth_public_listings (
  id text primary key,
  source_listing_id text not null,
  source_tenant_id text not null,
  title text not null,
  obligation_id text not null,
  uf text,
  regime text,
  layout_version text not null,
  program text not null,
  period_key_pattern text not null,
  golden_pack_version text not null,
  cell_maturity_claim text not null,
  content_fingerprint text,
  moderation text not null default 'pending_review',
  abuse_flags_json jsonb not null default '[]'::jsonb,
  compliance_pack_hash_ref text,
  published_at timestamptz,
  moderated_at timestamptz,
  moderator_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth_mkt_rates (
  tenant_id text primary key,
  publishes_this_hour int not null default 0,
  imports_this_hour int not null default 0,
  hour_bucket text not null,
  max_publishes_per_hour int not null default 10,
  max_imports_per_hour int not null default 30
);

create index if not exists idx_pub_mod on growth_public_listings(moderation, obligation_id);

alter table growth_public_listings enable row level security;
alter table growth_mkt_rates enable row level security;

drop policy if exists growth_pub_auth on growth_public_listings;
create policy growth_pub_auth on growth_public_listings
  for all using (auth.role() = 'authenticated');

drop policy if exists growth_rates_auth on growth_mkt_rates;
create policy growth_rates_auth on growth_mkt_rates
  for all using (auth.role() = 'authenticated');
