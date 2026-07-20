# Rebate System Backend

API Backend cho hệ thống Rebate, quản lý Commission Config, Payout Sessions, Assets và Templates.

## Setup & Run

```bash
# Install dependencies
npm install

# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

## API Documentation

Sau khi start server, truy cập:

```
http://localhost:3000/api-docs
```

Swagger UI hỗ trợ:
- **Auto-authorize sau login**: Gọi `POST /auth/admin/login` hoặc `/auth/user/login` qua Swagger UI → token sẽ tự động được gắn vào các request tiếp theo (không cần copy/paste)
- **Bearer token**: Sử dụng scheme `access-token` với format `Bearer <token>`

## Endpoints

### Authentication
- `POST /auth/admin/login` — Admin login
- `POST /auth/user/login` — User login (MIB/IB)

### User Management
- `GET /users` — List users (Pagination + filter parentId)
- `GET /users/:id` — Get user detail
- `POST /users` — Create user (MIB/IB)
- `PATCH /users/:id` — Update user (fullName/isActive)
- `GET /users/:id/subtree` — Get subtree recursive

### Commission Config
- `POST /commission-configs` — Upsert config
- `PATCH /commission-configs/:userId/:assetId` — Update config (version lock)
- `GET /commission-configs/tree/:userId?assetId=` — Get full tree (Admin)
- `GET /commission-configs/children/:userId?assetId=` — Get direct children

### Payout Sessions
- `GET /payout-sessions` — List sessions
- `POST /payout-sessions` — Create session (DRAFT)
- `POST /payout-sessions/:id/lock` — Lock session
- `POST /payout-sessions/:id/complete` — Complete session
- `GET /payout-sessions/:id` — Get detail + ledger

### Ledger
- `GET /payout-sessions/:sessionId/ledger` — List ledger entries

### Admin
- `POST /admin/assets` — Create asset
- `GET /admin/assets` — List assets
- `PATCH /admin/assets/:id` — Update asset
- `DELETE /admin/assets/:id` — Delete asset
- `POST /admin/templates` — Create template
- `GET /admin/templates` — List templates
- `PATCH /admin/templates/:id` — Update template
- `DELETE /admin/templates/:id` — Delete template
- `POST /admin/users` — Create user (Admin only)

### Template Apply
- `POST /templates/:templateId/apply/:userId` — Apply template to user

### Integrity
- `GET /admin/integrity-check` — Scan chain integrity violations

## Environment

```bash
DATABASE_URL=postgresql://...
SHADOW_DATABASE_URL=postgresql://...
PORT=3000
JWT_SECRET=your-secret
```

## Tech Stack
- NestJS
- Prisma (PostgreSQL)
- Swagger/OpenAPI
