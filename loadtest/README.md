# BranchBrew ERP — Load test (POS checkout and outbox lag)

Part of the [BranchBrew monorepo](../).

This harness measures the two numbers that matter for the checkout path:

1. **Checkout latency** — how long `POST /orders` takes, the synchronous work a barista waits for: FEFO batch deduction, stock guards, order write, and the outbox insert, all in one transaction.
2. **Outbox lag** — how long the _asynchronous_ side effects take afterwards: the journal entry, the loyalty points, and the kitchen-display push. This is the number that says what "the ledger trails operations by a moment" actually means in seconds.

## Run it

The load-test stack publishes Postgres on `localhost:5432` (so the lag reporter can read the outbox) and raises the API rate limit, which otherwise caps traffic at 60 requests/min per IP.

```bash
brew install k6                # macOS — other platforms: https://grafana.com/docs/k6/latest/set-up/install-k6/
npm run docker:up:loadtest     # stack + published DB port + THROTTLE_LIMIT raised
npm run loadtest:stock         # inflate stock so the test measures the system, not an empty fridge
RATE=20 DURATION=30s npm run loadtest   # the baseline row in the results table
```

`RATE` is orders per second and `DURATION` is how long to sustain it. The script runs k6, then waits for the outbox to drain and prints the lag percentiles.

To read lag for a window without running a new test:

```bash
SINCE=2026-07-13T07:55:44.000Z npm run loadtest:lag
```

## What each piece does

| File                                | Role                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `loadtest/checkout.js`              | k6 script — logs in once, then posts orders at a constant arrival rate                                           |
| `loadtest/target.json`              | Written by the stock script (gitignored): which product and branch to order                                      |
| `backend/prisma/loadtest-stock.ts`  | Tops up one product's ingredients to 5M units across 12 batches, and refuses to run against a non-local database |
| `backend/prisma/outbox-lag.ts`      | Reads `OutboxEvent`, waits for the queue to drain, reports lag percentiles and drain rate                        |
| `infra/docker-compose.loadtest.yml` | Publishes the DB port and raises the throttle — load-test only, never used by `npm run docker:up`                |

## Reading the results

Checkout latency is comfortably fast and rarely the interesting number. What matters is the relationship between the arrival rate and the outbox drain rate: the speed at which the ledger, the loyalty points, and the kitchen display catch up with what the till has already sold.

This harness is what found the original bottleneck: the processor polled once every 10 seconds for a batch of 10 events, so it applied at most **one event per second** no matter how many orders arrived, and a 30-second rush left the ledger nine and a half minutes behind. It now drains in a loop until the queue is empty and polls every second, which tracks the arrival rate up to the 150 orders/sec I tested, with the lag bounded by the poll interval. The before-and-after numbers are in the main [README](../README.md#performance--the-bottleneck-the-load-test-found-and-the-fix).

If you change `OUTBOX_BATCH_SIZE`, the poll interval, or anything a handler does, re-run this and watch the drain rate: it should stay at or above the arrival rate, and the lag should stay near the poll interval rather than growing with the length of the run.
