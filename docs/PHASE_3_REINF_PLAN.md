# Plano detalhado — Fase 3: EFD-Reinf (ambiente restrito)

**Pré-requisito:** Fase 2 EFD commons mergeada (ou empilhada) + autorização para iniciar.  
**Branch sugerida:** `feat/reinf-event-engine`  
**Baseline atual:** [`reinf/plugin.ts`](../src/modules/obligations/reinf/plugin.ts) — pacote R-1000 + candidatos JSON; maturidade `foundation`.  
**Sem** push/deploy/transmissão real sem autorização **nomeada** nesta fase.

## Objetivo

Transformar Reinf de “pacote candidato” em **motor de eventos** com lifecycle, catálogo versionado, preparação para WS em **ambiente de restrição**, e conciliação DCTFWeb via import — sem certificado improvisado no browser.

## Maturidade alvo

| Marco | Maturidade |
|-------|------------|
| Catálogo + lifecycle + XML canônico + testes sem rede | `development` |
| Cadastros + cockpit + import DCTF + lab preenchível | `internal_beta` |
| 1º evento aceito em ambiente restrito (evidência) | `official_validator_beta` (cenário) |
| `production` / `validated_scope` amplo | **fora** da Fase 3 |

## Escopo de implementação (checklist)

### 3.1 Domínio e catálogo

- [ ] Schema versionado de eventos (JSON/YAML em `src/modules/obligations/reinf/catalog/`) — R-1000, subset R-2000/R-4000, fechamento/reabertura/exclusão
- [ ] Tipos `ReinfEventStatus`: draft | ready | signed | queued | submitted | accepted | rejected | processing | deleted | replaced
- [ ] Entidade canônica: evento + lote + hashes + protocolo/recibo/mensagem/ambiente
- [ ] **Não** hardcode só a lista “atual” no TypeScript solto — importar catálogo versionado

### 3.2 Persistência

- [ ] Store IndexedDB `reinf_events` (local-first)
- [ ] Migration Supabase: `reinf_events`, `reinf_batches`, RLS por workspace
- [ ] Vincular evidências ao cofre/storage privado (XML assinado, recibo) — **metadados de programa**, nunca redistribuir binários

### 3.3 Assinatura (agente local)

- [ ] Spec do agente local (processo fora do Vercel): recebe XML canônico → devolve XML assinado
- [ ] Stub do protocolo (pipe/file/HTTP localhost) com testes de contrato
- [ ] Proibir PFX/senha no browser, logs e env de preview públicos
- [ ] Checklist de segurança antes de qualquer feature flag de submit

### 3.4 Integração oficial (restrita)

- [ ] Cliente WS atrás de `FEATURE_REINF_SUBMIT` (default off)
- [ ] Default **ambiente de restrição**; produção exige flag + auth explícita
- [ ] Timeout, retry seguro, idempotência por chave de evento
- [ ] Consulta situação / recibo / exclusão / reenvio
- [ ] Monitoramento + status no cockpit

### 3.5 DCTFWeb

- [ ] Import de relatório oficial (CSV/PDF texto) → débitos esperados vs eventos fechados
- [ ] Diffs com tolerância 0 (ou política documentada)
- [ ] UI painel “importar DCTFWeb” sem fingir login no portal
- [ ] Doc `DCTFWEB_RECONCILIATION.md` sair de planned

### 3.6 Cadastros mestres

- [ ] Extender hub: obra, tomador, prestador, beneficiário, pagamento/rendimento
- [ ] Vigência + dedupe básica

### 3.7 UX / cockpit

- [ ] Células Reinf no `/app/closing` com lifecycle
- [ ] Lista de eventos atrasados (só se calendário tiver fonte — senão status manual)
- [ ] Lab. validadores: programa `efd_reinf_ambiente`

### 3.8 Testes e docs

- [ ] Unit: serialização XML, transições de status inválidas bloqueadas
- [ ] Integration: lote draft→ready sem rede
- [ ] Fixture sintética R-1000
- [ ] Atualizar `EFD_REINF_PROFESSIONAL_SCOPE.md`, `REINF_EVENT_ENGINE.md`, matriz maturidade
- [ ] Relatório §28 ao fim

## Explicitamente fora da Fase 3

- Transmissão produção sem checklist + autorização
- Scraping gov.br
- Fingir acesso DCTFWeb autenticado
- Paridade completa eSocial
- Todos os eventos R-2000/R-4000 de uma vez (subset documentado primeiro)

## Dependências / riscos

| Risco | Mitigação |
|-------|-----------|
| Certificado / LGPD | Agente local + nunca logar segredo |
| Mudança de schema RFB | Catálogo versionado + rule_set_versions |
| Escopo exploding | Subset de eventos no kickoff (lista escrita no 1º PR) |
| Ambiente restrito indisponível | Entregar até `internal_beta` sem submit |

## Ordem de PRs sugerida dentro da Fase 3

1. `feat/reinf-catalog-lifecycle` — catálogo + tipos + IDB + testes  
2. `feat/reinf-xml-canonical` — builders XML + hash  
3. `feat/reinf-local-signer-spec` — contrato agente + stub  
4. `feat/reinf-ws-restricted` — cliente WS + flags (sem prod)  
5. `feat/reinf-dctf-import` — conciliação por arquivo  
6. Docs + maturity bump + relatório  

## Critérios de saída da Fase 3

- Maturidade ≥ `development` com testes verdes
- Doc engine atualizado (não “planned”)
- Zero deploy de submit sem autorização
- Tabela §28 atualizada; nenhuma célula `production`

## Kickoff (quando autorizar)

Comando esperado: **“aplique Fase 3”** — começar pelo PR 1 (catálogo + lifecycle).
