# Accounting and inventory foundation

## Activate the current schema

Stop the running desktop/server, back up the configured database, and upgrade both client and server together. From the project root:

```powershell
npm run build
npm run db:migrate
npm start
```

Migration 5 preserves existing users, MFA, customers and purchasing records. It adds accounting/inventory tables and two roles. It creates no company opening balances or stock. Tests migrate disposable databases, not your application database. The current application requires schema 7; use the [operations runbook](OPERATIONS_RUNBOOK.md). Schema 6 introduced [trade workflows](TRADE_WORKFLOWS.md).

Sign in as administrator and open **Accounting & stock**. Review [the posting contract](ACCOUNTING_POSTINGS.md), tick its confirmation, and **Initialise INR books**. This one-time action now creates twelve fixed posting accounts and selects INR, two decimal places and moving weighted average valuation. Purchase request estimates never become opening stock automatically.

Provision `accountant` and `inventory_manager` through **Account security and access**. They complete mandatory MFA on first login.

## Access

| Role | Access |
| --- | --- |
| `admin` | Initialise books and read all accounting/inventory data and history. No manual journal or stock posting. |
| `accountant` | Maintain manual accounts, periods, journals and bank statements; post/reverse journals; close/reopen periods with reasons. No stock mutation. |
| `inventory_manager` | Read stock valuation/reconciliation and item masters, maintain warehouses, post stock movements with automatic linked journals. No manual journal, period or bank statement mutations. |
| `auditor` | Read books, stock, bank statements and history; no mutations. |
| Other existing roles | No books/stock access; existing purchasing/customer access continues. |

Inventory managers have inventory.read and receive no chart, period, bank or journal content from the server. Accountants, administrators and auditors have books.read plus inventory.read for company-wide reporting. Warehouse-specific scopes are future work. Manual journals have no separate maker/checker approval workflow. Assign roles according to these actual grants.

## Accounts and periods

| Code | Type | Fixed mapping |
| --- | --- | --- |
| 1100 | Asset | Inventory control |
| 1110 | Asset | Bank |
| 1120 | Asset | Recoverable input tax |
| 1130 | Asset | Accounts receivable |
| 2100 | Liability | GRNI |
| 2110 | Liability | Accounts payable |
| 2120 | Liability | Output tax |
| 3100 | Equity | Opening equity |
| 4000 | Income | Sales revenue |
| 5100 | Expense | Inventory adjustments |
| 5110 | Expense | Consumption |
| 5120 | Expense | Purchase price variance and nonrecoverable purchase tax |

An accountant can add manual accounts and rename/deactivate them with expected versions. Codes, types and system mappings remain fixed. Inactive accounts retain historical balances and cannot receive postings. Manual journals cannot use inventory, GRNI, AP, AR or input/output-tax control accounts.

Create inclusive, non-overlapping periods in **Chart & periods**. Posting requires an open period and a date no later than PostgreSQL's current date. Drafts may be prepared before a period exists or while it is closed. Closing requires no drafts dated in the period and an exact stock-to-ledger tie-out. Close/reopen requires a reason and an accountant; existing postings stay immutable.

## Journals

Choose **Journals → New journal**. Enter a date, explanation and 2–100 lines. Each line has one positive debit or credit. Nonzero totals must agree exactly. Amounts use decimal strings with at most two places, no commas or scientific notation. Save a balanced draft, inspect it, then **Post journal**.

Edits/posting use the current version. Posted headers/lines reject changes and deletes. Corrections create a linked, once-only reversal with swapped sides in an open period. Stock journals cannot be reversed through the manual journal screen. Bank postings and reversals at or before the last finalised statement cutoff are blocked; use a later open date.

## Stock workflow and valuation

Create item masters in Purchasing, then warehouses in **Warehouses & stock**. Item units cannot change after any stock movement. An item/warehouse holding stock cannot be deactivated. Unit conversion is not implemented.

Refresh stock before acting. Outgoing moves, transfers and counts require the current source stock version. Transfers update both warehouses atomically. Inventory dates cannot precede any existing movement date; same-day order uses the server sequence. Backdated valuation replay is future work.

| Kind | Quantity entered | Value and posting |
| --- | --- | --- |
| `OPENING` | Added stock | Incoming cost; Dr inventory / Cr opening equity. Once before any entry for that item/warehouse. |
| `INCREASE` | Added stock | Incoming cost; Dr inventory / Cr adjustment expense. |
| `DECREASE` | Removed stock | Current carrying average; Dr adjustment expense / Cr inventory. |
| `CONSUME` | Consumed stock | Current carrying average; Dr consumption / Cr inventory. |
| `TRANSFER` | Quantity to another active warehouse | Source carrying value enters destination unchanged. Dr destination / Cr source inventory; same GL account, zero net change. |
| `COUNT` | Actual physical count, including zero | Difference becomes an increase/decrease adjustment. Increased counts need incoming cost. Equal counts require no movement. Start a new balance with opening stock before counting an existing version. |

All movements need an explanation. Count adjustments post directly under inventory permission; count-sheet storage and independent adjustment approval remain future work. Use six-place quantities and incoming unit costs. Money calculations use BigInt paise and PostgreSQL NUMERIC. Value rounds once to paise, halves away from zero. Outgoing cost divides exact carrying value by quantity; full depletion takes all remaining paise. No negative stock. Positive incoming value must round to at least one paise. A rounded zero-value partial issue records quantity without a zero journal.

Movements are immutable. Corrections are new explained adjustments at current cost, not automatic historical reversals. Valuation is per item/warehouse, so transfers recalculate the destination average.

## Reconciliation

**Reconciliation** compares immutable movement-derived stock value with inventory control at a cutoff. Current reports also compare every balance projection with immutable entries, including missing projections. Historical projections are not reconstructed. Differences are reported, never automatically posted away. The trial balance includes posted entries through the cutoff and cumulative debit/credit/net per account, including inactive accounts.

**Bank statements** supports manual entry of 0–100 signed statement lines, inclusive dates and opening/closing balances. Positive amounts increase the bank asset; negative amounts reduce it. Statement arithmetic must agree before saving; periods cannot overlap for the same bank account. Edit a draft to correct entry errors; revision clears all matches and retains the previous version in history.

Match each statement line to one posted bank line with the same signed amount. A journal line can be matched once; earlier outstanding lines may clear later. Finalisation requires opening continuity and statement closing plus outstanding ledger items to agree with the ledger. Finalised statements/matches are immutable. Bank imports and split/combined matching remain future work. See [trade workflows](TRADE_WORKFLOWS.md) for current rules.

## Atomicity, retry, history and API

Every write requires an actor-scoped UUID `Idempotency-Key`. Identical successful retries return the same response; changed payload/operation returns 409. Failures roll back source, ledger, stock, history, audit and retry response together. The desktop retains unsuccessful keys while the workspace stays open. Check the register after an uncertain result before changing inputs or leaving the workspace.

A company-wide PostgreSQL advisory transaction lock serialises accounting writes, period changes and cost calculations. Versions protect edits. Reads use repeatable-read snapshots. History is append-only; the UI loads the latest 200 versions. Runtime database privileges must prevent privileged owners from bypassing normal triggers.

API prefix: `/api/v1/books`. Routes cover setup; account create/update; period create/state; journal list/get/create/update/post/reverse; warehouse create/update; stock list/post; valuation; trial balance; bank statement list/get/create/update/match/finalise; and history by kind/UUID. Journal/movement/statement registers paginate by 20; master overview returns all accounts, periods and warehouses. Financial bodies allow 128 KiB for 100-line entries; other routes retain the 16 KiB limit.

## Verification and remaining work

Run `npm run check`, `npm test`, `npm run test:integration` and `npm run test:desktop`. Integration checks exact valuation, versions, permission denials, concurrent operations/retries, immutable records, induced failure rollback, period state and bank matching in disposable databases. Desktop checks cover setup, accounts/periods, journals, movements/counts, reconciliation and bank matching across roles. Tests require development PostgreSQL `CREATE DATABASE`; Electron uses a normal Windows account and keeps its renderer sandbox enabled.

Orders, partial/damaged receipts, supplier invoice allocation, two-person payment approval and confirmed-transfer recording, AP/AR, configured tax and statements are implemented in [trade workflows](TRADE_WORKFLOWS.md). Returns, credit notes/refunds, statutory tax/GST, foreign currency, landed costs and valuation replay remain future work. INR does not establish a tax jurisdiction or tax treatment.

## Planned Finance and Supply Chain expansion

Reviewed 17 November 2026. The [module roadmap](ERP_MODULE_ROADMAP.md) extends these foundations rather than creating new books or a second stock ledger. MOD-FIN-01/02 cover reviewed corrections/opening migration, cost centres/budgets, bank-file matching and reports. MOD-SLS-02 introduces reservations and dispatch/COGS with Sales; MOD-SCM-01/02 later add replenishment, sourcing, quality/returns and independent count adjustment.

Reservations must remain distinct from on-hand stock and valuation; dispatch atomically consumes eligible commitments and posts its stock/cost source. Quarantine/release and returns need explicit available-versus-valued quantity rules and reviewed original/current-cost variance. HR expense claims require an employee-payable control and Finance settlement rules; Marketing uses permitted expense/revenue attribution. Follow the [proposed posting review](ACCOUNTING_POSTINGS.md#proposed-module-posting-review) before implementation. Existing INR, weighted average, negative-stock block, control-account restrictions and current UI steps remain unchanged.
