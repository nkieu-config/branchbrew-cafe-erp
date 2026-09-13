# BranchBrew ERP

[![CI](https://github.com/nkieu-config/branchbrew-cafe-erp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nkieu-config/branchbrew-cafe-erp/actions/workflows/ci.yml)

![Next.js 16](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-149ECA?logo=react&logoColor=white)
![NestJS 11](https://img.shields.io/badge/NestJS_11-E0234E?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Prisma 7](https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

**A multi-branch cafe operations platform for point of sale, inventory, kitchen operations, finance, and HR.**

Built independently to connect everyday cafe workflows across multiple branches.

[Live Demo](https://branchbrew-cafe-erp.vercel.app) · [Demo Guide](docs/demo.md) · [Architecture](docs/architecture.md)

<p align="center">
  <img src="docs/images/dashboard.png" alt="BranchBrew dashboard showing branch sales, orders, gross margin, revenue trends, and inventory alerts" width="100%" />
</p>

<p align="center"><em>A single dashboard for a branch's daily operations.</em></p>

## Overview

BranchBrew brings the main workflows of a growing cafe chain into one system. Teams can take orders, send them to the kitchen, keep ingredient stock up to date, manage suppliers and staff, and review financial performance from the same platform.

The core workflow is:

```text
POS sale → inventory update → kitchen ticket → loyalty and accounting updates
```

## Key features

- **Point of Sale** — sell products with modifiers, promotions, member lookup, and payment tracking.
- **Kitchen Display** — track new and in-progress orders with live updates.
- **Inventory** — manage batches and expiry dates, deduct stock from the batch that expires first (FEFO), and record stocktakes, transfers, and waste.
- **Procurement and production** — manage purchase orders, supplier payments, bills of materials, and central kitchen production.
- **Finance and reporting** — review journal entries, profit and loss (P&L) trends, accounts payable aging reports, and output VAT reports.
- **Staff and customers** — manage shifts, attendance, leave, payroll, customer loyalty, and branch-level access.

## Try the live demo

1. Open the [live demo](https://branchbrew-cafe-erp.vercel.app).
2. Choose the one-click **Manager** demo account, or sign in with `manager@branchbrew.dev` / `password123`.
3. Go to **POS → Terminal**, add an **Iced Latte**, and complete the sale.
4. Open **Kitchen Display** to see the ticket, then open **Finance → Ledger** to find the posted journal entry.

> [!NOTE]
> The demo runs on free-tier hosting. The first API request after inactivity can take about 30 seconds, and demo data is reset on a schedule.

More roles, seeded scenarios, and a 15-minute walkthrough are available in the [demo guide](docs/demo.md).

## See it in action

<p align="center">
  <img src="docs/images/demo.gif" alt="A BranchBrew sale moving from the dashboard and POS to the kitchen display and general ledger" width="100%" />
</p>

<p align="center"><em>One sale from product selection to kitchen preparation and a posted ledger entry.</em></p>

## Feature snapshots

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/images/pos-terminal.png" alt="BranchBrew POS terminal with menu items, modifiers, member lookup, promotion code, and checkout summary" width="100%" />
    </td>
    <td width="50%" valign="top">
      <img src="docs/images/kds.png" alt="BranchBrew kitchen display with tickets grouped into New and Cooking lanes and a live connection indicator" width="100%" />
    </td>
  </tr>
  <tr>
    <td align="center"><em>POS terminal — modifiers and checkout in one workflow.</em></td>
    <td align="center"><em>Kitchen display — tickets update as work moves through the kitchen.</em></td>
  </tr>
</table>

<p align="center">
  <img src="docs/images/finance-ledger.png" alt="BranchBrew general ledger showing posted journal entries generated from cafe operations" width="100%" />
</p>

<p align="center"><em>Finance ledger — operational activity becomes traceable financial records.</em></p>

## My role

I designed and built the application end-to-end:

- the product workflows and multi-branch domain model
- the Next.js frontend and responsive interfaces for daily operations
- the NestJS API, database schema, authentication, and authorization
- inventory, procurement, production, HR, CRM, and accounting workflows
- unit, integration, end-to-end, and load-test coverage
- Docker-based local development and the hosted demo deployment

## Tech stack

| Area | Technologies |
| --- | --- |
| **Frontend** | Next.js 16, React 19, TanStack Query, Ant Design, Tailwind CSS |
| **Backend** | NestJS 11, Prisma 7, Socket.IO, transactional outbox |
| **Database** | PostgreSQL |
| **Contracts** | Swagger/OpenAPI export, generated frontend API types, shared TypeScript enums |
| **Quality and delivery** | Jest, Vitest, Playwright, k6, Docker, GitHub Actions, Trivy |

## Run locally

Requires Docker Desktop and Node.js 22 with npm.

```bash
cp infra/.env.compose.example infra/.env.compose
npm run docker:up
```

The web app starts at [localhost:3001/login](http://localhost:3001/login), the API at [localhost:3000](http://localhost:3000), and Swagger UI at [localhost:3000/docs](http://localhost:3000/docs). Database migrations and demo data seeding run automatically.

> [!CAUTION]
> Seeding wipes the target database. Use a local or intentional demo database only.

For manual setup, environment variables, deployment, and alternative Docker Compose modes, see the [infrastructure guide](infra/README.md).

## Engineering highlights

- **Reliable side effects** — a sale and its related events are committed together, so inventory, kitchen, loyalty, and accounting can update from the same operation. [Architecture details](docs/architecture.md#transactional-outbox)
- **Branch-aware access control** — roles and branch scope are enforced consistently across operational data. [Security model](docs/architecture.md#authentication-and-authorization)
- **Typed frontend–backend contract** — frontend API types are generated from the backend's OpenAPI contract, with CI checks for drift. [Contract flow](docs/architecture.md#typed-contract-across-the-stack)
- **Real-time operational UI** — Kitchen Display updates through Socket.IO and updates existing data without reloading the entire board. [Frontend architecture](docs/architecture.md#frontend-architecture)

## Performance investigation: 9m34s to under one second

A load test exposed an outbox bottleneck that left the ledger several minutes behind during a sustained rush. After changing the processor to drain until empty, measured lag stayed under one second while handling the tested arrival rate of up to 150 events per second. [Load-test method and results](loadtest/README.md)

## Documentation

- [Architecture](docs/architecture.md) — system boundaries, event flow, consistency decisions, and trade-offs.
- [Data model](docs/data-model.md) — ERD, database invariants, numeric types, and branch scoping.
- [Demo guide](docs/demo.md) — demo accounts, walkthroughs, and seeded scenarios.
- [Design system](docs/design-system.md) — design tokens, forms, responsive behavior, and UI conventions.
- [Infrastructure](infra/README.md) — Docker, environment files, and deployment reference.
- [Load test](loadtest/README.md) — checkout and outbox performance testing.
- [Privacy](docs/privacy.md) — personal-data handling and known privacy gaps.

## Limitations and next steps

- Single-instance deployment with poll-based outbox delivery.
- Uses standard costing instead of weighted-average costing, supports whole-order refunds only, and currently covers output VAT only.
- No fiscal periods or period close yet.
- Stock quantities still use `Float`; moving them to `Decimal` and adding reconciliation remain roadmap items.

The reasoning behind these choices is documented in the [architecture trade-offs](docs/architecture.md#deliberate-trade-offs).
