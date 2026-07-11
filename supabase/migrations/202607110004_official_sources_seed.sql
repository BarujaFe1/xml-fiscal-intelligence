-- Seed official sources registry (URLs oficiais — hash/versão a confirmar no download)
-- Não substitui verificação humana do Guia Prático vigente.

insert into official_sources (
  id, title, url, version_label, published_at, effective_from, effective_to,
  layout_version, pva_version, document_hash, last_verified_at, notes
) values
(
  'sped:portal',
  'Portal SPED (gov.br)',
  'https://www.gov.br/sped/pt-br',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  current_date,
  'Portal institucional. Preferir manuais/guias baixados da área de download oficial.'
),
(
  'sped:efd-icms-ipi:hub',
  'EFD ICMS/IPI — escrituração digital (hub)',
  'https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  current_date,
  'Página de assunto. Baixar Guia Prático e tabelas apenas do canal oficial de download.'
),
(
  'rfb:sped-download',
  'Receita Federal — central de download SPED',
  'https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  current_date,
  'Fonte primária para pacotes/PVA/guias. Preencher version_label, effective_from e document_hash após download.'
),
(
  'sped:efd-icms-ipi:2026-watch',
  'EFD ICMS/IPI — vigência 2026 (watch)',
  'https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi',
  'PENDING_OFFICIAL_GUIDE_3_2_2',
  null,
  '2026-01-01',
  '2026-12-31',
  'EFD_ICMS_IPI_2026_DRAFT',
  null,
  null,
  current_date,
  'PLACEHOLDER: confirmar número exato do Guia Prático 2026 no download oficial antes de produção. Não usar blog como fonte.'
),
(
  'sped:efd-icms-ipi:2027-watch',
  'EFD ICMS/IPI — vigência anunciada 2027 (watch)',
  'https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi',
  'PENDING_OFFICIAL_GUIDE_3_2_3',
  null,
  '2027-01-01',
  null,
  'EFD_ICMS_IPI_2027_DRAFT',
  null,
  null,
  current_date,
  'PLACEHOLDER: vigência 2027 anunciada — validar no portal oficial. Não misturar com gerações 2026.'
)
on conflict (id) do update set
  url = excluded.url,
  notes = excluded.notes,
  last_verified_at = excluded.last_verified_at;
