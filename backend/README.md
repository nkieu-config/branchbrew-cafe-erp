# BranchBrew ERP — Backend

NestJS API for a multi-branch coffee-shop ERP: point of sale, kitchen display, inventory and batch tracking, procurement, production/BOM, HR and payroll, CRM loyalty, and double-entry accounting.

Part of the [BranchBrew monorepo](../). See [`docs/architecture.md`](../docs/architecture.md) for the system deep dive, [`docs/demo.md`](../docs/demo.md) for a guided demo, and [`infra/README.md`](../infra/README.md) for Docker/deployment.

## Stack

- **NestJS 11** (feature-module architecture) on **Node 22**
- **Prisma 7** + **PostgreSQL**
- **Passport JWT** over httpOnly cookies, with token-version revocation
- **socket.io** WebSocket gateway for real-time KDS updates
- **@nestjs/event-emitter** + a transactional outbox for reliable post-commit side effects
- **class-validator** DTOs, **Swagger** contract export, **Jest** unit + e2e

## Where the code lives

Feature modules sit directly under `src/`, one directory per domain.

| Path                                     | What's in it                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/outbox/`                            | The transactional outbox — the drain loop and the event → handler registry                   |
| `src/orders/`                            | POS checkout — the transaction that deducts stock, writes the order, and enqueues its events |
| `src/inventory/`                         | Batch tracking, expiry, transfers, waste, stocktakes                                         |
| `src/common/helpers/inventory.helper.ts` | FEFO deduction — first-expired-first-out batch selection                                     |
| `src/accounting/` · `src/finance/`       | Journal entries from domain events; P&L, AP aging, VAT reporting                             |
| `src/auth/`                              | JWT over httpOnly cookies, token-version revocation, and `branch-scope.util.ts`              |
| `src/realtime/`                          | socket.io gateway pushing tickets to the kitchen display                                     |
| `src/common/`                            | `decimal.util.ts` (money math), `vat.util.ts`, exception filters, middleware                 |
| `src/prisma/`                            | Prisma service, schema, migrations, seed scripts                                             |

**If you read one thing, read [`src/outbox/`](src/outbox/).** The system's consistency rests on it, and [`outbox.processor.ts`](src/outbox/outbox.processor.ts) is the file the load test forced me to rewrite (see [Performance](../README.md#performance--the-bottleneck-the-load-test-found-and-the-fix)). Why the modules are drawn this way: [`docs/architecture.md`](../docs/architecture.md).

## Setup

Everything after `npm install` is a workspace script: run it from `backend/`, not the monorepo root. (From the root, the equivalents are `npm run migrate`, `npm run db:seed`, and `npm run dev:backend`.)

```bash
npm install                  # once, from the monorepo root
cd backend
cp .env.example .env         # then fill DATABASE_URL, JWT_SECRET, CORS_ORIGIN
npm run migrate:deploy       # apply migrations
npm run db:seed              # optional: load demo data
npm run start:dev            # http://localhost:3000
```

> [!CAUTION]
> `npm run db:seed` wipes the target database before loading demo data. Check `DATABASE_URL` before running it.

## Tests

From `backend/`:

```bash
npm run test         # unit tests (Jest)
npm run test:e2e     # e2e tests against a test database
npm run test:cov     # coverage
```

## API documentation

- Swagger UI at [localhost:3000/docs](http://localhost:3000/docs) (development only)
- `openapi.json` is committed and regenerated with `npm run openapi:export`; the frontend generates its typed client from it, and CI fails on drift.
- Health check at `GET /health`.
