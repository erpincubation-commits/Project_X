# Project X ERP: P2P team test guide

**Reviewed:** 28 November 2026  
**Source baseline:** application 0.2.0, schema 16  
**Audience:** internal purchasing, warehouse, accounts payable, approval, audit and test teams  
**Status:** test instructions for implemented behaviour; not production certification

Use this guide to record repeatable acceptance evidence. The maintained [desktop user guide](USER_GUIDE.md) has detailed field instructions; [procurement](PROCUREMENT.md), [trade workflows](TRADE_WORKFLOWS.md), and the [Phase Two gap map](P2P_BUSINESS_PROBLEM_MAP.md) define the current boundaries. Confirm the installed client, API and database schema before testing. Source code and a passed automated test do not prove that a company installation was upgraded.

## Prepare an isolated test run

1. Use a disposable on-premises test database and a matching desktop/API build. Back it up before tests that create or post records. Do not run this script against a business database.
2. Have separate active accounts for `admin`, `purchasing`, `requester`, two `business_approver` users, `inventory_manager`, `accountant` and `auditor`. Complete MFA individually. Never share a user session to simulate independent approval.
3. Have an open accounting period, an active warehouse, stock and service items, an active expense account for the service item, and an applicable tax code. Confirm permissions in [Roles and navigation](USER_GUIDE.md#roles-and-navigation).
4. Choose a unique run ID such as `QA-20261127-A`. Prefix every master, request, quotation, delivery and invoice reference with it. Use fictional names and test amounts. Keep credentials, MFA codes, bank details and personal data out of screenshots and shared notes.
5. Record client version, API version, schema status, tester, date, test database identifier and run ID in the results template below. Use your organisation's approved evidence store.

### Optional fictional factory dataset

The development workspace has an isolated factory demonstration at `http://127.0.0.1:3314`. Its protected local access file is `.local/factory-demo-private/access.txt`; it is **not** part of this guide and must not be shared with the team. Ask the local operator to provision individual demo accounts or a fresh test database. The factory dataset already includes a bearing request/order, a partial receipt with damage, a posted invoice, a submitted payment, and another pending request. It is useful for read-only exploration. Perform mutation tests on a fresh disposable database so testers do not invalidate each other's results. The demo password may have been rotated; use only the current protected file.

## Record results

For each case, record **Pass**, **Fail**, **Blocked** or **Not run**; the tester, time, record number, expected and actual result, screenshot or sanitized log reference, and defect ID. Redact session tokens and private data. A blocked case needs a reason and an owner. Re-run failed cases after a fix and preserve the original result.

| Run metadata | Value |
| --- | --- |
| Test run ID / database | |
| Desktop / API / schema baseline | |
| Test date and team | |
| Defect tracker and evidence location | |

| Case | Result | Record or evidence reference | Defect / note |
| --- | --- | --- | --- |
| P2P-01 through P2P-18 | | | |

## Core end-to-end cases

Run cases in order unless a case says to use a separate record. Refresh registers after another account acts; do not assume an unsaved form was transferred between workspaces.

| ID | Actor and action | Expected result |
| --- | --- | --- |
| P2P-01 | Admin/purchasing creates an active supplier, a stock item and a service item with a valid expense account. Search the registers. | Unique codes persist; service account is visible only in the permitted setup; history records creation. |
| P2P-02 | Purchasing enters a supplier with the same normalized name, email or phone as another supplier. Then records an internal **Duplicate review reference** and saves. | First save shows matches; save with reference succeeds and history/audit retain it. An API/import attempt without a reference is refused. The check does not claim legal identity verification. |
| P2P-02A | Purchasing submits fictional registration and evidence references with a future expiry. A different administrator reviews it; test expired date, same-user review and resubmission. | Pending, approved/rejected and expired states display; invalid dates and self-review are refused; history and audit preserve transitions. New orders are blocked for pending, rejected or expired qualification; suppliers without any qualification record remain eligible with the default policy, and are blocked when REQUIRE_SUPPLIER_QUALIFICATION=true. Server-side qualification filters find each state across pages and deny requesters. |
| P2P-03 | Requester creates a draft with a stock line, preferred supplier, need-by date and justification; saves and revises it. | Server-calculated estimate and version persist; draft has no PO or ledger posting. |
| P2P-04 | Requester submits to an independent approver. Approver opens **Assigned to me**, approves; repeat with a separate request and rejection reason, then revise and resubmit. | Assigned queue/status and history update; requester cannot approve own request; rejected history remains. |
| P2P-05 | On separate submitted requests, requester withdraws/resubmits or reassigns; assigned approver hands off with a reason. | Versions and history change; the previous approver loses assigned access; original submission time survives reassignment/handoff and resets on resubmission. |
| P2P-06 | Purchasing records two complete supplier quotations for an approved request, recommends one with a reason, and withdraws an obsolete quote. | Quotes, current eligibility and append-only recommendation/withdrawal history are visible. Recommendation alone does not change approved prices or issue a PO. |
| P2P-07 | Purchasing issues a PO from the approved request, optionally linking an eligible quote at the exact approved quantities/prices. Records acknowledgement and expected date. | Order snapshots, quote link and versioned acknowledgement are retained. An expired/withdrawn or repriced quote cannot be linked. |
| P2P-08 | Inventory manager posts a partial goods receipt, recording accepted and damaged quantities and a delivery reference. Search, use **Damaged deliveries only**, and filter **Entry lag** at 1/3/7 days using a deliberately older posting date in a disposable test run. | Accepted stock and GRNI increase at PO cost; damaged quantity is evidence only and remains available for replacement. Duplicate delivery reference is refused. Entry lag reflects UTC calendar days between entered posting date and record creation, not verified physical delivery time. |
| P2P-09 | On a service PO, a different inventory manager posts service acceptance with reference/evidence. | Accepted service posts expense against GRNI, with no stock movement; acceptance cannot exceed order quantity. Finance must approve this accounting treatment before production use. |
| P2P-10 | Accountant creates a supplier invoice, allocates only unbilled accepted goods/service receipts, matches and posts it. | Draft shows match result; posted invoice creates AP/tax and clears eligible GRNI. Damage cannot be invoiced. |
| P2P-10A | Finance matches a draft with a price exception, assigns a different active reviewer with a reason, then reassigns it. Test unassigned, assigned-to-me and 24-hour filters; let the current owner decide. | Unassigned cases are hidden from reviewers; only the current owner can decide. Version conflicts and creator assignment are refused. History retains assignments and reasons; blocking receipt/quantity/tax issues still cannot be waived. |
| P2P-11 | Use separate drafts to test duplicate invoice reference, excess quantity, missing receipt, incorrect tax/date and unit-price variance. Have a different authorised reviewer accept or return a price exception. | Invalid matches cannot post; variance decisions are versioned and invalidated by edits. Admin tolerance changes are audited and rechecked at posting. |
| P2P-12 | Accountant creates a partial payment allocation for posted AP and submits a batch to two distinct approvers. Each approves with their own MFA session. | AP is reserved; self/duplicate approval and over-allocation are refused. Batch becomes ready only after required independent decisions. |
| P2P-13 | After a real test-bank confirmation outside ERP, authorised finance user records the transfer reference. Use a separate batch to test rejection/cancellation. | Completed transfer reduces AP and appears in bank reconciliation; execution reference cannot be reused. Do not represent ERP approval as a bank transfer. |
| P2P-14 | Finance/auditor checks AP ageing, GRNI, stock valuation, trial balance, supplier and item invoiced spend, issued purchase order value, supplier delivery follow-up, supplier exceptions/rework and bank outstanding items. Test a damaged receipt, repeated matching exception, partial overdue delivery and a fully accepted on-time stock/service order. | Invoice totals reconcile and item spend reconciliation passes; order value and delivery counts move as expected. Supplier exceptions show the damaged receipt/quantity, count every matching hold event and count distinct affected invoices without assigning supplier fault. Correct role scope and date filters produce expected records. |

## Control, usability and recovery cases

| ID | Actor and action | Expected result |
| --- | --- | --- |
| P2P-15 | Admin/purchasing loads **Approval workload** and filters the request queue by waiting time. Requester/approver tries cross-user workload access. | Permitted roles see paged pending ageing and recent decision averages; restricted roles cannot. Handoff time is attributed to final approver, so it is not an individual SLA. |
| P2P-16 | Admin/purchasing previews a JSON supplier import containing a duplicate; supply a review reference, then commit. Create a conflicting supplier between another preview and commit. | Preview flags missing reference; reviewed import retains audit/history; a newly found unreviewed match rolls back the whole batch. |
| P2P-17 | Open an order's related receipts and permitted invoices. Search requests, orders, receipts, invoices and payments; test pagination and role restrictions. | Links open the correct saved record; filters apply to the full permitted register before paging. Unsaved form work is not carried across sections. |
| P2P-18 | Retry a write with the same idempotency key after an uncertain response; submit a stale version from another session; restore a disposable backup in a separate recovery rehearsal. | Same-key retry returns one committed result, conflicting version is refused, and the recovery run proves the operator can restore the target schema and reconcile records. Do not restore over the demo or business database. |

## Sign-off gates

Invoice-source review acceptance: open a draft supplier invoice with a price exception, select **Review invoice source documents** and compare order quantity/price, invoiced quantity/price, allocated receipt reference, accepted/damaged and uninvoiced quantities. Unallocated receipts must not appear. Open a posted service invoice and verify its service evidence and reduced uninvoiced quantity, without goods-source records. Refresh after another user's posting; switch invoice and ensure old details clear. A missing allocation must show guidance and still fail normal matching as applicable. Customer invoices must not expose this view; permissions remain server enforced.

Supplier-invoice JSON acceptance: prepare a new supplier draft with valid order, accepted sources and tax selections. Generate its JSON template, add a forbidden `status` field and validate; expect refusal with unchanged form and no new invoice. Remove the field, opt into replacing unsaved fields and validate; check every field and confirm the server invoice count remains unchanged until Save. Save normally, run matching and post/resolve under existing controls. Test malformed/oversized data, invalid dates, unknown/foreign order/source IDs, unavailable tax codes, duplicate acceptance lines, a source already billed concurrently and duplicate invoice reference. Only a new unsaved supplier draft offers import. Protect pasted/source invoice data; no credentials or real invoices in test evidence.

Qualification-renewal queue acceptance: in a disposable database, prepare approved qualifications expiring yesterday, today, tomorrow, in 30 days and in 31 days. **Approved — expires within 30 days** must include today/tomorrow/day-30 only. Pending, rejected and missing records must be excluded even if dated within the range. Check search/contact/active filters, pagination, refresh and denied requester access. Confirm the order gate still treats today's validity as current, and renewal resubmission follows independent review. The API suite covers the date boundaries and restricted access; manual UI acceptance remains separate.

Mandatory qualification policy acceptance: with the API configured `REQUIRE_SUPPLIER_QUALIFICATION=true`, attempt an order for a supplier without qualification; expect refusal and no order creation. Submit qualification, verify pending/rejected/expired cases remain blocked, then independently approve unexpired qualification and issue successfully. Restart a separate staging instance with false and confirm a supplier with no record can be used, while an expired recorded qualification still blocks. Invalid values must prevent configuration startup. Existing orders and downstream transactions retain their current workflow. Record actual service configuration separately from source evidence.

### Automated desktop evidence — 28 November 2026

The invoice-source review desktop run completed with exit code 0. It checked a held goods invoice's order-versus-invoice prices, allocated receipt's accepted/damaged/current-uninvoiced quantities and exclusion of another receipt. It also checked a posted service invoice's evidence and zero uninvoiced quantity, with no goods receipt displayed for that line. The existing multi-role workflow and sampled automated accessibility completed afterward. Local evidence: `.local/phase2-invoice-sources-desktop.log`. This confirms the synthetic goods/service scenarios; it does not replace all manual missing-source, failure and role acceptance cases.

The later single-invoice JSON run also passed the desktop assertions for template generation, forbidden `status: POSTED` rejection with unchanged form, valid preview with unchanged server invoice count, and ordinary invoice save/match/independent price review afterward. Local evidence: `.local/phase2-invoice-import-desktop.log`. Parser unit tests cover malformed/oversized JSON, unsupported versions, invalid dates/quantities, duplicate acceptance allocations and privileged fields. This evidence covers single-invoice structured preview; it does not establish OCR, bulk import or third-party format compatibility.

The isolated multi-role Electron harness completed with process exit code 0 against a newly created disposable test database on the local test cluster. Build/source baseline: working tree, application 0.2.0 / schema 16. The run covered authentication, request approvals, purchasing, partial/damaged receiving, independent invoice exception assignment/decision, dual payment approval and recorded execution, customer collection, reconciliation, service acceptance/invoicing, imports/privacy and sampled automated accessibility. The related-service check loaded an order's related documents, expanded its acceptance, verified the service evidence/table and confirmed zero uninvoiced quantity after posting the service invoice. Local diagnostic evidence is in `.local/phase2-related-service-desktop-final.log`; review/redact local logs before sharing.

The test locator now selects the enabled **Load related documents** control, avoiding the ambiguous disabled/enabled match from the previous attempt. The prior run's failure remains historical evidence. This pass is bounded to the harness and synthetic fixture; it does not sign off all manual cases, all Phase Two features, installation, production policy or business acceptance.

Related service-document acceptance: open a service order and select **Load related documents**. Expand each acceptance and verify evidence, recorded time/lag, accepted quantities and values against Receipts. Load retained history inline. Post an invoice in a separate finance session, reload related documents and verify reduced uninvoiced quantities. Mixed goods/service orders must show both document types. An order without acceptances shows the empty state; receiving lag filters must not hide related records. Existing invoice-access restrictions must still hold.

Service-entry-lag acceptance: post synthetic service acceptances with recent and older dates in an open test period, select the order and apply Any/1/3/7-day filters. Verify **Recorded**, lag and filtered membership, refreshing after another account posts. Invoice source selection must still include all eligible acceptances irrespective of the receiving screen's filter. Invalid filter values must be refused. Verify local display versus UTC-calendar calculation and keep actual completion evidence separate.

Approver holding-time acceptance: submit a request to A, hand off to B, then decide or withdraw it. Run **Approver holding times** for the assignment end dates. Confirm separate intervals attributed to A and B, with boundaries at the recorded handoff; an open B assignment must remain excluded until ended. A same-key retry must not add an interval. Check UTC end-date boundaries, pagination, empty dates, invalid ranges and denied requester/business-approver access. The isolated API fixture independently checks a two-hour A interval followed by a three-hour B interval. Human UI acceptance remains separate.

Historical approval-cycle acceptance: submit a request, reject it, revise/resubmit and approve it. In **Purchase requests → Historical approval cycles**, run a range containing both decisions. Confirm two rows with distinct versions, historical outcomes, final approver and nonnegative elapsed hours. Verify repeated same-key decision retries create one event, paging retains the loaded range and an empty range shows no results. Requests still pending or withdrawn without decisions must not appear. Requester and business-approver accounts must be denied cross-user access. UTC date boundaries control inclusion even when displayed local timestamps differ. No per-approver holding-time or SLA claim is made.

CSV export acceptance: in Statements run a synthetic date range and export each of the five P2P reports. Verify selected report columns, range/currency/export-time metadata and fresh totals against source records. Edit date fields without rerunning and confirm the export retains the loaded report range. Cancel a save dialog and confirm no file is created. Export an empty period and check headings only. Test names containing commas, quotes, Unicode and spreadsheet formula prefixes; formula-like text must remain literal. A user without `books.read` must fail the underlying reporting call; a disconnected/expired session must not produce a success message. Item spend with a reconciliation difference must be refused. Store resulting supplier-data files in the approved evidence location.

Test description amendments on an issued order: Purchasing proposes a changed description with a reason; an independent business approver rejects and then approves separate proposals. Confirm the effective description stays unchanged until approval, the proposer/requester/order creator cannot decide, concurrent decisions produce one result and a version conflict, later order activity invalidates an outstanding proposal, and history retains each proposal/decision. Quantities, prices and total must stay unchanged. Commercial line amendments remain pending.

The test lead reconciles every record's expected status and accounting result; the security lead reviews role and MFA evidence; Finance reviews service expense timing, tax and matching tolerance; operations validates backup/restore and upgrade evidence. Record unresolved defects and case IDs. A green source build or these manual cases alone does not establish deployment, statutory compliance or production readiness.

## Phase Two still pending

This is the current implementation gap list, not a claim that Phase Two is complete. Track each item with owner, business rule, acceptance cases and release evidence in the team's backlog. The [problem map](P2P_BUSINESS_PROBLEM_MAP.md) provides the A–J context.

| Area | Remaining capability or decision |
| --- | --- |
| Procurement and approvals | Split/combined sourcing, quoted-price reapproval and allocation; configurable threshold routing, timed delegation, escalation and notifications. |
| Supplier lifecycle | Qualification, registration/document validation and expiry, verified bank-detail maker/checker, deeper legal-identity duplicate detection. |
| Orders and receiving | Controlled PO amendments, actual supplier transmission, delivery alerts, quarantine, returns/claims and receipt-delay measures. Return/credit posting needs Finance approval. |
| Invoice matching | OCR/PDF and bulk ingestion, non-PO service invoice policy, automatic exception escalation and jurisdiction-specific tax validation. Single-invoice JSON preview and manual independent exception ownership are implemented. |
| AP and payments | Automatic deadline alerts, early-payment discount policy, verified payment destination, bank-file/API transmission and reconciliation integration. |
| Visibility and UX | Department/category spend, policy-defined supplier scorecards and historical approval-cycle reports; cross-document navigation, safe draft continuity and reviewed exports. Recorded damaged-receipt and invoice-exception rework reporting is implemented. |
| Release evidence | End-to-end desktop, accessibility, load, recovery, security and Finance acceptance on the target on-premises installation; approved upgrade/rollback and actual database migration evidence. |

Do not test unsupported actions by entering substitute journal or stock records to imitate supplier returns, credits or bank transfers. Record those as **Blocked—feature pending** and link the business decision needed to release them.
