-- Seed plan catalog (entitlements mirror PLAN_SEEDS in app code).
-- Prices live in Stripe; DB holds entitlement snapshots for server checks later.

insert into billing_products (code, name, active) values
  ('trial', 'Teste', true),
  ('essencial', 'Essencial', true),
  ('profissional', 'Profissional', true),
  ('escritorio', 'Escritório Contábil', true),
  ('enterprise', 'Enterprise', true)
on conflict (code) do update set name = excluded.name, active = excluded.active;

insert into plan_versions (plan_code, version, entitlements_json) values
  ('trial', 1, '{"canGenerateEfdIcmsIpi":true,"canUsePrivacyMode":true,"hasApiAccess":false,"hasAdvancedAudit":true,"hasAiExplanations":false,"hasPriorityProcessing":false,"maxCompanies":1,"maxEstablishments":2,"maxUsers":3,"maxDocumentsPerMonth":2000,"maxStorageBytes":524288000,"maxExportsPerMonth":20,"maxSpedGenerationsPerMonth":5}'::jsonb),
  ('essencial', 1, '{"canGenerateEfdIcmsIpi":true,"canUsePrivacyMode":true,"hasApiAccess":false,"hasAdvancedAudit":true,"hasAiExplanations":false,"hasPriorityProcessing":false,"maxCompanies":3,"maxEstablishments":10,"maxUsers":5,"maxDocumentsPerMonth":20000,"maxStorageBytes":5368709120,"maxExportsPerMonth":100,"maxSpedGenerationsPerMonth":30}'::jsonb),
  ('profissional', 1, '{"canGenerateEfdIcmsIpi":true,"canUsePrivacyMode":true,"hasApiAccess":true,"hasAdvancedAudit":true,"hasAiExplanations":true,"hasPriorityProcessing":false,"maxCompanies":15,"maxEstablishments":50,"maxUsers":20,"maxDocumentsPerMonth":100000,"maxStorageBytes":53687091200,"maxExportsPerMonth":500,"maxSpedGenerationsPerMonth":200}'::jsonb),
  ('escritorio', 1, '{"canGenerateEfdIcmsIpi":true,"canUsePrivacyMode":true,"hasApiAccess":true,"hasAdvancedAudit":true,"hasAiExplanations":true,"hasPriorityProcessing":true,"maxCompanies":100,"maxEstablishments":500,"maxUsers":50,"maxDocumentsPerMonth":500000,"maxStorageBytes":214748364800,"maxExportsPerMonth":2000,"maxSpedGenerationsPerMonth":1000}'::jsonb),
  ('enterprise', 1, '{"canGenerateEfdIcmsIpi":true,"canUsePrivacyMode":true,"hasApiAccess":true,"hasAdvancedAudit":true,"hasAiExplanations":true,"hasPriorityProcessing":true,"maxCompanies":10000,"maxEstablishments":100000,"maxUsers":1000,"maxDocumentsPerMonth":10000000,"maxStorageBytes":2199023255552,"maxExportsPerMonth":100000,"maxSpedGenerationsPerMonth":100000}'::jsonb)
on conflict (plan_code, version) do update set entitlements_json = excluded.entitlements_json;

-- Auto-create profile on signup (required for workspace_members FK)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
