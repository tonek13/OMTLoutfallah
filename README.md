# OMT v2 — NestJS Microservices Backend

## Architecture
```
omt-v2/
├── apps/
│   ├── auth-service/        → JWT auth, login, register, 2FA (port 3001)
│   ├── transfer-service/    → Core money transfer engine (port 3002)
│   ├── user-service/        → Profiles, KYC (port 3003)
│   ├── notification-service/→ SMS, email, push (port 3004)
│   └── audit-service/       → Logs every financial action (port 3005)
├── libs/
│   └── common/              → Shared guards, decorators, DTOs
└── docker-compose.yml
```

## Quick Start
```bash
# 1. Copy env files
cp apps/auth-service/.env.example apps/auth-service/.env
# (repeat for each service)

# 2. Start infrastructure
docker-compose up -d postgres redis kafka zookeeper

# 3. Install deps
npm install

# 4. Start auth service
npm run start:auth

# 5. Open Swagger
# http://localhost:3001/api/docs
```

## Auth Service Endpoints
| Method | Endpoint         | Description              |
|--------|-----------------|--------------------------|
| POST   | /auth/register  | Register new user        |
| POST   | /auth/login     | Login → returns JWT      |
| POST   | /auth/refresh   | Refresh access token     |
| POST   | /auth/logout    | Invalidate tokens        |

## Security Features
- Bcrypt password hashing (cost factor 12)
- JWT Access token (15min) + Refresh token (7d)
- Account lockout after 5 failed attempts (30min)
- Rate limiting on all auth endpoints
- Helmet security headers
- Input validation + whitelist
