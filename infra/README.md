# BranchBrew ERP — Infrastructure & Deployment

Compose files, environment templates, and deployment reference for BranchBrew ERP: local Docker stack, production modes (managed or bundled Postgres), and optional TLS for a self-hosted VPS.

Part of the [BranchBrew monorepo](../). See [`docs/architecture.md`](../docs/architecture.md#deployment) for the deployment topology and its trade-offs.

## Quick start (local)

```bash
cp infra/.env.compose.example infra/.env.compose
npm run docker:up
```

Open [localhost:3001/login](http://localhost:3001/login) and sign in with `manager@branchbrew.dev` / `password123`.

Migrations run automatically via the one-shot `migrate` service, and the demo seed runs via the one-shot `seed` service whenever the database has no users. The API is on [localhost:3000](http://localhost:3000), with Swagger UI at [localhost:3000/docs](http://localhost:3000/docs) on the dev image.

To reload demo data at any point:

```bash
npm run docker:seed
```

> [!CAUTION]
> `docker:seed` wipes the database before reloading demo data. It re-runs the seed inside the Docker network, so no host Postgres port is needed.

## Commands

| Script                   | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run docker:up`      | Build and start db, migrate, seed, backend, frontend                |
| `npm run docker:down`    | Stop the local stack                                                |
| `npm run docker:seed`    | Wipe and reload demo data (runs seed container with `FORCE_SEED=1`) |
| `npm run docker:up:prod` | Production-oriented compose (`docker-compose.prod.yml`)             |

## Environment files

All env templates live in `infra/` because they are used by Compose, not by `backend/.env` (local Nest dev).

| File                    | Committed       | Who uses it                                                             |
| ----------------------- | --------------- | ----------------------------------------------------------------------- |
| `.env.compose.example`  | yes             | **Developers** — copy to `.env.compose` for local Docker                |
| `.env.compose`          | no (gitignored) | Your local secrets; read by `docker:up` / `docker:down` / `docker:seed` |
| `.env.compose.ci`       | yes             | **CI only** — `scripts/docker-compose-smoke.sh` on GitHub Actions       |
| `.env.supabase.example` | yes             | **Deploy reference** — Supabase / hosted production variable names      |

### `.env.compose.example` → `.env.compose`

For local stack (`docker-compose.yml`): Postgres credentials, `JWT_SECRET`, `NEXT_PUBLIC_API_URL`.

```bash
cp infra/.env.compose.example infra/.env.compose
```

### `.env.compose.ci`

Fixed non-production values so CI can run `docker compose up` and smoke tests without a private env file.

> [!WARNING]
> Do not copy or edit this file for daily development. CI reads it directly, and changes will break the pipeline.

### `.env.supabase.example`

Not copied directly for `docker:up`. Use it when:

- Filling **hosting provider secrets** (Railway, Fly, VPS, etc.), or
- Building `infra/.env.compose` for `npm run docker:up:prod` with external Postgres (Supabase)

Production vars include `DATABASE_URL` (pooler), `DIRECT_URL` (migrations), `CORS_ORIGIN`, and `JWT_SECRET` (≥ 32 chars).

## Compose files

| File                          | Use                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`          | Local stack — backend dev image (Swagger on), bundled Postgres                                       |
| `docker-compose.prod.yml`     | Production-like — resource limits, production images, managed Postgres by default                    |
| `docker-compose.caddy.yml`    | Optional TLS overlay (Caddy + Let's Encrypt) for self-hosted VPS deploys                             |
| `docker-compose.ci-smoke.yml` | CI smoke stack from pre-built `erp-*:ci` images                                                      |
| `docker-compose.loadtest.yml` | Load-test overlay — publishes the DB port and raises the API throttle (`npm run docker:up:loadtest`) |

### Postgres access

The database sits on an internal-only Docker network with **no host port** (published
ports do not work on internal networks, and the demo stack never needs one). To reach psql:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env.compose exec db \
  psql -U erp_user erp_db
```

The load-test overlay is the one exception: it attaches the database to a second, non-internal network and publishes 5432, so the outbox-lag reporter can read `OutboxEvent` from the host. See [loadtest/README.md](../loadtest/README.md).

## Production deployment

### Database modes

`docker-compose.prod.yml` defaults to a **managed Postgres** (Supabase — set `DATABASE_URL`/`DIRECT_URL`);
only migrate/backend/frontend start. For a self-hosted all-in-one stack, opt in to the bundled Postgres:

```bash
docker compose -f infra/docker-compose.prod.yml --profile local-db \
  --env-file infra/.env.compose up --build
```

(with `DATABASE_URL=postgresql://user:password@db:5432/erp_db?schema=public`)

### TLS on a VPS (optional)

PaaS platforms (Vercel/Railway/Fly) terminate TLS themselves. For a bare VPS, stack the Caddy overlay:

```bash
DEMO_DOMAIN=demo.example.com API_DOMAIN=api.example.com \
BACKEND_PORT=127.0.0.1:3000 FRONTEND_PORT=127.0.0.1:3001 \
docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.caddy.yml \
  --env-file infra/.env.compose up -d --build
```

`BACKEND_PORT`/`FRONTEND_PORT` bound to loopback keep the app ports off the public internet;
Caddy provisions Let's Encrypt certificates for both domains automatically.

### Hosted demo (Vercel + Render)

The live demo splits across two free tiers, both fed by the Supabase managed Postgres:

- **Frontend → Vercel.** Root Directory `frontend`, `NEXT_PUBLIC_API_URL=/backend`, `INTERNAL_API_URL=<render-api-url>`. The Next.js config rewrites `/backend/*` to the API so all traffic is same-origin, which keeps the auth cookie first-party to the Vercel domain, which is what the server-side session gate reads (a cross-origin cookie would be invisible to it and loop the login page). Socket.io falls back to long-polling through the same rewrite because Vercel can't upgrade WebSockets.
- **API → Render.** Provisioned from [`render.yaml`](../render.yaml) (backend Docker target). Secrets: `DATABASE_URL` (Supabase **pooler**, port 6543 — the direct 5432 host is IPv6-only and unreachable from Render), `DIRECT_URL`, `CORS_ORIGIN=<vercel-url>`, `JWT_SECRET` (auto-generated). Free instances sleep after ~15 min idle; the first request wakes them in ~30–60s.
- **Demo data** is reseeded by [`refresh-demo.yml`](../.github/workflows/refresh-demo.yml) (repo secrets `DEMO_DATABASE_URL` / `DEMO_DIRECT_URL`), which also keeps the Supabase project from pausing on inactivity. Schema changes are applied by [`migrate-demo.yml`](../.github/workflows/migrate-demo.yml); the Render deploy itself never runs migrations.
