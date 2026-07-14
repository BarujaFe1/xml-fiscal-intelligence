-- Reinf event engine (Fase 3) — cloud mirror optional; local IDB remains primary in browser.
create table if not exists reinf_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  period_key text not null,
  environment text not null default 'restricted',
  status text not null default 'draft',
  event_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reinf_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text,
  establishment_id text,
  event_code text not null,
  catalog_version text not null,
  period_key text not null,
  status text not null default 'draft',
  content_hash text not null,
  signed_hash text,
  batch_id uuid references reinf_batches(id) on delete set null,
  protocolo text,
  recibo text,
  mensagem text,
  environment text not null default 'restricted',
  idempotency_key text not null,
  storage_path_unsigned text,
  storage_path_signed text,
  payload_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists idx_reinf_events_ws_period on reinf_events(workspace_id, period_key);
create index if not exists idx_reinf_events_status on reinf_events(status);

alter table reinf_batches enable row level security;
alter table reinf_events enable row level security;

drop policy if exists reinf_batches_member on reinf_batches;
create policy reinf_batches_member on reinf_batches
  for all using (public.is_workspace_member(workspace_id));

drop policy if exists reinf_events_member on reinf_events;
create policy reinf_events_member on reinf_events
  for all using (public.is_workspace_member(workspace_id));
