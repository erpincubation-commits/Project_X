# Purchasing, AP, AR and reporting

## Activate migration 6

Stop desktop/server processes, back up the configured database and upgrade both components together:

```powershell
npm run build
npm run db:migrate
npm start
```

The current application requires schema 8; use the [operations runbook](OPERATIONS_RUNBOOK.md) for the complete upgrade. This section describes the schema 6 trade migration. Tests migrate disposable databases, not the application database. Migration 6 retains existing users, MFA, purchasing, journals and stock; it adds orders, receipts, tax codes, invoices, payments, collections, source journal types and cash-flow categories. Existing configured books gain AR, sales and output-tax mappings. If a custom account already uses 1130, 2120 or 4000, the corresponding system code becomes SYS_AR_6, SYS_OUTPUT_TAX_6 or SYS_SALES_6; custom accounts are preserved. A conflicting fallback code causes migration to fail atomically rather than overwrite data.

Fresh **Initialise INR books** creates twelve system accounts. An installation with existing books does not initialise them again. Migration seeds a zero-rate **NONE** tax code. Configure tax rates explicitly before invoicing. Currency remains INR, with two-place amounts and six-place quantities/unit costs. [TRADE_POSTING_RULES.md](TRADE_POSTING_RULES.md) defines the source posting rules.

## Roles and workspace

Open **Orders & billing** in the desktop. The server controls every grant, regardless of client visibility:

| Role | New grants |
| --- | --- |
| purchasing | Read orders/receipts and issue/cancel orders from approved requests. |
| inventory_manager | Read orders/receipts and post deliveries. No invoice, payment, bank or financial-statement access. |
| accountant | Maintain tax codes, supplier/customer invoices, payment preparation/recording and customer collections; read AP/AR, controls and statements. Cannot approve payments or accept invoice price exceptions. |
| business_approver | Review held supplier invoice exceptions and accept explained price variances independently of the invoice creator. Read/decide only assigned payment batches. No payment execution, bank statement or general ledger access. |
| admin / auditor | Read orders, invoices, payments, tax configuration and financial reports. Existing administrator setup/identity and auditor privileges continue. Neither receives business posting permission by default. |
| requester / reader / identity_admin | No added trade grants. |

Invoice creators alone may revise their drafts. Payment preparers alone may revise, submit or cancel their batches. A different authorised accountant can post an invoice or record a fully approved transfer; assigned payment approvers cannot record its execution even after a role change. All supported permissions remain fixed across nine roles; there are no configurable thresholds or warehouse scopes.

## Purchase order → partial receipt

1. Create an INR purchase request with positive item prices and obtain independent approval through Purchasing.
2. As purchasing, choose **Orders → Issue purchase order**. Select the approved request and active supplier. Quantities, prices and item/unit snapshots come from the request; one PO is allowed per request. A PO is a commitment and has no GL effect.
3. As inventory manager, choose **Receipts** and the issued order. Enter delivery date/reference, active warehouse and accepted/damaged quantities. Describe damaged goods. Leave unreceived order lines at zero; the client excludes them from the receipt.
4. Accepted plus damaged quantity on one delivery cannot exceed the outstanding accepted order quantity. Accepted quantities fulfil the order; damaged quantities do not, so replacement deliveries can be recorded later. Across receipts, accepted quantities can never exceed the order.
5. Accepted stock posts Dr Inventory / Cr GRNI at approved PO cost. Each receipt line links its immutable stock movement and journal. Damage evidence has no stock or GL effect and cannot be invoiced. A damage-only receipt is allowed.

Receipts require an open period; valued inventory cannot be backdated before the latest stock movement. Duplicate delivery references are blocked per order, ignoring surrounding spaces/case. Order versions change after every delivery, so stale receipt attempts fail. Item units become fixed once an order or stock entry uses them. Cancel remaining order quantities with a reason; existing accepted receipts can still be invoiced. Returns, quarantined stock, disposal, supplier claims and re-opening cancelled orders are separate unsupported workflows.

## Supplier invoice and three-way matching

Create a draft supplier invoice against one PO. Enter supplier invoice reference, posting/due dates, explanation, order lines, accepted receipt allocations, invoice quantities/prices and tax codes. A missing receipt may be saved as a draft exception. Duplicate supplier references are blocked per supplier, including void drafts, after trimming/case normalisation.

Choose **Run three-way matching**. The server checks:

- Each order line belongs to the selected order and each receipt allocation belongs to that line.
- Only accepted, not-yet-invoiced receipt quantity is eligible. Other posted invoices consume eligibility; drafts do not reserve receipts.
- The invoice posting date follows its receipt and its tax snapshot remains active, current and effective.
- Invoice unit price agrees exactly with approved PO price; tolerance is zero.

Missing receipts, excess quantities, invalid dates or changed tax codes require draft revision. They cannot be waived. A business approver other than the creator can **Accept reviewed price variance** with a reason once blocking exceptions are corrected. **Return invoice for correction** leaves the reason in immutable history. Editing clears variance acceptance and tax/match snapshots. Posting rechecks live eligibility under the company financial lock, so two concurrent invoices cannot clear the same units twice.

Posting clears GRNI using the allocated receipt's remaining exact carrying value. The last allocation takes any remaining paise. Recoverable tax debits input-tax control; price differences and nonrecoverable tax debit/credit purchase variance expense. Gross credit is AP. Nonrecoverable tax is expensed in this release, not capitalised into stock. Posted invoices are immutable and show payments, reservations, outstanding and available balances. Drafts can be voided with a reason. Credit notes, refunds and posted-invoice cancellation are not implemented; never edit posted source records to represent them.

## Supplier payment approvals and AP

1. Finance creates a payment batch for one supplier and 1–100 posted invoice allocations. Partial payments are supported. Choose two distinct active business approvers, neither the preparer.
2. Save a draft, inspect it, then **Submit payment for approvals**. Submission reserves eligible amounts. Another submitted/approved batch cannot consume those reservations. Drafts themselves do not reserve amounts.
3. Each assigned approver reviews the current version, enters a reason and approves/rejects once per approval round. One approval leaves SUBMITTED; two make APPROVED. Rejection makes REJECTED and releases the reservation. A revised rejected batch starts a new round and requires both approvals again.
4. Once the external bank transfer has completed, finance enters its actual date/reference, confirms completion and chooses **Record supplier transfer**. This records Dr AP / Cr Bank; there is no bank connectivity or money-sending operation.

Execution rechecks both approvers' current eligibility, approvals, invoice availability, dates and open period. It requires a unique normalised bank reference across supplier transfers and customer collections. Identical UUID retries return the original result. Cancelling a non-executed batch releases reservations and retains history. Executed batches cannot be cancelled or edited.

**Statements** includes AP ageing at a cutoff and a control reconciliation of posted invoice gross less executed allocations versus AP's credit-minus-debit GL balance.

## AR and customer collections

Create a customer master through the existing customer workflow first. Finance enters its code in **Customer invoices**, with reference, posting/due dates and service/non-stock lines. Save and post to Dr AR / Cr Sales and output tax. These invoices do not dispatch inventory or calculate cost of goods sold.

In **Collections**, select the customer and posted invoices, allocate all/part of the confirmed receipt, enter the bank reference/date and confirm clearance. The source posts Dr Bank / Cr AR. Over-allocation, cross-customer allocation, duplicate references and dates before the invoice are rejected. Collections are immutable, with linked allocation/history records. Deposits on account, customer credit notes, refunds, sales orders and stock dispatch remain outside this workflow.

AR ageing and control reconciliation derive posted invoice gross less collections through the cutoff. Current reservations are shown on supplier invoices; historical AP/AR balances use actual execution/collection dates, not approval dates.

## Tax configuration and financial statements

Configure named tax codes with 0–100 percent rates (four fractional places), effective date range, recoverability and active state. Codes are fixed; edits require the current version and append history. Invoice lines snapshot code, rate, version and recoverability. Tax is computed on each rounded line net and rounded to paise. This is generic exclusive-price tax configuration; inclusive prices, compound taxes, withholding, GST place-of-supply rules, statutory returns and tax remittance workflows are not implemented.

**Statements** provides:

- Income statement: posted revenue/expense activity for a date range.
- Balance sheet: cumulative asset/liability/equity balances at cutoff, plus cumulative unclosed earnings and a balance difference.
- Cash flow statement: bank opening/closing and net OPERATING/INVESTING/FINANCING activity. Choose a category before posting manual bank journals. Legacy/unclassified lines are counted and flagged; non-cash disclosures and statutory presentation adjustments require separate review.
- Posted input recoverable/nonrecoverable and output tax totals grouped by snapshotted code/rate.
- AP and AR ageing, and AP/AR/GRNI subledger-to-GL differences. Period close also requires those controls to agree and draft supplier/customer invoices in the period to be posted, moved or voided.

Manual journals cannot touch inventory, GRNI, AP, AR or input/output-tax controls. Subledger postings are source-owned. Accounts retain inactive balances in reports. Financial statements are operational accounting reports, not statutory filing output.

## Bank reconciliation with outstanding items

Use **Accounting & stock → Bank statements**. Statement arithmetic must agree; statement periods for an account cannot overlap. Zero-transaction statements are supported. Match every statement line to one posted bank line of the same signed amount; older outstanding ledger lines may clear in a later statement.

The report calculates expected opening, signed outstanding ledger amount and adjusted closing. **Statement closing + outstanding ledger = ledger closing** must agree. The opening must agree with previously cleared items and the preceding finalised statement; subsequent statements must follow contiguously. Earlier draft statements must be finalised first. Statement lines without ledger entries (fees/interest, for example) require a journal before matching.

Finalised statements/matches remain immutable, and bank postings at or before their cutoff remain blocked. An outstanding cheque or deposit can be matched later without rewriting the original ledger date. Split/combined matching, bank-file imports and bank connectivity remain unsupported.

## Reliability and verification

Every mutation shares the existing UUID retry, financial advisory lock, active-actor permission recheck and audit/history transaction. Versions reject stale edits and decisions. Stock, GRNI allocation, AP/AR, bank, source state and successful retry response roll back together on failure. The desktop retains unsuccessful keys while the workspace stays open; refresh server records after an uncertain result before changing inputs or leaving that workspace.

Run `npm run check`, `npm test`, `npm run test:integration`, and `npm run test:desktop`. Integration covers partial/damaged receipts, induced receipt rollback, duplicate references, quantity races, independent price exceptions, payment reservations/rejection/revision/dual approval/execution, AP/AR, tax, statements, outstanding-bank carry-forward and a configured schema-5 upgrade preserving posted journals/custom codes. Desktop checks exercise the cross-role workflow with synthetic data. `npm run package:windows:dir` and `npm run test:packaged` verify the unpacked Windows build; signing/installer publication remain separate operations.

## Planned CRM, Sales and Supply Chain handoffs

Reviewed 17 November 2026. The [module roadmap](ERP_MODULE_ROADMAP.md) extends the current customer register and service AR with CRM contacts/leads/opportunities, quotations, sales orders and partial stocked fulfilment. CRM conversion links a customer once; accepted orders create commitments, reservations hold availability, dispatch creates stock/COGS, and linked invoices/collections use the existing Finance boundary. These new records/screens are planned, not current Orders & billing actions.

MOD-SLS-02 includes basic reservations/dispatch before phase 3 replenishment/RFQ/supplier-quote/quality/count extensions. Linked credits/refunds and return valuation must be specified first. Current one-request/one-order purchasing, immutable posted invoices, no stocked customer dispatch and no credit/refund screens remain actual limits. A manual stock consumption entry is not a stocked sales workflow. Marketing later references permitted source/revenue/cost data; it does not duplicate invoices or collections. See [proposed posting contracts](TRADE_POSTING_RULES.md#proposed-sales-and-supply-chain-contracts).
