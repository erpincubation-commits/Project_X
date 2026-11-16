# Purchasing, receivables and reporting posting rules

These rules extend ACCOUNTING_POSTINGS.md before implementing the new source engines. INR and exact paise remain authoritative. Taxes are configured rates with effective dates and recoverability, not a statutory tax-filing implementation.

| Event | Debit | Credit |
| --- | --- | --- |
| Issue PO against an independently approved INR request | None | None |
| Accept partial receipt | Inventory at approved PO cost | GRNI |
| Record damaged/rejected delivery | None; excluded from stock and invoice eligibility | None |
| Post matched supplier invoice | GRNI at allocated receipt carrying value; recoverable input tax; approved price variance / nonrecoverable tax expense | AP gross invoice |
| Approve payment (two distinct assigned actors, neither preparer) | None | None |
| Record confirmed supplier transfer | AP allocated amount | Bank |
| Post customer service/non-stock invoice | AR gross invoice | Sales revenue; output tax |
| Record confirmed customer collection | Bank | AR allocations |

PO quantities and prices come from the approved request, with one PO per request. Accepted receipts cannot exceed the approved quantity. Damaged quantities do not fulfil accepted quantity and can be replaced. A single delivery's accepted plus damaged quantity cannot exceed outstanding accepted quantity. Damaged evidence is retained; damaged stock disposal and returns are separate future workflows.

Invoice allocations must identify order lines and accepted receipt lines. Missing receipts, excess quantities, tax changes and price differences hold posting. Quantity shortages cannot be waived. A business approver other than the invoice creator can accept an explained price variance for that invoice version. Revisions clear approval. Receipt allocation uses remaining exact carrying value, with the final allocation taking remaining paise. Each unit can clear GRNI once.

Submitting a payment reserves eligible outstanding invoices. Rejection/cancellation releases its reservation. Execution requires both assigned approvals, an open period, the current version, and a unique confirmed bank reference. Approval does not send money. Customer collections likewise record already confirmed receipts, prohibit over-allocation and use unique references.

All source state, stock, journals, allocations, history, audit and retry responses commit together under the existing company financial lock. Posted invoices, receipts, collections and executed payments are immutable. Unsupported credit notes/refunds must not be represented by editing posted records.

Reconciliation compares AP, AR and GRNI subledgers to their ledger controls at a cutoff, in addition to existing stock reconciliation. Closing requires those controls to agree. Financial statements derive only from posted journals: income/expense for the selected range, a balance sheet including cumulative unclosed earnings, and bank cash movements classified by journal cash-flow category. Unclassified manual cash movements are explicitly reported.

Bank reconciliation carries outstanding ledger items forward. All statement lines must match posted bank lines; older ledger lines may clear in a later statement. Statement closing plus signed outstanding ledger items must equal ledger closing. Opening agrees with the prior statement and outstanding items; statements finalise chronologically. Bank fees/interest require their own journal before matching. No bank connectivity or statutory filing is implied.
