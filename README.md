# OMT v2 Backend (NestJS Monorepo)

OMT v2 is a NestJS microservices backend focused on authentication and money transfers.

## Ownership

- Template author: **Tony Loutfallah**
- Fingerprint: `tony-loutfallah-v1`
- License: `MIT` (see [LICENSE](./LICENSE))
- Attribution/notice: see [NOTICE](./NOTICE)

## Live Demo

| Interface | URL |
|-----------|-----|
| UI Control Deck | https://omtloutfallah.onrender.com |
| Auth Service API | https://omt-auth-service.onrender.com |
| Swagger Docs | https://omt-auth-service.onrender.com/api/docs |

## Current Repository Status

| Service                | Port   | Status        | Notes                                                                    |
| ---------------------- | ------ | ------------- | ------------------------------------------------------------------------ |
| `auth-service`         | `3001` | Implemented   | Running API with Swagger, JWT auth, email OTP, PostgreSQL, rate limiting |
| `transfer-service`     | `3002` | Implemented   | API/controllers/entities and JWT validation are in place                 |
| `user-service`         | `3003` | Scaffold only | No runnable service entrypoint yet                                       |
| `notification-service` | `3004` | Scaffold only | No runnable service entrypoint yet                                       |
| `audit-service`        | `3005` | Scaffold only | No runnable service entrypoint yet                                       |
| `libs/common`          | N/A    | Implemented   | Shared global exception filter and audit interceptor                     |

## Implemented Features

### Auth Service (`apps/auth-service`)

- User registration with phone and required email.
- Password hashing with `bcrypt` (12 rounds).
- Email OTP verification via **Brevo** with Redis-backed code storage (10 min expiry).
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

- Email OTP uses **Brevo** — set `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` in your `.env`.
- `JWT_SECRET` in `transfer-service` must match `auth-service`.

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
```bash
# Terminal 1
npm run start:auth

# Terminal 2
npm run start:transfer

# Terminal 3 (UI playground)
npm run start:ui
```

UI URL: `http://localhost:4173`

## Production Security Settings

- Set `NODE_ENV=production` in each service.
- Set `TYPEORM_SYNCHRONIZE=false`.
- Set `ENABLE_SWAGGER=false`.
- Set strict `ALLOWED_ORIGINS`, never `*` in production.
- Use strong secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ chars).

## Known Gaps

- `user-service`, `notification-service`, and `audit-service` are scaffolded but not runnable yet.
- Only `apps/auth-service/Dockerfile` exists at the moment.