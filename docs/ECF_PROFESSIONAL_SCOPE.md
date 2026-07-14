# ECF — Professional Scope

**Maturidade:** `development` (Fase 5)

Dependente do motor contábil (ECD/ledger). Recuperação canônica ECD + prior ECF, mapper conta×referencial com confirmação humana, tabelas dinâmicas versionadas (CSV), e-Lalur Parte A/B + diff, geração J050/L030 assistida.

**IRPJ/CSLL:** apenas com `FEATURE_ECF_IRPJ_ENGINE` (default off) + evidência Programa ECF + revisor. Nunca derivados de NF-e/XML fiscal.

**Não é:** transmissão oficial, `validated_scope`/`production`, assinatura digital no produto.

Cockpit: `/app/ecf`. Docs: [`ELALUR_ELACS_ENGINE.md`](ELALUR_ELACS_ENGINE.md), [`PHASE_5_ECF_PLAN.md`](PHASE_5_ECF_PLAN.md).
