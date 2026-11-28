# Product-wide desktop design specification

**Status:** Proposed wireframes and design handoff, 27 November 2026. The [interactive wireframes](PRODUCT_WIREFRAMES.html) use synthetic examples. Neither document changes application behaviour or certifies a deployment. Existing functionality and constraints remain defined by the [user guide](USER_GUIDE.md).

## Product structure

Use a consistent shell with a persistent, role-filtered sidebar, workspace title and account actions. Each workspace starts with a concise orientation, meaningful counts where the server supplies them, and links to permitted tasks. Registers remain the source of truth; do not imply dashboard counts are live alerts. Roles, sessions and authorisation remain server-enforced. Links to unavailable capabilities must not appear as working screens.

## Screen-by-screen handoff

| Area | Proposed hierarchy and primary actions | Essential states and constraints |
| --- | --- | --- |
| Connection and sign-in | Server connection first, then account; reveal setup, sign-in or recovery as applicable. | Clear connection failures; protect tokens and passwords; never expose account existence beyond current setup status. |
| MFA and recovery | One focused challenge; separate enrolment and one-time recovery-code screens. | Explain expiry, consumed codes, clock problems and private storage; recovery requires two distinct administrators. |
| Customers | Searchable register with create action where permitted; show code, name and created date. | Reader sees a read-only register; editing remains unavailable. |
| Purchasing overview | Status counts, request-to-payment path, transaction and master-data shortcuts. | Counts reflect permitted requests; no automatic refresh or payment execution. |
| Request register and form | Search/filter and pagination; draft form groups purpose, supplier/date and item lines; save before submit. | Requester owns edits, assigned independent approver decides; stale versions and changed master data require refresh/review. |
| Request detail and quotations | Header with status, owner, approver and next action; line details; quotes and expandable history below. | Only authorised users see quotes. A quotation is manual, advisory and immutable; withdrawal retains its reason. It does not change an order. |
| Suppliers and items | Separate searchable lists and detail/edit forms; active filter and history. | Supplier contacts are restricted; codes do not change; item unit and deactivation constraints must be visible before save. |
| Orders | Register plus issue panel based on an approved INR request, then line-level remaining and receipt quantities. | One order per request; cancellation applies only to remaining quantities and is irreversible. |
| Receipts | Start with order and warehouse, then delivery reference/date and accepted/damaged quantities. | Open period and warehouse required; accepted goods post stock/GRNI; damage is evidence only. |
| Supplier invoices | Draft header, order lines and accepted receipt allocations; separate match results from posting. | Zero price tolerance; only eligible exceptions can be independently accepted. Posted invoices cannot be edited. |
| Supplier payments | Batch header, allocations and two approvers, followed by separate decision and transfer-recording views. | Reservations and approver separation must be clear; transfer occurs outside ERP. |
| Chart and periods | Setup state, accounts register and accounting periods; contextual setup guidance. | Initialisation is one-time; period permissions and closing checks remain explicit. |
| Journals | Draft with balanced debit/credit lines, posting date and review; posted journal detail/history. | Block unbalanced entries, closed periods and manual posting to protected controls. |
| Stock and reconciliation | Warehouse and movement registers with on-hand and value; separate stock-to-ledger comparison. | Weighted-average valuation; no negative stock. A purchase receipt must use the receipt workflow. |
| Bank statements | Statement header, lines and matching panel; show unmatched and carried-forward items before finalising. | Finalisation is irreversible; no bank-file import or bank connection. |
| Customer invoices and collections | Separate invoice and confirmed-collection registers; show balances, allocation and bank reference. | Invoices are service/non-stock; no dispatch, customer refunds or credit notes. |
| Tax and statements | Tax code maintenance and report selection; show cutoff/date and control differences alongside results. | Generic configured tax only; operational statements are not statutory filing. |
| Master imports | Input → preview → review errors → explicit commit, with expiry and final result. | JSON create-only; no partial commit and no financial-opening import. |
| Privacy cases | Restricted case list and verified subject detail; decision and access extract require review. | Avoid exposing credentials or third-party data; retained history and quotation lines require separate review. |
| Account security and administration | Personal password/sessions first; authorised user administration, audit and recovery as separate sections. | MFA, last-admin protection and two-person recovery remain intact. |

## Interaction states to design for every screen

1. **Loading / empty:** distinguish no records, filtered-out records and lack of permission. Do not invent counts or sample live business data.
2. **Editing:** label required fields and units; keep entered data after validation errors. Warn before discarding; give an explicit cancel path.
3. **Save and uncertain response:** show progress, success or failure. On a lost response, check server state or retry unchanged while the workspace remains open; do not encourage duplicate transactions.
4. **Concurrent change:** preserve the user's context, explain stale version, and require refresh and deliberate review before a new action.
5. **Financial posting:** display date, source, amount, destination and consequences before confirmation; show resulting status and linked accounting evidence afterward.
6. **Keyboard and scaling:** logical tab order, clear focus, labelled controls, headings, non-colour status, accessible tables, 100–200% scaling and human screen-reader review.

## Implementation and acceptance

Implement the shared shell and patterns first, then connection/security, master data, purchasing, finance/stock, billing, and operations. Deliver role-scoped navigation and actual screens together with their relevant contract, tests and guide updates. Verify with synthetic two-user and multi-role walkthroughs, failure/retry and stale-write scenarios, accounting reconciliation, accessibility review, performance and recovery drills. Signed release, deployed schema, business acceptance and legal/accounting policy are separate gates. Do not represent planned RFQs, returns, quote award, credit notes, automatic bank payments or production certification as implemented.
