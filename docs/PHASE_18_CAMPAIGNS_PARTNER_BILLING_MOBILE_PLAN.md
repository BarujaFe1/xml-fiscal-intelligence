# Plano detalhado — Fase 18: Campanhas · partner billing · mobile generate SoD

**Pré-requisito:** Fase 17 assurance em `official_validator_beta` prep + autorização explícita.  
**Branch sugerida:** `feat/campaigns-partner-billing-mobile-gen`  
**Baseline:** SOC2 readiness/waivers, assist grounded, SAP live gated (F17); growth F16; scale billing F13.  
**Sem** production global. **Sem** inventar tributos. **Sem** transmissão sem auth.

## Objetivo

Escala controlada pós-prep de auditoria:

1. **Campanhas massivas** pós-auditoria/homologação — fila, rate limits, SoD (quem publica ≠ quem aprova massa).  
2. **Billing de parceiros** — planos/partner metering ligados a white-label e convites `partner_auditor`.  
3. **Mobile generate gated** — estender `/app/m` com generate assistido sob SoD + flags (ainda sem transmissão).

## Maturidade alvo

| Marco | Resultado |
|-------|-----------|
| Campanhas com rate + SoD | internal_beta |
| Partner billing draft | development→internal_beta |
| Mobile generate gated | development (flag off default) |
| Production global | fora |

## Escopo (checklist)

### 18.1 Campanhas massivas

- [ ] Modelo de campanha (obligation × UF × período × golden pack)
- [ ] Fila + rate limits + aprovação SoD
- [ ] Telemetria sanitizada (sem PII/CNPJ cru)
- [ ] Ligação opcional a compliance pack hash

### 18.2 Partner billing

- [ ] Planos/metering por parceiro (uso API / importações / seats auditor)
- [ ] Export CSV honest (sem claim “receita RFB”)
- [ ] Feature flag `FEATURE_PARTNER_BILLING`
- [ ] UI `/app/partners` ou seção em ecosystem/enterprise

### 18.3 Mobile generate + SoD

- [ ] Flag `FEATURE_MOBILE_GENERATE` default off
- [ ] Dual-control: initiator ≠ approver
- [ ] Ainda bloqueia transmissão / certificado
- [ ] Ban alíquota/vencimento herdado do assist grounded

### 18.4 Fechamento

- [ ] Relatório §28
- [ ] Candidata Fase 19 (ISO/SOC2 Type II prep · regiões extras · ERP #4 Senior)

## Fora da Fase 18

- Campanha open sem moderação
- Cobrança real em gateway sem contrato
- Transmissão pelo mobile
- Motor tributário genérico
- Auto-production

## Ordem de PRs

1. `feat/campaign-queue-sod`  
2. `feat/partner-billing-meter`  
3. `feat/mobile-generate-gated`  
4. Docs  

## Critérios de saída

- Campanhas com SoD + rate testados
- Partner billing exportável sem claims falsos
- Mobile generate só com flag + SoD; transmissão continua bloqueada
- Zero production global · assist continua grounded

## Candidata Fase 19

Type II prep contínuo · Senior live #4 · expansão jurisdição/i18n.

## Kickoff

**“aplique Fase 18”** após confirmar `/app/assurance` + readiness completeOrWaived + SAP golden nos testes.
