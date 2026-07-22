-- Pré-validação EFD: fontes oficiais, definições de campo e mensagens do PVA.
-- Modelado após 202607110003_jobs_obligations.sql (pva_validation_runs /
-- obligation_generations). Não altera tabelas existentes; apenas cria o que
-- não existir (IF NOT EXISTS) e habilita RLS.

-- 1) Metadados da fonte oficial versionada (ex.: Guia Prático EFD 3.2.2).
create table if not exists official_source_versions (
  id text primary key,
  code text not null,
  title text not null,
  version text not null,
  published_date date,
  effective_from date not null,
  effective_to date,
  source_url text,
  pdf_hash text,
  queried_at timestamptz
);

-- 2) Definições versionadas de campo EFD para pré-validação (prompt §7).
--    Espelha EfdFieldDefinition (verification-types.ts).
create table if not exists efd_field_definitions (
  id uuid primary key default gen_random_uuid(),
  layout_version text not null,
  record_code text not null,
  field_number int not null,
  field_name text not null,
  type text not null,
  required_rule text not null,
  max_length int,
  decimal_scale int,
  effective_from text not null,
  effective_to text,
  official_source_id text not null,
  unique (layout_version, record_code, field_number, effective_from)
);

-- 3) Mensagens individuais do relatório do PVA (erros/avisos mapeados).
create table if not exists pva_validation_messages (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid references pva_validation_runs(id) on delete cascade,
  severity text not null check (severity in ('error', 'warning')),
  category text,
  block text,
  record_code text,
  line_number int,
  field_number int,
  field_name text,
  message text,
  raw_message text,
  mapped_lineage_id uuid,
  resolution_status text not null default 'open'
    check (resolution_status in
      ('open', 'mapped', 'corrected', 'not_applicable', 'requires_manual_review'))
);

create index if not exists idx_efd_field_defs_record
  on efd_field_definitions (layout_version, record_code);
create index if not exists idx_pva_validation_messages_run
  on pva_validation_messages (validation_run_id);

-- Sem workspace_id: política permissiva para usuários autenticados,
-- consistente com o estilo RLS do projeto (ver helpers em 202607110001).
alter table official_source_versions enable row level security;
alter table efd_field_definitions enable row level security;
alter table pva_validation_messages enable row level security;

drop policy if exists official_source_versions_auth on official_source_versions;
create policy official_source_versions_auth on official_source_versions
  for all using (auth.uid() is not null);

drop policy if exists efd_field_definitions_auth on efd_field_definitions;
create policy efd_field_definitions_auth on efd_field_definitions
  for all using (auth.uid() is not null);

drop policy if exists pva_validation_messages_auth on pva_validation_messages;
create policy pva_validation_messages_auth on pva_validation_messages
  for all using (auth.uid() is not null);

-- Seed da fonte oficial GP_EFD_322 (Guia Prático EFD ICMS/IPI 3.2.2).
insert into official_source_versions (id, code, title, version, published_date,
  effective_from, effective_to, source_url, pdf_hash, queried_at)
values (
  'GP_EFD_322',
  'GP_EFD_322',
  'Guia Prático da EFD ICMS/IPI — Versão 3.2.2',
  '3.2.2',
  null,
  '2026-06-01',
  null,
  'https://www.gov.br/receitafederal/pt-br/assuntos/auditoria-e-fiscalizacao/auditoria/estudos-e-manuais/guia-pratico-efd-icms-ipi',
  null,
  null
)
on conflict (id) do nothing;

-- Seed das definições de campo correspondentes a EFD_FIELD_DEFINITIONS
-- (layoutVersion 3.2.2, período 2026-06, perfil A, UF genérica).
insert into efd_field_definitions (
  layout_version, record_code, field_number, field_name, type, required_rule,
  max_length, decimal_scale, effective_from, effective_to, official_source_id
) values
  -- Registro 0000
  ('3.2.2','0000',2,'COD_VER','string','required_always',3,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',3,'COD_FIN','string','required_always',1,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',4,'DT_INI','date','required_always',null,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',5,'DT_FIN','date','required_always',null,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',6,'NOME','string','required_always',100,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',7,'CNPJ','string','required_always',14,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',8,'CPF','string','required_when:CNPJ_ABSENT',11,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',9,'UF','string','required_always',2,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',10,'IE','string','required_always',14,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',11,'COD_MUN','string','required_always',7,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',14,'IND_PERFIL','string','required_for_profile:A',1,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0000',15,'IND_ATIV','string','required_always',1,null,'2026-06',null,'GP_EFD_322'),
  -- Registro 0005
  ('3.2.2','0005',4,'CEP','string','required_always',8,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0005',5,'END','string','required_always',60,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0005',6,'NUM','string','required_always',10,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0005',7,'COMPL','string','required_when:COMPL_PRESENT',60,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0005',8,'BAIRRO','string','required_always',60,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0005',9,'FONE','string','required_always',11,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0005',11,'EMAIL','string','required_always',255,null,'2026-06',null,'GP_EFD_322'),
  -- Registro 0150 (derivado dos documentos)
  ('3.2.2','0150',3,'COD_PART','string','required_when:HAS_PARTICIPANTS',60,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0150',4,'NOME','string','required_when:HAS_PARTICIPANTS',100,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0150',5,'COD_PAIS','string','required_when:HAS_PARTICIPANTS',4,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0150',6,'CNPJ','string','required_when:CNPJ_PARTICIPANT',14,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0150',7,'CPF','string','required_when:CPF_PARTICIPANT',11,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0150',9,'COD_MUN','string','required_when:HAS_PARTICIPANTS',7,null,'2026-06',null,'GP_EFD_322'),
  -- Registro 0200 (derivado dos documentos)
  ('3.2.2','0200',2,'COD_ITEM','string','required_when:HAS_ITEMS',60,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0200',3,'DESCR_ITEM','string','required_when:HAS_ITEMS',255,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','0200',6,'UNID_INV','string','required_when:HAS_ITEMS',6,null,'2026-06',null,'GP_EFD_322'),
  -- Registro C100 (derivado dos documentos)
  ('3.2.2','C100',2,'IND_OPER','string','required_when:HAS_DOCUMENTS',1,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C100',3,'IND_EMIT','string','required_when:HAS_DOCUMENTS',1,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C100',4,'COD_PART','string','required_when:HAS_DOCUMENTS',60,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C100',5,'COD_MOD','string','required_when:HAS_DOCUMENTS',2,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C100',6,'COD_SIT','string','required_when:HAS_DOCUMENTS',2,null,'2026-06',null,'GP_EFD_322'),
  -- Registro C170 (apenas não eletrônico)
  ('3.2.2','C170',2,'NUM_ITEM','string','required_when:NON_ELECTRONIC',3,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C170',3,'COD_ITEM','string','required_when:NON_ELECTRONIC',60,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C170',4,'DESCR_COMPL','string','required_when:NON_ELECTRONIC',255,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C170',11,'CST_ICMS','string','required_when:NON_ELECTRONIC',3,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C170',12,'CFOP','string','required_when:NON_ELECTRONIC',4,null,'2026-06',null,'GP_EFD_322'),
  -- Registro C190 (derivado dos documentos)
  ('3.2.2','C190',2,'CST_ICMS','string','required_when:HAS_DOCUMENTS',3,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','C190',3,'CFOP','string','required_when:HAS_DOCUMENTS',4,null,'2026-06',null,'GP_EFD_322'),
  -- Bloco E
  ('3.2.2','E100',2,'DT_INI','date','required_always',null,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','E100',3,'DT_FIN','date','required_always',null,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','E110',2,'VL_TOT_DEBITOS','numeric','required_always',null,2,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','E110',6,'VL_TOT_CREDITOS','numeric','required_always',null,2,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','E110',11,'VL_SLD_CREDOR_ANT','numeric','required_always',null,2,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','E116',2,'COD_OR','string','required_when:ICMS_DUE',3,null,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','E116',3,'VL_OR','numeric','required_when:ICMS_DUE',null,2,'2026-06',null,'GP_EFD_322'),
  ('3.2.2','E116',5,'COD_REC','string','required_when:ICMS_DUE',60,null,'2026-06',null,'GP_EFD_322'),
  -- Registro 9999
  ('3.2.2','9999',2,'QTD_LIN','numeric','required_always',null,null,'2026-06',null,'GP_EFD_322')
on conflict (layout_version, record_code, field_number, effective_from) do nothing;
