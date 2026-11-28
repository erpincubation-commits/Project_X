# Purchasing, AP, AR and reporting

## Activate migration 6

Stop desktop/server processes, back up the configured database and upgrade both components together:

```powershell
npm run build
npm run db:migrate
npm start
```

The current application requires schema 14; use the [operations runbook](OPERATIONS_RUNBOOK.md) for the complete upgrade. This section describes the schema 6 trade migration. Tests migrate disposable databases, not the application database. Migration 6 retains existing users, MFA, purchasing, journals and stock; it adds orders, receipts, tax codes, invoices, payments, collections, source journal types and cash-flow categories. Existing configured books gain AR, sales and output-tax mappings. If a custom account already uses 1130, 2120 or 4000, the corresponding system code becomes SYS_AR_6, SYS_OUTPUT_TAX_6 or SYS_SALES_6; custom accounts are preserved. A conflicting fallback code causes migration to fail atomically rather than overwrite data.

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

The goods receipt register shows the recorded timestamp and UTC calendar-day **Entry lag** from the user-entered receipt posting date. The 1/3/7-day filter runs on the full permitted set before pagination and combines with search and damaged-only filtering. It identifies possible late system entry, not actual supplier delivery delay or a service-acceptance lag.

For payment planning, the supplier invoice register offers **Due in next 7 days**: posted invoices with an outstanding balance due from tomorrow through seven days after the database date, inclusive. Reservations for unexecuted payments remain in outstanding; check payment records before preparing another payment. The filter is scoped by the caller's existing invoice permissions and does not send reminders or transfer money.

1. Create an INR purchase request with positive item prices and obtain independent approval through Purchasing.
2. As purchasing, choose **Orders → Issue purchase order**. Select the approved request and active supplier. Quantities, prices and item/unit snapshots come from the request; one PO is allowed per request. A PO is a commitment and has no GL effect.
   Optionally link an unexpired, unwithdrawn quotation for the same request and active supplier. All quoted quantities and unit prices must equal the approved request. The server rechecks and records the link at issuance; unlinked orders remain supported. This does not send a supplier message or approve different prices.
   After obtaining a supplier confirmation outside the application, purchasing can record the acknowledgement date, supplier reference and optional expected delivery date on the issued order. Updates create new versioned order-history events; past confirmations remain visible. The acknowledgement date must not precede the order or exceed the database date, and the expected delivery cannot precede acknowledgement. The action does not send messages, amend prices or quantities, receive goods or post accounting entries. Refresh stale orders before subsequent actions.
3. As inventory manager, choose **Receipts** and the issued order. Enter delivery date/reference, active warehouse and accepted/damaged quantities. Describe damaged goods. Leave unreceived order lines at zero; the client excludes them from the receipt.
4. Accepted plus damaged quantity on one delivery cannot exceed the outstanding accepted order quantity. Accepted quantities fulfil the order; damaged quantities do not, so replacement deliveries can be recorded later. Across receipts, accepted quantities can never exceed the order.
5. Accepted stock posts Dr Inventory / Cr GRNI at approved PO cost. Each receipt line links its immutable stock movement and journal. Damage evidence has no stock or GL effect and cannot be invoiced. A damage-only receipt is allowed.

Receipts require an open period; valued inventory cannot be backdated before the latest stock movement. Duplicate delivery references are blocked per order, ignoring surrounding spaces/case. Order versions change after every delivery, so stale receipt attempts fail. Item units become fixed once an order or stock entry uses them. Cancel remaining order quantities with a reason; existing accepted receipts can still be invoiced. Returns, quarantined stock, disposal, supplier claims and re-opening cancelled orders are separate unsupported workflows.

The goods receipt register supports **Search goods receipts** by receipt number, order number or delivery reference and **Damaged deliveries only**. Select **Apply receipt filters** to search the complete permitted register before pagination. Refresh and paging retain the applied filters. This is a review view, not a return or quarantine transaction.

The order register supports case-insensitive partial order number, supplier code and supplier name search plus issued/cancelled, **Awaiting acceptance** and **Overdue promised delivery** filters. Awaiting acceptance selects issued orders with at least one goods or service line not fully accepted; damaged quantities do not count as accepted. Overdue promised delivery additionally requires the latest recorded expected date to precede the database server's current date; it excludes orders without an expected date. Apply filters to query the complete register before pagination. Refresh and paging use the last applied filters. Issued is an order state, not proof that quantities remain unreceived; open the order and review its lines.

**Outstanding 30 days or more** selects issued orders with unaccepted quantities dated at least 30 calendar days before the database date, including orders without a promised delivery date. It excludes cancelled and fully accepted orders. It measures order age, not lateness against a delivery promise; the threshold is fixed and no alert is sent.

From an open order, **Load related documents** lists its receipts and, for accounts with invoice access, its related supplier invoices. Select a document's **Open** action to move to that record. Invoice results are permission scoped and paginated; exception reviewers only see invoices their existing scope permits. Reload for changes, and save or cancel unsaved order work before switching sections.

## Supplier invoice and three-way matching

Service items use an administrator-selected active non-control expense account and cannot be imported. An independent inventory manager records accepted service quantities and evidence under **Receipts → Service acceptance**. Acceptance posts expense against GRNI and does not create stock. The accountant allocates service invoice lines to accepted service quantities; posting clears their GRNI value. Mixed stock/service orders are supported, but each line uses its corresponding receipt or acceptance source. Finance must review this treatment before production use.

Create a draft supplier invoice against one PO. Enter supplier invoice reference, posting/due dates, explanation, order lines, accepted receipt allocations, invoice quantities/prices and tax codes. A missing receipt may be saved as a draft exception. Duplicate supplier references are blocked per supplier, including void drafts, after trimming/case normalisation.

The supplier invoice register marks posted invoices with positive outstanding balances **Overdue** or **Due today** based on the desktop's local calendar date. This is a display cue for the loaded page; it does not send alerts, reserve funds or initiate payment. Refresh the register and verify current balances before action. Draft, void and fully paid invoices do not receive this cue.

Use **Search supplier invoices** for a case-insensitive partial invoice number, reference or supplier name, and **Invoice status** for draft, posted, void, draft matching exceptions, overdue or due-today invoices. **Apply invoice filters** queries the complete permitted register before pagination; refresh and paging retain the last applied filters. Overdue and due-today filters use the database server's current date and posted gross less executed payments; reserved but unexecuted amounts remain outstanding. The row cue instead uses the desktop's local date, so dates can differ around midnight or when time zones or clocks differ. Exception reviewers remain restricted to their existing server-authorised scope.

The **Payment deadlines** strip appears on Supplier invoices and Payments for permitted users. It counts overdue, due-today and next-seven-day posted invoices with outstanding balances using server-date filters, including reservations not yet executed. It loads on entering either section and has a **Refresh deadlines** action. It does not send a notification or initiate a transfer; inspect the invoice and payment batch before acting.

Choose **Run three-way matching**. The server checks:

- Each order line belongs to the selected order and each receipt allocation belongs to that line.
- Only accepted, not-yet-invoiced receipt quantity is eligible. Other posted invoices consume eligibility; drafts do not reserve receipts.
- The invoice posting date follows its receipt and its tax snapshot remains active, current and effective.
- Absolute invoice unit-price difference from the approved PO price is within the administrator-configured basis-point tolerance; the default is zero.

In **Orders & billing → Taxes**, the administrator can change the price tolerance and provide a reason. The current policy is rechecked at posting; increasing it may allow draft price differences to post without an independent price decision. It never waives receipt, quantity, date or tax checks. Changes are versioned and audited.

Missing receipts, excess quantities, invalid dates or changed tax codes require draft revision. They cannot be waived. After matching identifies a held exception, Finance assigns an active business approver other than the invoice creator, with a reason. The current owner alone can **Accept reviewed price variance** with a reason once blocking exceptions are corrected, or **Return invoice for correction**. Finance can reassign with another reason; history retains each assignment and decision. Existing unassigned exceptions require assignment after schema 16 migration. The invoice register has server-side **Unassigned exceptions**, **Assigned to me** and **Exceptions waiting 24 hours** filters. The last uses elapsed time since assignment or, for an unassigned exception, first match; this is a manual review queue, not an automatic escalation or notification. Editing or a successful rematch clears the owner; editing also clears variance acceptance and tax/match snapshots. Posting rechecks live eligibility under the company financial lock, so two concurrent invoices cannot clear the same units twice.

Posting clears GRNI using the allocated receipt's remaining exact carrying value. The last allocation takes any remaining paise. Recoverable tax debits input-tax control; price differences and nonrecoverable tax debit/credit purchase variance expense. Gross credit is AP. Nonrecoverable tax is expensed in this release, not capitalised into stock. Posted invoices are immutable and show payments, reservations, outstanding and available balances. Drafts can be voided with a reason. Credit notes, refunds and posted-invoice cancellation are not implemented; never edit posted source records to represent them.

## Supplier payment approvals and AP

Business approvers can select **Awaiting my decision** in the payment register to filter all permitted pages to submitted batches assigned to them for which they have not decided in the current approval round. A first approver's decision removes the batch from their queue while the other approver can still see it. A revised and resubmitted batch starts a new round. Refresh the queue for changes; it is not a notification or escalation mechanism.

**Search payments** and **Payment status** filter the permitted register before pagination when **Apply payment filters** is selected. Search matches payment number, supplier code/name or recorded transfer reference. Applied filters persist through refresh, paging and switching the assigned-approver queue. The queue contains submitted batches only, so another selected status yields no rows. Filters do not execute payments or affect approvals.

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

**Statements → Supplier invoiced spend** groups posted supplier invoices in the selected inclusive date range by supplier and invoice-snapshot name, and shows invoice count, net, tax and gross INR. A renamed supplier may appear more than once. These are invoice values, not payment totals or a general-ledger reconciliation; draft/void invoices and unsupported supplier credits are excluded. **Item invoiced spend** groups posted supplier invoice lines by the item code, name, type and unit snapshotted on their orders; quantities and net, tax and gross INR are shown. It flags a difference between summed item lines and supplier invoice totals. Renamed items may appear separately. These are invoice values rather than commitments, payments, stock valuation or supplier performance. Access follows the existing `books.read` permission.

**Statements → Supplier delivery follow-up** uses issued purchase orders dated in the selected range that have a dated supplier acknowledgement. It groups by supplier and counts orders completed on time, completed late, still open and overdue today, and still open and not due. Completion requires accepted quantities for all order lines, including services. The latest supplier promise is used, so amended dates can change the classification. Unpromised orders are excluded. This is a live operational follow-up, not a historical scorecard; access follows `books.read`.

**Statements → Supplier exceptions and rework** groups recorded damaged goods receipts by their posting date and invoice matching-exception history events by the time the match placed the invoice on hold. It shows damaged receipt count and quantity, exception event count and distinct affected invoices for each supplier in the selected period. Repeated matching holds count as repeated rework events. This is an internal operational cue: it does not assign supplier fault, measure rejected service, include off-system activity or replace quality, return, tax or Finance review. Access follows `books.read`.

**Statements → Issued purchase order value** groups issued orders by the supplier snapshot for the selected inclusive order-date range and sums ordered line quantity × saved unit price. It includes all ordered quantities, even if already received or invoiced, and excludes cancelled orders. It is an original estimated net value, not an open commitment, tax-inclusive amount, AP balance or payment. Access follows `books.read`.

The same table shows orders with at least one unaccepted line and **Unaccepted net INR**. For each line it values the greater of zero and ordered quantity less accepted goods/service quantity at the saved order unit price. Damaged quantities do not count as accepted. The selected range filters order dates; acceptance is the current recorded state, not a historical cutoff. The amount is an operational estimate and does not subtract invoices or represent an accounting commitment ledger.

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

Saved supplier invoices provide **Review invoice source documents** for users with order-read access. It reads the order plus its goods/service acceptance records, then displays only allocations referenced by the invoice lines. The view compares ordered and invoiced quantity/unit price and shows accepted/damaged goods, damage evidence, service evidence and current uninvoiced quantities. Missing source allocations display guidance rather than implying a match. Loaded details clear when invoice ID/version changes and refresh only on request. Current availability can include an unsaved draft's quantity and excludes posted billed quantities; normal live matching/posting still decide eligibility. No mutations, new permissions or API/schema changes; rebuild desktop.

**New supplier invoice → Import supplier invoice JSON** validates a single format-version-1 envelope using the shared supplier-invoice contract, limited to 64 KiB. The accountant explicitly opts to replace unsaved fields. Preview reads order, acceptance and tax selections and rejects foreign order-line/acceptance IDs before populating the form. It sends no invoice mutation; the ordinary save path revalidates live eligibility and applies duplicate references, retries, history/audit and subsequent matching/posting. Saved invoices cannot be overwritten via import. The form can generate a JSON template from its current fields and IDs. Decimal amounts/quantities are strings, dates are ISO calendar dates, fields are strict, and bulk/PDF/OCR ingestion is unsupported. No migration or new IPC/API route; rebuild desktop with current contracts.

**Orders → Load related documents** includes service acceptances alongside goods receipts and permitted invoices. Expand an acceptance to review evidence, timestamp/entry lag, accepted line values, current uninvoiced quantities and retained transaction history without leaving the order. Reads reuse the existing order-read and service-history permissions and unfiltered per-order acceptance API; receiving entry-lag filters do not hide related records. Reload after invoice posting to update uninvoiced quantities. Desktop rebuild/restart only; no schema or server changes.

**Service acceptance** shows creation timestamps and UTC calendar-day entry lag from entered posting date, clamped at zero. Its Any/1/3/7-day filter applies on the server to all acceptance records for the selected order and retains existing order-read permission checks. Refresh reloads saved records; the selected filter persists across order selection and posting. Unfiltered API calls, including invoice allocation choices, still return all acceptances for an order. This cue does not verify physical service completion. No migration or posting change.

**Statements → Export P2P reports** saves supplier spend, item spend, issued order value, delivery follow-up or exception/rework CSV through the native save dialog. The desktop requests fresh data with the loaded report's date range after destination selection; the existing server `books.read` check applies. Explicit columns include reporting dates, currency and UTC export time; empty results are headings only. CSV quoting and text-prefix protection prevent formula prefixes in supplied text from becoming spreadsheet formulas. Item-spend export refuses a reconciliation difference. Exported supplier data requires approved local custody; no outbound integration is added. Desktop rebuild/restart only, no migration.

Issued-order descriptions support Purchasing proposals and independent business-approver decisions in **Orders**. The proposer, order creator and originating requester cannot decide a proposal. Proposals retain the old effective description until approval; rejection keeps it. Every proposal/decision appends history under the financial lock and idempotency controls. Any intervening order version change expires the proposal. Line quantities/prices, supplier, source links and dates are outside this amendment workflow. No schema migration is required.

Every mutation shares the existing UUID retry, financial advisory lock, active-actor permission recheck and audit/history transaction. Versions reject stale edits and decisions. Stock, GRNI allocation, AP/AR, bank, source state and successful retry response roll back together on failure. The desktop retains unsuccessful keys while the workspace stays open; refresh server records after an uncertain result before changing inputs or leaving that workspace.

Run `npm run check`, `npm test`, `npm run test:integration`, and `npm run test:desktop`. Integration covers partial/damaged receipts, induced receipt rollback, duplicate references, quantity races, independent price exceptions, payment reservations/rejection/revision/dual approval/execution, AP/AR, tax, statements, outstanding-bank carry-forward and a configured schema-5 upgrade preserving posted journals/custom codes. Desktop checks exercise the cross-role workflow with synthetic data. `npm run package:windows:dir` and `npm run test:packaged` verify the unpacked Windows build; signing/installer publication remain separate operations.

## Planned CRM, Sales and Supply Chain handoffs

Reviewed 17 November 2026. The [module roadmap](ERP_MODULE_ROADMAP.md) extends the current customer register and service AR with CRM contacts/leads/opportunities, quotations, sales orders and partial stocked fulfilment. CRM conversion links a customer once; accepted orders create commitments, reservations hold availability, dispatch creates stock/COGS, and linked invoices/collections use the existing Finance boundary. These new records/screens are planned, not current Orders & billing actions.

MOD-SLS-02 includes basic reservations/dispatch before phase 3 replenishment/RFQ/supplier-quote/quality/count extensions. Linked credits/refunds and return valuation must be specified first. Current one-request/one-order purchasing, immutable posted invoices, no stocked customer dispatch and no credit/refund screens remain actual limits. A manual stock consumption entry is not a stocked sales workflow. Marketing later references permitted source/revenue/cost data; it does not duplicate invoices or collections. See [proposed posting contracts](TRADE_POSTING_RULES.md#proposed-sales-and-supply-chain-contracts).
