-- Homologation scenarios (Fase 9) — cloud mirror; browser uses IndexedDB xfi_homologation_v1
create table if not exists homologation_scenarios (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  obligation_id text not null,
  regime text,
  uf text,
  period_key text not null,
  layout_version text not null,
  program text not null,
  program_version text,
  content_hash text,
  generation_id text,
  evidence_id text,
  homologation_grade boolean not null default false,
  status text not null default 'draft',
  cell_maturity_target text not null,
  reviewer_id text,
  reviewed_at timestamptz,
  section28_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_homolog_scn_ws on homologation_scenarios(workspace_id, obligation_id);

alter table homologation_scenarios enable row level security;

drop policy if exists homolog_scn_member on homologation_scenarios;
create policy homolog_scn_member on homologation_scenarios
  for all using (public.is_workspace_member(workspace_id));
