# OMT v2 Backend

Multi-tenant backend (NestJS monorepo) with auth, tenants, currencies, wallets, and transfers.

## Services

| Service | Port | Base URL |
| --- | --- | --- |
| `auth-service` | `3001` | `http://localhost:3001` |
| `transfer-service` | `3002` | `http://localhost:3002/api/v1` |
| `ui` | `4173` | `http://localhost:4173` |

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create env files:
```powershell
Copy-Item apps/auth-service/.env.example apps/auth-service/.env
Copy-Item apps/transfer-service/.env.example apps/transfer-service/.env
```

3. Start infrastructure:
```bash
docker compose up -d postgres redis zookeeper kafka
```

4. Run migrations:
```bash
npm run migration:run
```

5. Start apps:
```bash
npm run start:auth
npm run start:transfer
npm run start:ui
```

## API Summary

### Auth Service (`http://localhost:3001`)

Public:
- `POST /tenants`
- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-otp`
- `POST /auth/login`
- `POST /auth/refresh`

Protected (Bearer token):
- `POST /auth/logout`
- `GET /tenants/my`
- `GET /tenants/:id`
- `PATCH /tenants/:id`
- `POST /tenants/:tenantId/currencies`
- `POST /currencies`
- `GET /tenants/:tenantId/currencies`
- `GET /tenants/:tenantId/currencies/:currencyId`
- `PATCH /currencies/:id`
- `GET /currencies/:id`
- `GET /currencies/:id/stats`
- `GET /currencies/:id/transactions`
- `POST /tenants/:tenantId/currencies/:currencyId/members`
- `GET /wallets/me` (requires `x-tenant-id`)
- `POST /tenants/:tenantId/mint` (legacy)
- `POST /currencies/:id/mint`
- `POST /currencies/:id/burn`

Swagger: `http://localhost:3001/api/docs` (when `ENABLE_SWAGGER=true`)

### Transfer Service (`http://localhost:3002/api/v1`)

All endpoints require Bearer token:
- `POST /transfers`
- `GET /transfers?page=1&limit=20`
- `GET /transfers/:reference`
- `PATCH /transfers/:id/cancel`

Swagger: `http://localhost:3002/api/docs` (when `ENABLE_SWAGGER=true`)

## Migrations

Located in `apps/tenants/migrations`:
- `1772928000000-AddTenantFkToUserAndTransfer.ts`
- `1773014400000-CreateCurrencyEntity.ts`
- `1773187200000-CreateWalletEntity.ts`
- `1773273600000-AddTenantAdminRoleToUsersEnum.ts`
- `1773350000000-CreateAuditLogEntity.ts`

## Notes

- JWT carries `tenantId`; tenant-scoped endpoints enforce same-tenant access.
- `TYPEORM_SYNCHRONIZE` should stay `false` in non-local environments.
