# Plano detalhado — Fase 5: ECF (sobre ECD)

**Status pós-implementação:** feito em `feat/ecf-from-ecd` — maturidade ECF `development`.  
**Pré-requisito:** Fase 4 motor contábil em `development+` com ledger real (gate: ECD sem DEMO no modo oficial).  
**Branch:** `feat/ecf-from-ecd`  
**Sem** push/deploy sem autorização. **Não liberar IRPJ/CSLL comercialmente** sem testes + Programa ECF + revisor humano.  
**Próximo:** [`PHASE_6_CONTRIBUICOES_PLAN.md`](PHASE_6_CONTRIBUICOES_PLAN.md).

## Objetivo

ECF dependente da fundação contábil: recuperação canônica de ECD/ECF anterior, mapeamento conta×referencial, import de tabelas dinâmicas oficiais, estrutura e-Lalur/e-Lacs, e motor IRPJ/CSLL determinístico sob gates rigorosos.

## Maturidade alvo

| Marco | Maturidade |
|-------|------------|
| Recuperação ECD + mapper conta×referencial + plugin estrutural | ~~`development`~~ **atingido** |
| e-Lalur/e-Lacs Parte A/B persistidos + diffs | modelo OK → `internal_beta` com evidência operacional |
| IRPJ/CSLL com evidência Programa ECF (cenário) | `official_validator_beta` (cenário) — flag ainda off |
| `validated_scope` / `production` | somente cenários com matriz preenchida |

## Escopo (checklist)

### 5.1 Recuperação canônica

- [x] Import ECD ativa (ledger + TXT I050) preservando lineage
- [x] Import ECF anterior → modelo canônico (não “colar TXT”)
- [x] Vincular saldos / contas / referenciais (hints + mapas)

### 5.2 Mapeador visual

- [x] UI conta contábil ↔ conta referencial (`/app/ecf`)
- [x] Validação de contas sem mapeamento (blocking no readiness)
- [x] Sugestão por histórico **exige confirmação humana**

### 5.3 Tabelas dinâmicas / planos referenciais

- [x] Import CSV versionado (IDB + migration)
- [x] Catálogo sem hardcode de listas gigantes
- [x] Vigência por período (`pickReferentialForPeriod`)

### 5.4 e-Lalur / e-Lacs

- [x] Modelo Parte A / Parte B
- [x] Saldo por conta + origem + dispositivo + aprovação
- [x] Diff entre versões; impacto
- [x] Doc `ELALUR_ELACS_ENGINE.md` operacional

### 5.5 IRPJ / CSLL (gated)

- [x] Motor determinístico esqueleto (bases + memória)
- [x] Gate: flag `FEATURE_ECF_IRPJ_ENGINE` default **off**
- [ ] Evidência Programa ECF + revisor (fora do software até lab)

### 5.6 Conciliação e lab

- [x] ECD × ECF · ECF × prior
- [x] `homologationGrade` (hash) para Programa ECF
- [x] Versão e-Lalur imutável (`locked`)

### 5.7 Plugin ECF + UI

- [x] `extras.ecdLedger` / recuperação obrigatória no modo oficial
- [x] `/app/ecf` cockpit
- [x] Maturidade + `ECF_PROFESSIONAL_SCOPE.md`

## Critérios de saída

- [x] Maturidade ≥ `development`
- [x] Zero cálculo IRPJ exposto sem flag
- [x] Contas órfãs bloqueiam geração oficial
- [x] Docs e-Lalur/ECF + matriz atualizados
- [x] Nenhuma célula `production`
- [x] Plano Fase 6 publicado

## Kickoff original

**“aplique Fase 5”** — concluído.
