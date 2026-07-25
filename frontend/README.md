# BranchBrew ERP — Frontend

Next.js App Router UI for the BranchBrew coffee-shop ERP: POS terminal, kitchen display (KDS), dashboard, inventory, procurement, HR, finance, and CRM.

Part of the [BranchBrew monorepo](../). See [`docs/demo.md`](../docs/demo.md) for a guided walkthrough with demo logins, and [`docs/design-system.md`](../docs/design-system.md) for the design-token architecture and UI conventions.

## Stack

- **Next.js 16** (App Router) + **React 19** on **Node 22**
- **TanStack Query 5** for server state
- **Ant Design 6** + **Tailwind CSS 4**
- **socket.io-client** for real-time KDS
- Typed API client generated from the backend's OpenAPI schema
- **Vitest** unit tests, **Playwright** e2e

## Where the code lives

| Path                                  | What's in it                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/app/(app)/` · `src/app/(auth)/`  | Route groups — the authenticated shell and the login flow                             |
| `src/hooks/useKdsSocketSync.ts`       | WebSocket events patch the TanStack Query cache, so the kitchen board never refetches |
| `src/lib/auth/server.ts`              | `getSession` — server-side auth gating, before a protected layout renders             |
| `src/lib/query-keys/`                 | Every cache key and cross-resource invalidation, in one place                         |
| `src/lib/money.ts` · `src/lib/vat.ts` | Money and VAT math, unit-tested against the same rules as the backend                 |
| `src/types/generated/api.d.ts`        | Client types generated from the backend contract — never edited by hand               |

**If you read one thing, read [`src/hooks/useKdsSocketSync.ts`](src/hooks/useKdsSocketSync.ts)** — the cache-patching path that keeps a busy kitchen from re-downloading the whole board on every ticket.

## Conventions

- Auth gating is server-side: `getSession` (`src/lib/auth/server.ts`) runs before a protected layout renders.
- Cache keys and cross-resource invalidations live in `src/lib/query-keys/`. Add new ones there rather than inline.
- Realtime updates patch the TanStack Query cache via `setQueryData` (`useKdsSocketSync`) rather than refetching.

Why it is built this way: [`docs/architecture.md`](../docs/architecture.md#frontend-architecture) and [`docs/design-system.md`](../docs/design-system.md).

## Setup

Everything after `npm install` is a workspace script: run it from `frontend/`, not the monorepo root. (From the root, use `npm run dev:frontend`.)

```bash
npm install                  # once, from the monorepo root
cd frontend
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL (defaults to http://localhost:3000)
npm run dev                  # http://localhost:3001
```

The backend must be running (see [`../backend/README.md`](../backend/README.md)).

## API types

The client types in `src/types/generated/api.d.ts` are generated from the backend contract:

```bash
npm run generate:api         # from frontend/ — reads ../backend/openapi.json
```

> [!NOTE]
> Never edit the generated types by hand; regenerate them instead. CI fails on any drift between `openapi.json` and the committed client types.

## Tests

From `frontend/`:

```bash
npm run test         # unit tests (Vitest)
npm run test:cov     # coverage
npm run test:e2e     # end-to-end (Playwright)
```
