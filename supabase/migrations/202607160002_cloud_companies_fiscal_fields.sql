-- PR4: estender cloud_companies com os campos fiscais do cadastro (layout EFD 020).
-- O objeto completo da empresa já trafega em payload_json (ver /api/companies/sync);
-- estas colunas indexam os campos usados na geração (0000/0002/0100/E110).
-- Tabelas establishments/accountants de 202607160001 eram paralelas e redundantes
-- frente a cloud_companies; removidas para manter um único espelho de cadastro.

alter table cloud_companies
  add column if not exists activity_code text,
  add column if not exists profile text check (profile is null or profile in ('A', 'B', 'C')),
  add column if not exists purpose text check (purpose is null or purpose in ('0', '1')),
  add column if not exists industrial_class text,
  add column if not exists prior_credit_balance text,
  add column if not exists cnae text,
  add column if not exists cnae_description text,
  add column if not exists accountant_name text,
  add column if not exists accountant_cpf text,
  add column if not exists accountant_crc text,
  add column if not exists accountant_email text;

create index if not exists idx_cc_activity on cloud_companies (activity_code);
create index if not exists idx_cc_profile on cloud_companies (profile);

drop table if exists establishments;
drop table if exists accountants;
