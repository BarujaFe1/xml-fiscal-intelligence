-- Assurance Fase 17 — readiness exports tracked; browser binder is ephemeral
create table if not exists assurance_binder_exports (
  id text primary key,
  workspace_id text not null,
  export_kind text not null default 'ci_binder',
  readiness_complete_or_waived boolean not null default false,
  open_items int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists assurance_grounded_asks (
  id text primary key,
  workspace_id text not null,
  question_hash text not null,
  obligation_id text,
  blocked boolean not null default false,
  source_ids_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assurance_binder_ws on assurance_binder_exports(workspace_id, created_at desc);
create index if not exists idx_assurance_asks_ws on assurance_grounded_asks(workspace_id, created_at desc);

alter table assurance_binder_exports enable row level security;
alter table assurance_grounded_asks enable row level security;

drop policy if exists assurance_binder_auth on assurance_binder_exports;
create policy assurance_binder_auth on assurance_binder_exports
  for all using (auth.role() = 'authenticated');

drop policy if exists assurance_asks_auth on assurance_grounded_asks;
create policy assurance_asks_auth on assurance_grounded_asks
  for all using (auth.role() = 'authenticated');
