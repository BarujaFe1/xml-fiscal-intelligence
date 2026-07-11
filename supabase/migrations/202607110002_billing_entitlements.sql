-- Billing, entitlements, usage

create table if not exists billing_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  email text,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists billing_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean default true
);

create table if not exists billing_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references billing_products(id) on delete cascade,
  provider_price_id text,
  interval text check (interval in ('month','year')),
  currency text default 'brl',
  unit_amount_cents int,
  active boolean default true
);

create table if not exists plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null,
  version int not null,
  entitlements_json jsonb not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  unique (plan_code, version)
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null default 'stripe',
  provider_subscription_id text,
  plan_code text,
  plan_version_id uuid references plan_versions(id),
  status text not null default 'none',
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_json jsonb,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists usage_counters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  period_yyyymm text not null,
  metric text not null,
  value bigint not null default 0,
  unique (workspace_id, period_yyyymm, metric)
);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  metric text not null,
  delta bigint not null default 1,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

alter table billing_customers enable row level security;
alter table subscriptions enable row level security;
alter table usage_counters enable row level security;
alter table usage_events enable row level security;

drop policy if exists billing_customers_all on billing_customers;
create policy billing_customers_all on billing_customers
  for all using (public.is_workspace_member(workspace_id));
drop policy if exists subscriptions_all on subscriptions;
create policy subscriptions_all on subscriptions
  for all using (public.is_workspace_member(workspace_id));
drop policy if exists usage_counters_all on usage_counters;
create policy usage_counters_all on usage_counters
  for all using (public.is_workspace_member(workspace_id));
drop policy if exists usage_events_all on usage_events;
create policy usage_events_all on usage_events
  for all using (public.is_workspace_member(workspace_id));
