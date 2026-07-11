-- Close RLS gaps on enterprise / catalog tables (post advisor).
-- Tenant tables: is_workspace_member. Catalogs: authenticated read. Sensitive: no client policies (service_role only).

-- --- Tenant-scoped ---
alter table public.import_batches enable row level security;
drop policy if exists import_batches_all on public.import_batches;
create policy import_batches_all on public.import_batches
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.document_relationships enable row level security;
drop policy if exists document_relationships_all on public.document_relationships;
create policy document_relationships_all on public.document_relationships
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_all on public.saved_searches;
create policy saved_searches_all on public.saved_searches
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.custom_rules enable row level security;
drop policy if exists custom_rules_all on public.custom_rules;
create policy custom_rules_all on public.custom_rules
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.user_actions enable row level security;
drop policy if exists user_actions_all on public.user_actions;
create policy user_actions_all on public.user_actions
  for all using (
    (workspace_id is not null and public.is_workspace_member(workspace_id))
    or (workspace_id is null and user_id = auth.uid())
  )
  with check (
    (workspace_id is not null and public.is_workspace_member(workspace_id))
    or (workspace_id is null and user_id = auth.uid())
  );

alter table public.import_logs enable row level security;
drop policy if exists import_logs_all on public.import_logs;
create policy import_logs_all on public.import_logs
  for all using (
    exists (
      select 1 from public.import_batches b
      where b.id = import_logs.batch_id
        and public.is_workspace_member(b.workspace_id)
    )
    or exists (
      select 1 from public.batches b
      where b.id = import_logs.batch_id
        and public.is_workspace_member(b.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.import_batches b
      where b.id = import_logs.batch_id
        and public.is_workspace_member(b.workspace_id)
    )
    or exists (
      select 1 from public.batches b
      where b.id = import_logs.batch_id
        and public.is_workspace_member(b.workspace_id)
    )
    or import_logs.batch_id is null
  );

alter table public.generation_lineage enable row level security;
drop policy if exists generation_lineage_all on public.generation_lineage;
create policy generation_lineage_all on public.generation_lineage
  for all using (
    exists (
      select 1 from public.obligation_generations g
      where g.id = generation_lineage.generation_id
        and public.is_workspace_member(g.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.obligation_generations g
      where g.id = generation_lineage.generation_id
        and public.is_workspace_member(g.workspace_id)
    )
  );

-- --- Catalog / read-only for authenticated (writes via service_role) ---
alter table public.official_sources enable row level security;
drop policy if exists official_sources_read on public.official_sources;
create policy official_sources_read on public.official_sources
  for select to authenticated using (true);

alter table public.rule_set_versions enable row level security;
drop policy if exists rule_set_versions_read on public.rule_set_versions;
create policy rule_set_versions_read on public.rule_set_versions
  for select to authenticated using (true);

alter table public.billing_products enable row level security;
drop policy if exists billing_products_read on public.billing_products;
create policy billing_products_read on public.billing_products
  for select to authenticated using (true);

alter table public.billing_prices enable row level security;
drop policy if exists billing_prices_read on public.billing_prices;
create policy billing_prices_read on public.billing_prices
  for select to authenticated using (true);

alter table public.plan_versions enable row level security;
drop policy if exists plan_versions_read on public.plan_versions;
create policy plan_versions_read on public.plan_versions
  for select to authenticated using (true);

-- Billing webhook ledger: no client policies (service_role bypasses RLS)
alter table public.billing_events enable row level security;
-- intentionally no policies for anon/authenticated
