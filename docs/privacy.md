# BranchBrew ERP — Personal data

What personal data the system holds, why it holds it, and what happens when someone asks for it back. Thailand's PDPA is the reference point; this is a portfolio deployment, so the roadmap at the bottom is as important as the table.

## What is collected

| Data | Where | Why it exists | Lawful basis | Retention |
| ---- | ----- | ------------- | ------------ | --------- |
| Member name, phone | `Customer` | Loyalty points earned and redeemed at the till | Consent, given when the member signs up at the counter | Until erasure is requested |
| Loyalty points, tier | `Customer` | The benefit the member signed up for | Consent | Until erasure is requested |
| Purchase history | `Order.customerId` | Tier calculation, and the sale itself | Contract | Kept — it is accounting data |
| Tax-invoice buyer name, tax ID, address | `Order.taxInvoiceName` / `taxInvoiceTaxId` / `taxInvoiceAddress` | Issuing a full-form tax invoice on request | **Legal obligation** | 5 years, per the Revenue Code |
| Employee name, email, salary, attendance, leave reasons | `User`, `Payslip`, `AttendanceRecord`, `LeaveRequest` | Employment and payroll | Contract | Employment plus statutory payroll retention |
| Supplier contact name, email, phone | `Supplier` | Procurement correspondence | Contract | Life of the supplier relationship |

## Who can see member data

The till and the back office need different things, so they get different access.

| Endpoint | Who | Why |
| -------- | --- | --- |
| `GET /customers/phone/:phone` | Any signed-in employee | A barista needs to attach points to the member standing in front of them, and already knows the phone number |
| `GET /customers`, `GET /customers/:id`, `GET /customers/:id/360` | Manager, super admin | Browsing the member directory or a member's full order history is a back-office task, not a till task |
| `POST /customers`, `PATCH /customers/:id` | Manager, super admin | Registration happens in the CRM screen |
| `DELETE /customers/:id` | Super admin | Erasure requests |

Order and kitchen-display payloads carry only the member's id, name and tier. The phone number is never included, so it cannot be harvested from `GET /orders`, the KDS queue, or the WebSocket feed. `backend/test/customer-erasure.e2e-spec.ts` asserts all of this against a real database.

## Erasure

`DELETE /customers/:id` anonymizes rather than deletes:

- Phone becomes `deleted-{id}`, name becomes a placeholder, points reset to zero, `anonymizedAt` is stamped.
- The row itself stays, because orders reference it. Deleting it would rewrite past revenue and put the general ledger out of step with operations.
- The change and its audit row commit in one transaction, so an erasure cannot happen without a record of who performed it.

**Tax invoices are deliberately not erased.** Where a member asked for a full-form tax invoice, the buyer details on that order are retained for five years under the Revenue Code. The lawful basis there is legal obligation, which survives a withdrawal of consent — so the CRM record is anonymized while the tax document stays intact.

## Known gaps

- Reads of personal data are not logged. Only mutations reach the audit log, so an erasure is recorded but a lookup is not.
- Consent is implied by registration rather than stored as a record with a timestamp and a version.
- Employee data has no erasure path; it is out of scope for the demo.
- There is no retention job. Nothing expires on its own.
