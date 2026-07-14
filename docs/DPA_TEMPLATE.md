# DPA / termos — template (não jurídico)

**Aviso:** este documento é um **esqueleto operacional** para discussões com jurídico.  
Não constitui Data Processing Agreement assinado, parecer legal, nem adequação automática à LGPD.

## Papéis sugeridos

| Papel | Descrição curta |
|-------|-----------------|
| Controlador | Cliente workspace (define finalidades fiscais) |
| Operador | Fornecedor da plataforma (processa sob instrução) |
| Suboperadores | Cloud (Vercel/Supabase/etc.) listados no anexo de infraestrutura |

## Categorias de dados (típicas)

- Cadastros empresariais (CNPJ, IE) — minimizar em logs/export
- XML / SPED / evidências de validadores oficiais
- Metadados de geração (hash, layout, período)
- Trilha de auditoria (atoren ids, ações)

## Retenção

Políticas versionadas no produto (`RetentionPolicy`) — defaults em `DEFAULT_RETAIN_DAYS`.  
Valores operacionais **não** substituem prazo legal aplicável ao cliente.

## Direitos e exclusões

- Export de auditoria sanitizado disponível na UI de governança
- Sem garantia de exclusão de backups de cloud sem anexo técnico
- Sem claim de conformidade ISO/SOC neste template

## Assinaturas

_Espaço reservado — preencher somente após revisão jurídica._
