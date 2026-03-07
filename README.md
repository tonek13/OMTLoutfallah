# OMT v2 Backend (NestJS Monorepo)

OMT v2 is a NestJS microservices backend focused on authentication and money transfers.

## Current Repository Status

| Service                | Port   | Status                | Notes                                                                    |
| ---------------------- | ------ | --------------------- | ------------------------------------------------------------------------ |
| `auth-service`         | `3001` | Implemented           | Running API with Swagger, JWT auth, email OTP, PostgreSQL, rate limiting |
| `transfer-service`     | `3002` | Implemented | API/controllers/entities and JWT validation are in place |
| `user-service`         | `3003` | Scaffold only         | No runnable service entrypoint yet                                       |
| `notification-service` | `3004` | Scaffold only         | No runnable service entrypoint yet                                       |
| `audit-service`        | `3005` | Scaffold only         | No runnable service entrypoint yet                                       |
| `libs/common`          | N/A    | Implemented           | Shared global exception filter and audit interceptor                     |

## Implemented Features

### Auth Service (`apps/auth-service`)

- User registration with phone and optional email.
- Password hashing with `bcrypt` (12 rounds).
- Email OTP verification flow with Redis-backed code storage (10 min expiry).
- Login with account lockout after 5 failed attempts (30 minutes).
- JWT access token (`15m`) and refresh token (`7d`).
- Refresh token hashing before persistence.
- Throttling/rate limiting on auth endpoints.
- Input validation (`class-validator`) with whitelist mode.
- Security middlewares: `helmet`, `compression`, CORS.
- Swagger docs at `/api/docs`.

### Transfer Service (`apps/transfer-service`)

- Create transfer endpoint with:
  - fee calculation by currency,
  - daily USD limit check,
  - basic fraud pre-check and flagging,
  - transactional DB write,
  - generated transfer reference code.
- Transfer history with pagination.
- Get transfer by reference.
- Cancel pending transfer.
- DTO validation and request throttling.
- Swagger docs at `/api/docs`.

### Shared Library (`libs/common`)

- `GlobalExceptionFilter` for consistent error responses.
- `AuditInterceptor` for request-level audit logs.

## API Endpoints

### Auth Service (`http://localhost:3001`)

| Method | Endpoint             | Description              |
| ------ | -------------------- | ------------------------ |
| `POST` | `/auth/register`     | Register a new user      |
| `POST` | `/auth/verify-email` | Verify email with OTP    |
| `POST` | `/auth/resend-otp`   | Resend OTP               |
| `POST` | `/auth/login`        | Login and receive tokens |
| `POST` | `/auth/refresh`      | Refresh access token     |
| `POST` | `/auth/logout`       | Logout user              |

Swagger: `http://localhost:3001/api/docs`

### Transfer Service (`http://localhost:3002`)

Base prefix is `api/v1`, so endpoints are:

| Method  | Endpoint                       | Description               |
| ------- | ------------------------------ | ------------------------- |
| `POST`  | `/api/v1/transfers`            | Create transfer           |
| `GET`   | `/api/v1/transfers`            | List my transfers         |
| `GET`   | `/api/v1/transfers/:reference` | Get transfer by reference |
| `PATCH` | `/api/v1/transfers/:id/cancel` | Cancel pending transfer   |

Swagger: `http://localhost:3002/api/docs`

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (for PostgreSQL, Redis, Kafka, Zookeeper)

## Environment Setup

Create env files:

```bash
# macOS / Linux
cp apps/auth-service/.env.example apps/auth-service/.env
cp apps/transfer-service/.env.example apps/transfer-service/.env
```

```powershell
# Windows PowerShell
Copy-Item apps/auth-service/.env.example apps/auth-service/.env
Copy-Item apps/transfer-service/.env.example apps/transfer-service/.env
```

Important notes:

- `auth-service` also needs email OTP variables:
  - `GMAIL_USER`
  - `GMAIL_APP_PASSWORD`
- `transfer-service` uses `DB_PASSWORD` (or legacy `DB_PASS`); if you use the provided Docker PostgreSQL, set:
  - `DB_HOST=localhost`
  - `DB_PORT=5432`
  - `DB_USER=omt_user`
  - `DB_PASSWORD=omt_password`
  - `DB_NAME=omt_db`
- `JWT_SECRET` in `transfer-service` must match `auth-service` so bearer tokens can be validated consistently.

## How To Launch

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis zookeeper kafka
```

### 3. Start services

Open separate terminals:

```bash
# Terminal 1
npm run start:auth
```

```bash
# Terminal 2
npm run start:transfer
```

## Production Security Settings

- Set `NODE_ENV=production` in each service.
- Set `TYPEORM_SYNCHRONIZE=false` (default in the templates).
- Set `ENABLE_SWAGGER=false` (default behavior in production unless explicitly enabled).
- Set strict `ALLOWED_ORIGINS` (comma-separated), never `*` in production.
- Use strong secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`) with at least 32 characters.

## Known Gaps Right Now

- `user-service`, `notification-service`, and `audit-service` are scaffolded but not runnable yet.
- `docker-compose.yml` defines app containers for all services, but only `apps/auth-service/Dockerfile` exists at the moment.
