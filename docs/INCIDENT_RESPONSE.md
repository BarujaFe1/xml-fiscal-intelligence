# Incident Response (draft)

**Status:** Operational draft  
**Date:** 2026-07-11

## Severity

| Level | Example | Response target |
| ----- | ------- | --------------- |
| SEV1 | XML leak / auth bypass cross-tenant | Immediate containment |
| SEV2 | Billing webhook forgery / entitlement bypass | Same day |
| SEV3 | Import worker crash / partial data loss local | Next business day |
| SEV4 | UI honesty / copy issues | Backlog |

## Steps

1. Detect (logs, user report, advisor).  
2. Contain (rotate keys, disable feature flag, revoke sessions).  
3. Assess scope (workspaces affected — never paste XML into tickets).  
4. Eradicate / patch.  
5. Recover.  
6. Post-mortem within 5 business days for SEV1–2.

## Contacts

- Product owner: repository maintainers  
- DPO / legal: *to be appointed before commercial launch*  
- Infra: Vercel + Supabase dashboards

## Do not

- Commit secrets while “fixing” an incident.  
- Share raw fiscal XML in Slack/GitHub issues.  
- Declare “no impact” without evidence.
