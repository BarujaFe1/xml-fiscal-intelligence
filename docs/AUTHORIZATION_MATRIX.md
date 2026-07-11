# Authorization Matrix

Roles (workspace membership):

| Capability | owner | admin | accountant | fiscal_analyst | operator | viewer | billing_manager | support_readonly |
| ---------- | :---: | :---: | :--------: | :------------: | :------: | :----: | :-------------: | :--------------: |
| View documents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Import | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| Edit cadastro | ✓ | ✓ | ✓ | | | | | |
| Delete batch | ✓ | ✓ | | | | | | |
| Run audit | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| Resolve finding | ✓ | ✓ | ✓ | ✓ | | | | |
| Export | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| Generate EFD | ✓ | ✓ | ✓ | ✓ | | | | |
| Manage team | ✓ | ✓ | | | | | | |
| Manage billing | ✓ | | | | | | ✓ | |
| Access logs | ✓ | ✓ | | | | | | ✓ |
| Change rules | ✓ | ✓ | | | | | | |
| Use AI | ✓ | ✓ | ✓ | ✓ | | | | |
| Admin API | ✓ | ✓ | | | | | | |

Implementation: `src/lib/auth/permissions.ts` — enforce on server; never rely on UI alone.

## Deny-by-default

- Tenant IDs from the browser are not trusted.
- RLS policies must be enabled + forced where applicable (see migrations).
- Support access to raw XML requires explicit temporary grant (future workflow).
