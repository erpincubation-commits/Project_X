# Accounting posting contract

This contract was defined before the receiving and payment engines. Migration 6 implements those flows as described in [trade posting rules](TRADE_POSTING_RULES.md) and [trade workflows](TRADE_WORKFLOWS.md). The current foundation uses INR, two decimal places, perpetual moving weighted average by item and warehouse, and no negative stock. One installation holds one company's books. No tax jurisdiction, GST filing, foreign currency or exchange-rate behaviour is inferred from the currency.

## Posting matrix

| Business event | Debit | Credit | Implementation |
| --- | --- | --- | --- |
| Purchase request / approval / purchase order | None | None | Implemented; orders copy approved INR request quantities/prices. |
| Opening stock | Inventory control | Opening equity | Implemented stock opening, once per item/warehouse before other movements. |
| Positive count adjustment | Inventory control | Inventory adjustment expense | Implemented; reason and independently maintained count evidence required operationally. |
| Negative count adjustment | Inventory adjustment expense | Inventory control | Implemented at current moving average. |
| Stock consumption | Consumption expense | Inventory control | Implemented at current moving average. |
| Warehouse transfer | Inventory control (destination) | Inventory control (source) | Implemented, same value leaves and enters; no profit or loss. |
| Accepted goods receipt against order | Inventory control | Goods received not invoiced (GRNI) | Implemented atomically, including partial/damaged evidence. Rejected goods do not enter valued stock. |
| Matched supplier invoice | GRNI at receipt carrying value; recoverable input tax when configured; purchase price variance for differences | Accounts payable for gross invoice | Implemented with accepted-receipt allocation, tax snapshots, duplicate control and independent price exception acceptance. |
| Non-stock supplier invoice | Expense / asset and configured recoverable tax | Accounts payable | Contract only. Requires reviewed account and tax classification. |
| Supplier payment execution | Accounts payable | Bank | Implemented confirmed-transfer recording after two independent approvals. Approval alone never posts or transfers money. |
| Customer service/non-stock invoice | Accounts receivable | Sales and configured output tax | Implemented; no inventory dispatch. |
| Customer collection | Bank | Accounts receivable | Implemented partial allocations against posted invoices and confirmed receipt evidence. |
| Receipt return before invoice | GRNI | Inventory control | Contract only. Use original receipt allocation; define moving-average variance explicitly if carrying value differs. |
| Supplier credit after invoice / refund | Accounts payable or bank with allocated tax/variance reversal | Inventory / expense / tax as appropriate | Contract only. Must reference original invoice and allocations; never silently edit it. |
| Manual journal reversal | Original credits | Original debits | Implemented as a new linked journal in an open period; original stays immutable. |

## Invariants

- Every posted journal has at least two lines, one positive side per line, equal nonzero debits and credits, active accounts and a date inside an open accounting period.
- INR journals use exact paise amounts; quantities use six decimal places and incoming unit costs up to six. BigInt fixed-point arithmetic and PostgreSQL NUMERIC avoid floating-point money calculations.
- Round stock movement value to the nearest paise, halves away from zero. Outgoing value is quantity times current carrying value divided by current quantity, rounded once; a full depletion takes all remaining carrying value. Transfers preserve that exact value. Average unit cost is derived, never used as a rounded intermediate.
- Opening stock and stock increases must round to a positive value. A partial issue can have zero value after rounding; it still records quantity but needs no zero-value journal. Zero-cost inbound stock is currently rejected.
- Inventory, GRNI, AP, AR and input/output-tax controls cannot be used in manual journals. Source engines own these postings and reconcile their subledgers.
- Posting, source state, stock projection, immutable movement, record history, audit and successful retry response share one transaction. A failed transaction changes none of them.
- Closed periods reject postings and reversals. Close also requires no draft journals dated in the period and an exact stock-to-ledger tie-out. Reopening requires an authorised finance user and a reason.
- Historical stock is immutable. Movement business dates cannot go backwards relative to any existing inventory movement; same-day order is the server sequence. This deliberately blocks late inventory backdating until a valuation replay engine exists.
- A company-wide transaction lock serialises financial writes, period changes and stock valuation. Expected versions protect edits; UUID retry keys bind actor, operation and payload. This trades throughput for deterministic books in the initial on-premises release.
- Posted journals and stock movements are never edited/deleted. Manual journal corrections use linked reversal. Stock corrections use a new explained adjustment at current valuation; automatic reversal of historical stock cost is not implemented.

## Reconciliation

The trial balance derives from posted journal lines, including closed periods. Stock reconciliation compares immutable movement sums with each item/warehouse projection and inventory control's debit-minus-credit balance at a cutoff date. Differences are reported, never automatically written off. Physical count entry compares a counted quantity with the current stock version and creates a traceable increase/decrease adjustment.

Bank reconciliation uses entered statement lines, exact signed matches and outstanding-item carry-forward. Every statement line must match a posted bank line. Statement closing plus signed outstanding ledger items must equal ledger closing; opening continuity and chronological finalisation are enforced. Older ledger items may clear in a later statement. It records bookkeeping evidence and has no bank connectivity.

## Remaining expansion gates

Configured exclusive-price tax, supplier reference uniqueness, receipt/invoice allocations, zero price tolerance, independent price acceptance, dual payment approvals and unique execution evidence are implemented. Jurisdiction-specific tax, credit notes/refunds, returns, landed costs, bank connectivity and retention remain separate work. Review mappings and operational rules for the intended deployment before operational use.

## Proposed module posting review

Reviewed 17 November 2026 for [MOD-FIN/SLS/SCM/HR](ERP_MODULE_ROADMAP.md#5-candidate-backlog-and-acceptance). This is a design agenda, not implemented source types or authority to post through manual control-account journals. Current posting rules above remain unchanged.

| Planned event | Proposed effect to review | Required accounting decisions |
| --- | --- | --- |
| Lead/opportunity, quotation/order, reservation, replenishment suggestion, RFQ or campaign plan | No GL or physical-stock posting. | Separate pipeline/commitment/budget reporting from posted revenue and on-hand stock. |
| Stocked sales dispatch | Dr COGS / Cr Inventory at controlled outgoing valuation. | COGS mapping, partial dispatch, reservation consumption, zero-value rounding, period/date and exactly-once source rules. |
| Stocked customer invoice / collection | Existing AR/revenue/output-tax and Bank/AR principles with new fulfilment allocations. | Delivery/invoice linkage and remaining quantity/value limits; service AR retains its current no-stock behaviour. |
| Customer return, credit and refund | Linked stock/cost restoration, revenue/tax/AR correction and bank settlement as applicable. | Distinguish physical return from credit/refund; select original-cost/current-cost variance policy, tax reversal, prior settlement and period treatment. |
| Supplier return, credit and refund | Linked stock/GRNI or AP/tax/variance correction and bank settlement. | Separate uninvoiced/invoiced paths, original allocations and carrying-cost differences; bounded credits/refunds. |
| Approved employee expense / settlement | Proposed Dr reviewed expense/recoverable tax / Cr Employee payable; settlement Dr Employee payable / Cr Bank. | New employee-payable source/control mapping, claim eligibility/tax, independent approval, confirmed external payment and correction; payroll excluded. |
| Actual campaign expense | Ordinary approved Finance expense/AP/payment source, attributed by a reviewed dimension/link. | A campaign budget is not a journal; attribution must not duplicate expense or revenue. |

Approve detailed rules and independent expected-result fixtures before schema/API work. Extend control-account protection and source-kind constraints with each posting engine; reconcile stock/COGS, AP/AR/GRNI, employee payable, tax and GL under retries/concurrency and restore. INR, weighted average, one company and negative-stock blocking remain the baseline.
