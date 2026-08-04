# BranchBrew ERP — Architecture

How BranchBrew ERP is put together, and why. This is the deep-dive companion to the [project README](../README.md); read that first for the one-page overview.

## Goals and non-goals

**Goals.** One rule drove the design: if two numbers in the system can drift apart, the design is wrong. Concretely: the ledger, stock levels, loyalty balances, and realtime state must be written from the same committed facts, and consistency is allowed to be _delayed_ but never _wrong_. Second goal: every hard claim (no lost events, no negative stock, no cross-branch reads) is enforced by the database or proven by a test, not by discipline.

**Non-goals.** Multi-region scale, sub-second ledger latency, and infrastructure beyond one Postgres. This is a portfolio-scale deployment; [Deliberate trade-offs](#deliberate-trade-offs) lists what was knowingly cut (partial refunds, input VAT, weighted-average costing) and why.

## System shape

```mermaid
flowchart LR
  POS["POS terminal"] -->|"REST + httpOnly JWT"| API["NestJS API"]
  API --> PG[("PostgreSQL")]
  API -->|"same transaction"| OB["Transactional outbox"]
  OB --> ACC["Accounting handler — journal entries"]
  OB --> LOY["Loyalty handler — points"]
  OB --> NOTIF["Notification handler — alerts"]
  OB --> RT["Realtime gateway"]
  RT -->|WebSocket| KDS["Kitchen display"]
```

```text
backend/          NestJS 11 API — 23 feature modules, Prisma 7, transactional outbox
frontend/         Next.js 16 App Router — POS, KDS, back office (43 pages)
packages/types    Shared enums generated from the Prisma schema
infra/            Docker Compose stacks + deployment reference
docs/             Demo script, design system, this document
scripts/          CI and Docker helper scripts
```

**Why one service and one database, not microservices:** the core guarantee (a business write and its events commit atomically) requires a single transaction boundary. Splitting services turns "the ledger can never disagree with operations" into a distributed-transactions problem, bought before any scale demands it. The module DAG below is what keeps the monolith modular instead of monolithic.

## Module map

The backend is organized as NestJS feature modules with zero `forwardRef`, so the dependency graph is a DAG.

| Domain       | Modules                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Sales        | `orders`, `products`, `modifiers`, `promotions`, `customers` (CRM loyalty)                            |
| Supply chain | `inventory`, `ingredients`, `procurement`, `production` (central kitchen BOM)                         |
| Back office  | `hr`, `finance`, `accounting`, `reports`, `equipment`, `settings`, `audit`                            |
| Platform     | `auth`, `branches`, `notifications`, `outbox`, `realtime`, `navigation`, `common`, `config`, `prisma` |

The schema behind these modules is in [data-model.md](data-model.md): core ERD and the invariants the database itself enforces.

## Where to start reading the code

The fastest path through ~77k lines, following one sale from POS to ledger:

1. [`backend/src/orders/order-creation.service.ts`](../backend/src/orders/order-creation.service.ts) — the heart of the system in one file: a single transaction validates the order, deducts ingredient batches FEFO, and enqueues the outbox events that everything downstream runs on.
2. [`backend/src/outbox/outbox.processor.ts`](../backend/src/outbox/outbox.processor.ts) — claims `PENDING` events in a drain loop until the queue is empty, reclaims events stranded by a dead worker via their stale `claimedAt`, and dispatches through the validated registry in [`outbox-event.registry.ts`](../backend/src/outbox/outbox-event.registry.ts).
3. [`backend/src/accounting/accounting.service.ts`](../backend/src/accounting/accounting.service.ts) — the `@OnEvent` handlers that turn domain events into balanced journal entries, deduping on the unique `reference` so at-least-once delivery never double-posts.
4. [`backend/src/auth/branch-scope.util.ts`](../backend/src/auth/branch-scope.util.ts) — the one authorization primitive every branch-owned endpoint resolves through.
5. The tests that prove the hard claims: [`order-void-concurrency.e2e-spec.ts`](../backend/test/order-void-concurrency.e2e-spec.ts) (racing voids against real Postgres), [`outbox-stale-claim.e2e-spec.ts`](../backend/test/outbox-stale-claim.e2e-spec.ts) (recovery from a worker that dies mid-dispatch), and the cross-branch 403 in [`finance.e2e-spec.ts`](../backend/test/finance.e2e-spec.ts).

Money math lives in [`common/decimal.util.ts`](../backend/src/common/decimal.util.ts) and [`common/vat.util.ts`](../backend/src/common/vat.util.ts). On the frontend, start at `frontend/src/lib/query-keys/` (cache invalidation map) and `useKdsSocketSync` (realtime cache patching).

## Transactional outbox

This is the core reliability decision in the system. The POS never writes journal entries, awards points, or pushes WebSocket frames directly. Instead:

1. A business write (order placed, PO received, production completed, stocktake approved, payroll approved) commits **together with an outbox event row in the same database transaction**.
2. A dispatcher picks up committed events and fans them out to handlers: accounting, loyalty, notifications, and the realtime gateway.
3. Each event payload is checked by a runtime validator before a handler runs, so a malformed event fails loudly instead of posting garbage.

Delivery is **at-least-once** through both crash windows: an event that commits but never dispatches stays `PENDING`, and one whose worker dies mid-dispatch is reclaimed once its `claimedAt` stamp goes stale. Redelivery is harmless because the ledger dedupes on a unique natural `reference`. Side effects can therefore be delayed, but they cannot desync from committed state. The worst case is an event that exhausts its five attempts and lands in `FAILED`, which is visible in logs but not yet alerted on (see the hardening roadmap below).

Throughput here is measured rather than assumed. A k6 load test caught the original processor, which polled one batch of 10 events every 10 seconds, draining at exactly 1.00 events/sec while the till sold 20 orders/sec. A 30-second rush left the ledger nine and a half minutes behind. Applying an event costs a median of 2 ms, so the limit was the schedule and not the work: the processor was busy 0.3% of the time.

Three changes, each one forced by the last:

1. **Drain until empty.** The processor now claims batch after batch until the queue is empty, instead of one batch per tick. Throughput stops being a function of the poll interval.
2. **A re-entrancy guard.** `@nestjs/schedule` does not prevent a tick from starting while the previous one is still running, and a drain loop on a one-second cron makes overlap the normal case rather than the exception. A single `isDraining` flag keeps exactly one drain in flight; the atomic claim (`updateMany` guarded on `status` + `attempts`) already made concurrent workers safe, so this is about wasted queries, not correctness.
3. **A retry backoff.** A failed dispatch is set back to `PENDING`, so polling ten times faster meant a poison event would burn all five of its attempts in five seconds instead of fifty. Retries now back off exponentially from the `claimedAt` stamp of the last attempt — 30 s, then 60 s, 120 s and 240 s — so a poison event spends its five attempts over seven and a half minutes while a healthy queue drains at full speed. Eligibility is computed per attempt count inside the pickup query itself, so an event still inside its backoff window never occupies a slot in the batch.

Measured after the fix, the drain rate tracks the arrival rate up to the 150 events/sec measured, with lag bounded by the poll interval (p50 0.5 s). The harness is in [loadtest/README.md](../loadtest/README.md); the before-and-after numbers are in the [README's Performance section](../README.md#performance--the-bottleneck-the-load-test-found-and-the-fix).

### Alternatives considered

- **In-process event emitter — the v1 this replaced.** The first version announced a sale with `@nestjs/event-emitter` fired from inside the transaction: the order committed, and the accounting and loyalty listeners ran afterwards on a best-effort basis. A listener that threw, or a process restart at the wrong moment, made the sale real while its journal entry silently never existed. That failure mode is what the outbox exists to close.
- **Message broker (Kafka / RabbitMQ / BullMQ).** A broker publish cannot join the Postgres transaction, so a broker does not remove the outbox; it sits behind one, adding a second piece of stateful infrastructure to operate. At one service and one database, Postgres itself is a perfectly good queue; a broker earns its place when there are multiple producing services or consumers that need independent scaling, neither of which exists here.
- **`LISTEN`/`NOTIFY`.** Pushing events instead of polling would cut the median lag from 0.5 s to single-digit milliseconds. Rejected: it needs a dedicated connection held outside Prisma's pool, and it does not remove the cron anyway — retries and stale claims still need a periodic sweep, so `LISTEN`/`NOTIFY` would be a second delivery path layered on top of the one that already exists. Half a second of lag on a coffee-shop ledger does not buy that.

Known hardening still on the roadmap: an operator replay path for `FAILED` events (terminal today, visible only in logs), jitter on the retry backoff, and payload schema versioning.

## Event-driven double-entry accounting

Every money-moving domain event posts a balanced journal entry. The same events that move stock and cash also write the ledger, so the operational numbers and the accounting numbers agree by construction.

| Event                       | Journal entry                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| POS sale                    | Revenue split into ex-VAT sales + output VAT liability, plus COGS from the recipe cost          |
| Refund / void               | Reversing entry; deducted batches are restored                                                  |
| PO goods received           | Inventory at standard, AP at the invoice, gap to purchase price variance (5035)                 |
| Supplier payment            | Settles AP — the AP account balance reconciles to the unpaid-PO list on the aging card          |
| Payroll approved            | Gross pay, withholdings, and net cash                                                           |
| Stocktake variance approved | Shrinkage expense; batches adjusted FEFO                                                        |
| Production completed        | Finished goods at standard cost; any cost variance posts to a dedicated variance account (5030) |

Reporting built on top: P&L trend, AP aging, and a ภ.พ.30-style output VAT report with CSV export.

### Trial balance

`GET /accounting/trial-balance` nets every posted line onto its account's normal side and returns both column totals with an `isBalanced` flag. Filters drop whole entries, never single lines, so any slice still balances. A branch view is balanced but partial, since chain-level entries carry no `branchId`.

That is what makes it a test rather than a screen: `test/trial-balance.e2e-spec.ts` sells through the real POS and asserts `totalDebit === totalCredit` exactly, with no `toBeCloseTo` tolerance.

### The demo ledger is rebuilt from operations

The seed writes rows straight to the database, so nothing enqueues the outbox events that normally produce journal entries. `prisma/seed/portfolio/ledger.ts` runs last, replays every seeded order into the entry the production handler would have posted, then derives an opening balance (cash and stock against owner capital) from the closing position.

It then refuses to finish unless debits equal credits, ledger revenue equals order revenue, and the inventory account equals stock on hand. A seeded order with no entry fails the seed instead of shipping a demo whose accounting disagrees with its dashboard.

### Money is never a float

All financial math runs on `Prisma.Decimal` with explicit rounding scales and a half-up tie-break. Journal entries are validated to balance to the cent before they persist. Loyalty-point redemption is clamped to the discount it can actually absorb, and point clawback on refund floors at zero, so arithmetic edge cases cannot produce a negative balance.

Stock _quantities_ are the exception; see inventory, below.

### Standard costing

Ingredient costs are fixed per unit (`costPerUnit`) rather than recomputed as weighted averages on receipt. That keeps COGS deterministic.

Standard costing only works if the gap between standard and actual has somewhere to go, so both sides post it:

- **Production (5030).** Finished goods in at standard, raw materials out at actual.
- **Purchasing (5035).** Inventory in at standard, accounts payable at the invoice.

Without the purchasing half that gap would pile up in Inventory (1030) forever. The standard cost is captured on the outbox event at receipt, so a later `costPerUnit` edit cannot rewrite a posted entry; a zero cost means "not set up yet", and that line is valued at what was paid.

## Inventory: batches, FEFO, and the stocktake loop

- Stock lives in **batches** with expiry dates. Deduction is first-expired-first-out (FEFO), so the system uses up the milk that expires tomorrow before the carton delivered today.
- The database enforces `CHECK (stock >= 0)` — negative stock is impossible even under concurrent writes.
- **Blind stocktakes** snapshot expected stock at submit time; approved variances adjust batches FEFO and post shrinkage to the ledger. Physical reality corrects the books through the same audited pipeline as everything else.
- Inter-branch transfers do not reserve stock at request time; acceptance claims the `PENDING` transfer with a conditional update before it moves a single batch, so two simultaneous accepts cannot double-move stock.
- **Quantities are `Float`, not `Decimal`** — the one place binary floating point survives. Repeated fractional deductions can drift `BranchInventory.stock` from `SUM(batches.quantity)`; the column migration and a reconciliation job are on the roadmap. Money is unaffected: costing reads `costPerUnit`, a `Decimal`.

## Authentication and authorization

- **JWT in an httpOnly cookie** — no tokens in localStorage, no XSS token theft surface.
- **Token-version revocation** — each user carries a token version. Logout bumps it, and so does any administrative change to a user's branch, role, or password, so demoting, reassigning, or locking out a user kills their live tokens immediately rather than at expiry.
- **Branch-scoped RBAC** — `SUPER_ADMIN` sees all branches; managers and staff resolve branch-owned queries through a shared branch-scope helper (`resolveBranchId` / `assertBranchAccess`) rather than per-endpoint discipline, and an e2e test proves a cross-branch write is rejected with a 403. `Customer` is chain-level and has no `branchId`, because loyalty follows the member across branches. Scoping it by branch would be the wrong fix, so access is gated by role instead: a barista can look up one member by exact phone at the till, while browsing the directory or a member's order history is manager-only. Order and KDS payloads carry no phone number at all. See [privacy.md](privacy.md).
- Login is IP-throttled rather than account-locked, because the demo credentials are public and lockout would let strangers lock reviewers out.

## Typed contract across the stack

The API contract is a build artifact, not a convention:

1. The backend exports `openapi.json` from its Swagger decorators.
2. The frontend generates its client types (`api.d.ts`) from that file.
3. Shared enums in `packages/types` are generated from the Prisma schema.
4. **CI fails if any generated artifact drifts** from its source.

A backend change that breaks the frontend is a compile error and a red pipeline, not a runtime surprise.

## Frontend architecture

- Next.js 16 App Router with a server-layout auth gate — unauthenticated users never render an app shell.
- TanStack Query 5 for server state, with race-safe optimistic updates.
- A typed `ApiError` envelope (error code + request ID) flows from the backend's exception filter into the client.
- Realtime KDS over socket.io with a live connection badge and reconnect toasts.
- Design tokens and form conventions are documented in [design-system.md](design-system.md).

## Testing strategy

464 tests, split by what each layer can actually prove:

| Suite                     | Tests | What it proves                                                                                                             |
| ------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| Backend unit (Jest)       | 241   | Money math and rounding ties, order lifecycle, concurrent-claim guards, outbox reclaim, accounting postings                |
| Backend e2e (supertest)   | 30    | Auth, orders, branch scoping, concurrent order voids, outbox recovery from a dead worker, and an exact-balance trial balance — all against a real Postgres |
| Frontend unit (Vitest)    | 177   | Validators, filters, VAT parity with the backend, API client behavior                                                      |
| Frontend e2e (Playwright) | 16    | Login, full POS checkout, KDS, trial balance, axe accessibility smoke                                                      |

CI additionally runs type-checks, lint, coverage thresholds, a Docker Compose smoke test of the full stack, Trivy image scans, and the generated-artifact drift checks above.

## Deployment

A commit reaches the live demo in minutes, with no manual step:

| Trigger                                        | What runs                                                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git push`                                     | A husky pre-push hook runs the local gate: type-check, lint, and both unit suites. The e2e suites need a database and a running stack, so they are CI's job     |
| Push to `main`                                 | GitHub Actions CI runs; **in parallel**, Vercel rebuilds the frontend and Render rebuilds the API image (`autoDeploy: true` in [`render.yaml`](../render.yaml)) |
| Push to `main` touching `prisma/migrations/**` | [`migrate-demo.yml`](../.github/workflows/migrate-demo.yml) applies pending migrations to the Supabase demo database and fails if any remain pending            |
| Every 3 hours                                  | [`refresh-demo.yml`](../.github/workflows/refresh-demo.yml) reseeds the Supabase demo database so today's sales, orders, and kitchen tickets stay live          |

The frontend is a Vercel project rooted at `frontend/`; the API is a Docker service built from `backend/Dockerfile`. Both talk to the same managed Postgres. The wiring that makes a split-domain deploy work is documented in [infra/README.md](../infra/README.md): the same-origin `/backend` rewrite that keeps the auth cookie first-party, the pooler-versus-direct connection, and free-tier cold starts.

**Trade-off — deploys are not gated on CI.** Vercel and Render start building the moment a commit lands on `main`, in parallel with the CI workflow rather than after it, so CI reports on a deploy that is already happening. The practical gate is the pre-push hook: type-check, lint and the unit suites must pass locally before anything reaches `main`. That is sufficient for a single maintainer but not for a team, because a hook is local and can be bypassed with `--no-verify`. Gating properly means disabling both platforms' auto-deploy and firing their deploy hooks from a CI job that `needs:` the test jobs. That is a known next step.

**Trade-off — the deploy does not run migrations.** Render starts the API image directly, and `migrate-demo.yml` applies migrations on push in parallel with that build rather than before it. So **migrations must stay backward-compatible with the deployed code** — additive columns and indexes, never a rename or a drop in the same release.

## Deliberate trade-offs

Choices made knowingly for a portfolio-scale deployment, with the reasoning:

- **No account lockout** — see [auth](#authentication-and-authorization) above.
- **Standard costing, no weighted average** — see [standard costing](#standard-costing) above; partial PO receipt is likewise out of scope.
- **Whole-order refunds only** — partial refunds multiply the accounting reversal cases without demonstrating a new concept.
- **Output VAT only** — sales post VAT to a liability account; input VAT on purchases is out of scope for the demo.
- **No promotion usage limits** — promo codes validate eligibility but not redemption counts.
- **Pagination on `/orders` only** — it is the list that actually grows, so it is bounded by a 14-day default window and a 500-row cap through a shared `PaginationQueryDto`. Customers, settlements and audit logs are single-digit tables on this deployment; wiring them through the same envelope would be churn without an observable effect.

Roadmap beyond demo scale: pagination across all list endpoints (audit and auth already paginate), branch-scoping and read-auditing for customer records, end-to-end `Decimal` stock quantities with a scheduled reconciliation between branch stock and batch-level quantities, outbox hardening (an operator replay path, jitter on the retry backoff), and metrics with an alert on failed outbox events.
