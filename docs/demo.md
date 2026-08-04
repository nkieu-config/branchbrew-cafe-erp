# BranchBrew ERP — Demo Guide

Portfolio demo script for reviewers and interview walkthroughs. New here? Start at the [project README](../README.md).

**Fastest path: the [live demo](https://branchbrew-cafe-erp.vercel.app).** Click a demo account on the login page and follow the walkthrough below. To run it locally, use the quick start below.

> **Warning:** `npm run db:seed` wipes the target database before inserting demo data. Use only on a local database or an intentional demo/staging instance.

## Quick start

One command with Docker (`npm run docker:up`, see the [root Quick start](../README.md#quick-start)), or local Node against a running Postgres:

```bash
npm install
cp backend/.env.example backend/.env   # set DATABASE_URL, JWT_SECRET
npm run migrate
npm run db:seed
npm run dev:backend   # terminal 1, port 3000
npm run dev:frontend  # terminal 2, port 3001
```

Open [localhost:3001/login](http://localhost:3001/login)

### Remote / staging database

If `DATABASE_URL` points to a remote host (e.g. Supabase), the seed guard blocks by default:

```bash
ALLOW_DEMO_SEED=true DEMO_SEED_CONFIRM=WIPE_DEMO_DATABASE npm run db:seed
```

---

## 60-second path

Login as **Manager**, then run steps 1–4 of [Flow A](#flow-a--sell-5-min): sell an Iced Latte and find its `ORD-` journal entry under **Finance → Ledger**.

---

## Cheat sheet

| Item                             | Value                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Password (all accounts)**      | `password123`                                                                                     |
| **Primary demo login**           | `manager@branchbrew.dev` — Downtown Manager                                                       |
| **Super Admin**                  | `admin@branchbrew.dev` — all branches                                                             |
| **POS cashier**                  | `staff.downtown@branchbrew.dev` — Downtown Cashier                                                |
| **Riverside Manager**            | `manager.riverside@branchbrew.dev`                                                                |
| **Riverside Barista**            | `staff.riverside@branchbrew.dev`                                                                  |
| **CRM member phone**             | `0811111111` — Demo Member, 120 pts, SILVER                                                       |
| **Promo codes**                  | `WELCOME10` (10% off, min 100) · `SAVE20` (20 baht off, min 150)                                  |
| **PO to receive (live)**         | `PO-DEMO-001` — APPROVED @ Downtown                                                               |
| **PO to pay (live)**             | `PO-DEMO-005` — RECEIVED · UNPAID, ~40 days old (AP aging 31–60 bucket)                           |
| **Hero ledger chain**            | `PO-DEMO-003` (received beans) → `ORD-*` sale (2× Iced Latte) → `PAY-PO-DEMO-003` (supplier paid) |
| **Stock count to finish (live)** | Draft "Weekly spot check" @ Downtown — Inventory → Stocktake                                      |
| **Notifications**                | Bell in the top bar — unread PO approval + expiring batches @ Downtown                            |
| **Currency**                     | THB (฿) — Settings → Default currency                                                             |
| **KDS**                          | Open tickets at Downtown (5+) and Riverside (1) after seed                                        |

Use the **Demo accounts** buttons on the login page for Manager, Admin, Staff, and Riverside Manager.

---

## Branches

| Branch                         | Role in demo                                                |
| ------------------------------ | ----------------------------------------------------------- |
| **Downtown Branch**            | Primary — POS, KDS, finance, HR                             |
| **Riverside Branch**           | Second site — low stock alerts, Riverside KDS               |
| **BranchBrew Central Kitchen** | Production / BOM / kitchen kanban (select in branch picker) |

---

## 15-minute demo script

### Flow A — Sell (≈5 min)

**Login:** `manager@branchbrew.dev`

1. **Dashboard** (`/`) — Today's sales vs yesterday, gross margin & food-cost %, revenue chart (flip **7D/30D**, note the order-count overlay), top-5 sellers with revenue, inventory alerts. Widgets are draggable, and the layout persists.
2. **POS** (`/pos/terminal`) — Pick **Iced Latte**, add modifiers. Optional: lookup member `0811111111`, apply `WELCOME10`. At checkout enter cash received (quick buttons ฿100/฿500 or **Exact**). Pay stays disabled until the cash covers the total, then shows change due.
3. **KDS** (`/kds`) — Show pending/preparing tickets and the **All-day** per-item tally strip; complete one ticket.
4. **Orders** (`/pos/orders`) — Refunded and promo orders from seed.

**Story to tell:** Order → recipe stock deduction → accounting journal (event-driven) → real-time KDS.

---

### Flow B — Supply (≈5 min)

**Login:** `manager@branchbrew.dev` or `admin@branchbrew.dev`

1. **Procurement** (`/procurement/orders`) — Find **PO-DEMO-001** (APPROVED). Receive goods. Note the **PAID / UNPAID** badges on received POs.
2. **Inventory** (`/inventory`) — Stock levels; note low cups @ Riverside.
3. **Batches** (`/inventory/batches`) — Expiring in 3 days; expired oat milk @ Downtown.
4. **Stocktake** (`/inventory/stocktake`) — Open the approved **month-end blind count** (variances valued in baht, posted to the ledger as `STOCKCOUNT-*`), then finish the draft **"Weekly spot check"**: enter a counted quantity, submit, and approve.
5. **Transfers** (`/inventory/transfers`) — Pending and shipped transfers.

**Story to tell:** PO → receive → batch/expiry → physical count → variance posts shrinkage to the GL → inter-branch transfer.

---

### Flow C — Operate (≈5 min)

**Login:** `manager@branchbrew.dev`

1. **Notifications** — Click the **bell** in the top bar: unread PO-approval and expiring-batch alerts; click one to jump to the page (it marks itself read).
2. **HR / Attendance** (`/hr/attendance`) — Manager currently clocked in.
3. **Payroll** (`/hr/payroll`) — Approved run (last month) + draft @ Riverside. Approving a run posts gross pay, withholdings, and net cash to the ledger (`PAYROLL-*`).
4. **Finance overview** (`/finance/overview`) — **Accounts payable card**: ฿400 outstanding in the 31–60 day bucket (`PO-DEMO-005`). Pay it from Procurement and watch the card empty. **Output VAT (ภ.พ.30) card**: monthly sales ex-VAT vs output VAT. Below: pending shift settlement @ Downtown.
5. **Ledger** (`/finance/ledger`) — Search **`PO-DEMO-003`** (bean receive: inventory at the ฿0.50/g standard, AP at the ฿0.45/g invoice, ฿50 to purchase price variance), the matching **`ORD-`** hero sale (revenue split into ex-VAT sales + output VAT), and **`PAY-PO-DEMO-003`** (the payment that settled AP).
6. **Trial balance** (`/finance/trial-balance`) — Every account with a balance; total debits equal total credits.

**Story to tell:** Attendance → payroll → settlement → general ledger, and the AP account balance reconciles to the unpaid-PO list on the aging card.

---

### Flow D — Produce (≈3 min)

**Login:** `admin@branchbrew.dev`, pick **BranchBrew Central Kitchen** in the branch picker

1. **Central Kitchen** (`/kitchen`) — Kanban board: planned / in-progress / completed cold-brew production orders.
2. **Production BOM** (`/kitchen/boms`) — Cold brew base recipe (espresso beans per ml).
3. Completing a production order consumes raw batches FEFO, creates a finished-goods batch, and posts any standard-cost variance to account 5030.

**Story to tell:** Central kitchen produces intermediates → finished batches transfer out to branches.

---

### Flow E — Try to break the books (≈2 min)

**Login:** `manager@branchbrew.dev`

1. **Orders** (`/pos/orders`) — Void the sale from Flow A.
2. **Ledger** (`/finance/ledger`) — The original `ORD-*` entry is untouched; a second entry `VOID-ORD-*` posts the mirror image beside it.
3. **Trial balance** (`/finance/trial-balance`) — Still balances.

**Story to tell:** The ledger is append-only. A mistake is corrected by a new entry, never by editing or deleting the old one, so history stays intact and the books stay balanced — the same reason a real ledger is auditable.

---

## Super Admin extras

**Login:** `admin@branchbrew.dev`

- Branch picker: **All branches** vs single branch on inventory.
- Approve settlements, organization users/branches.

---

## Seeded edge cases the flows don't reach

- A draft stock count ready to finish live, and a damage adjustment (`ADJ-*`).
- A REJECTED settlement, a REFUNDED order, and the inactive promo `SUMMER24`.
- Audit log at `/settings/audit`, including stock-count approvals and supplier payments.

To reset demo data, re-run `npm run db:seed` (see warning at top).

Supporting modules (assets, equipment registry) are there for breadth. The flows above are where the design work is.
