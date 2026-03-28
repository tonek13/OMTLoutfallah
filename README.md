# OMT v2 Backend (NestJS Monorepo)

OMT v2 is a multi-tenant backend with auth, tenant administration, private currencies, wallets, and transfers.

## URLs

### Production

| Surface | URL |
| --- | --- |
| UI Console | `https://omtloutfallah.onrender.com` |
| Auth API Base | `https://omt-auth-service.onrender.com` |
| Auth Swagger | `https://omt-auth-service.onrender.com/api/docs` |
| Transfer API Base | `https://omt-transfer-service.onrender.com/api/v1` |
| Transfer Swagger | `https://omt-transfer-service.onrender.com/api/docs` |

### Local

| Surface | URL |
| --- | --- |
| UI Console | `http://localhost:4173` |
| Auth API Base | `http://localhost:3001` |
| Auth Swagger | `http://localhost:3001/api/docs` |
| Transfer API Base | `http://localhost:3002/api/v1` |
| Transfer Swagger | `http://localhost:3002/api/docs` |

## Ownership

- Template author: **Tony Loutfallah**
- Fingerprint: `tony-loutfallah-v1`
- License: `MIT` (see [LICENSE](./LICENSE))
- Attribution/notice: see [NOTICE](./NOTICE)

## Tenant Model

- A **tenant** is an organization.
- A **user belongs to one tenant** via `users.tenantId`.
- `TENANT_ADMIN` can manage only its own tenant (`tenantId` must match route tenant).
- Normal users still exist (`customer`, `agent`, etc.) and operate inside their tenant.
- JWT payload includes `tenantId` and tenant-aware checks are enforced in auth and transfer flows.

## Services

| Service | Local Port | Status | Notes |
| --- | --- | --- | --- |
| `auth-service` | `3001` | Implemented | Auth + tenant + currency + wallet APIs |
| `transfer-service` | `3002` | Implemented | Transfer APIs (`/api/v1`) with tenant isolation |
| `ui` | `4173` | Implemented | API Console for manual end-to-end testing |
| `user-service` | `3003` | Scaffold | Not active |
| `notification-service` | `3004` | Scaffold | Not active |
| `audit-service` | `3005` | Scaffold | Not active |

## API Summary

### Auth Service (`http://localhost:3001`)

#### Public

- `POST /tenants` Create tenant + initial tenant admin
- `POST /auth/register` Register normal user (requires `tenantId`)
- `POST /auth/verify-email`
- `POST /auth/resend-otp`
- `POST /auth/login`
- `POST /auth/refresh`

#### Protected (Bearer token)

- `POST /auth/logout`
- `GET /tenants/my`
- `GET /tenants/:id` (`TENANT_ADMIN` + same tenant)
- `PATCH /tenants/:id` (`TENANT_ADMIN` + same tenant)
- `POST /tenants/:tenantId/currencies` (`TENANT_ADMIN` + same tenant)
- `GET /tenants/:tenantId/currencies`
- `GET /tenants/:tenantId/currencies/:currencyId`
- `POST /tenants/:tenantId/currencies/:currencyId/members` (`TENANT_ADMIN` + same tenant)
- `GET /wallets/me` (requires `x-tenant-id` header)
- `POST /tenants/:tenantId/mint` (`TENANT_ADMIN` + same tenant)

Swagger: `http://localhost:3001/api/docs` (when enabled)

### Transfer Service (`http://localhost:3002`)

All endpoints are under global prefix `api/v1` and require Bearer token.

- `POST /api/v1/transfers`
- `GET /api/v1/transfers?page=1&limit=20`
- `GET /api/v1/transfers/:reference`
- `PATCH /api/v1/transfers/:id/cancel`

Swagger: `http://localhost:3002/api/docs` (when enabled)

## Data Model Additions

- `currencies` table
  - `id`, `tenantId`, `name`, `symbol`, `totalSupply`, `circulatingSupply`, `color`, `status`, `earnRules (jsonb)`, `expiryDays`
- `wallets` table
  - `id`, `userId`, `currencyId`, `tenantId`, `balance`, `frozenBalance`
  - unique constraint on (`userId`, `currencyId`)
- tenant foreign keys added on users/transfers for tenant isolation

Migrations are in `apps/tenants/migrations`:

- `1772928000000-AddTenantFkToUserAndTransfer.ts`
- `1773014400000-CreateCurrencyEntity.ts`
- `1773187200000-CreateWalletEntity.ts`

## Local Setup

### 1) Install

```bash
npm install
```

### 2) Environment files

```powershell
Copy-Item apps/auth-service/.env.example apps/auth-service/.env
Copy-Item apps/transfer-service/.env.example apps/transfer-service/.env
```

Important:

- In production, auth requires `BREVO_API_KEY` and `BREVO_FROM_EMAIL`.
- `JWT_SECRET` must match between auth and transfer services.

### 3) Start infrastructure

```bash
docker compose up -d postgres redis zookeeper kafka
```

### 4) Run migrations

```bash
npm run migration:run
```

### 5) Start services

```bash
# Terminal 1
npm run start:auth

# Terminal 2
npm run start:transfer

# Terminal 3
npm run start:ui
```

UI URL: `http://localhost:4173`

## UI Console

`apps/ui` is a DB-driven API console:

- tenant dropdowns load from DB (`/tenants/my`)
- currency and wallet selectors load from DB
- no static tenant/currency option lists
- includes sections for auth, tenant settings, currencies, wallets, and transfers

## Render Deployment

### Auth Service (Node Web Service)

- Build Command:
  - `npm install --include=dev && node node_modules/@nestjs/cli/bin/nest.js build auth-service`
- Start Command:
  - `node dist/apps/auth-service/apps/auth-service/src/main.js`

### Transfer Service (Node Web Service)

- Build Command:
  - `npm install --include=dev && node node_modules/@nestjs/cli/bin/nest.js build transfer-service`
- Start Command:
  - `node dist/apps/transfer-service/apps/transfer-service/src/main.js`

### Required notes for Render

- Branch: `main`
- Auto Deploy: `On`
- Set production env vars (`NODE_ENV=production`, DB/JWT/Redis/Kafka/Brevo settings).
- Keep `TYPEORM_SYNCHRONIZE=false` in production.
- Run migrations during release/deploy process.

## Swagger

Swagger is controlled by `ENABLE_SWAGGER`.

- Auth docs: `/api/docs`
- Transfer docs: `/api/docs`

In production, set `ENABLE_SWAGGER=true` only if you intentionally want public docs.
