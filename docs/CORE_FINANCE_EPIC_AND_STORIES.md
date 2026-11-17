# Core and Finance completion: epic and user stories

**Prepared:** 17 November 2026  
**Status:** Proposed backlog; not implemented, estimated, scheduled or accepted  
**Source baseline:** Application 0.2.0 / database schema 7; installed versions are unverified  
**Parent plan:** [ERP module roadmap, phase 1](ERP_MODULE_ROADMAP.md#4-delivery-sequence-and-gates)  
**Existing pilot:** [PIL-01–08](NEXT_SPRINT_USER_STORIES.md) remain phase 0 and retain their ten-day capacity

## Epic: CORE-FIN — Complete the core and Finance foundation

**As** the business owner and Finance team, **I want** a secure, recoverable and financially reconcilable core ERP with controlled corrections, opening balances, reporting and approvals, **so that** an agreed core release can be evaluated for operational use and provide a sound foundation for later modules.

**Business outcome:** authorised users can maintain and recover access, operate purchasing and books with appropriate controls, correct supported posted transactions, bring in and reconcile opening balances, and produce reviewed financial evidence. Customer IT can operate, monitor and restore the selected release. The business can decide whether that specific release and installation meet its acceptance gates.

**Existing foundation:** MFA, nine fixed roles, INR books, periods, journals, weighted stock, purchasing/receipts, AP/AR, supplier payment approvals, collections, reconciliation, master-only imports and limited privacy/backup tools exist in source. Consult the [user guide](USER_GUIDE.md), [trade workflows](TRADE_WORKFLOWS.md) and [posting contract](ACCOUNTING_POSTINGS.md) for their present limits. This epic describes remaining work; it does not establish a deployed schema or prior acceptance.

**In scope:** FUP-01–08; Finance correction/opening and Finance controls/reporting from MOD-FIN-01/02; shared-party/access design from MOD-PLT-01; supporting release, security, privacy and operational evidence. Candidate cost centres, budgets and bank-file matching are separately selectable increments in the same phase; core production scope must explicitly decide whether to include them. Country-specific tax/statutory functionality is selected and scoped by the Finance owner, not presumed from INR.

**Outside this epic:** new CRM and stocked Sales workflows, stock dispatch/COGS, HR/payroll, Marketing, manufacturing, foreign currency, multi-company and automatic bank transfer. Customer credits in this epic target existing service/non-stock invoices; physical sales returns and their stock effects belong to MOD-SLS-02. Supplier receipt returns are included because they correct the existing purchasing flow. Unsupported manual edits of posted data or direct postings to protected control accounts are not correction workflows.

**Accountable functions to name:** product/business owner, Finance owner and qualified accountant, security/privacy leads, engineering lead, customer IT/operator and release owner. One person may hold several planning responsibilities where appropriate; implemented approval controls and independent review still apply. No named owner or staffing is assumed.

### Epic acceptance and release decision

1. The selected scope, initial jurisdiction and tax/accounting treatment, supported environment, data-retention policy, recovery objectives and evidence reviewers are recorded. Explicitly identify included and deferred stories and explain any dependencies of the selected release.
2. Complete selected stories with the evidence specified below, including negative permission and financial-integrity tests, accessible desktop workflows, reviewed operator/user instructions and migration/compatibility checks. Unselected optional increments have a disposition; an unimplemented required story cannot be marked done by this plan.
3. A Finance reviewer signs off independent expected results and source-to-control reconciliation for openings and corrections, including stock, GRNI, AP, AR, bank, tax and GL as applicable. Retried, concurrent and failed transactions do not over-allocate, duplicate effects or leave partial postings.
4. Demonstrate protected deployment, named access and recovery, privacy handling, monitored backups and isolated restore against agreed recovery objectives. Record security, workload, accessibility and release evidence for the actual candidate and environment.
5. The business and release owners record blockers, accepted residual risks and a decision for that specific installation and scope. A synthetic pilot, signed installer, source change or completed planning artifact alone is not production approval, statutory certification or GDPR compliance.

**Sizing:** Stories have relative priority and dependencies only. Estimate implementation, migration, UI, tests, documentation and review after discovery; no calendar, velocity or staffing commitment is inferred from the pilot. Priority `Core` means a candidate core-release requirement; `Selectable` means the release owner and Finance must explicitly include or defer it. Priority is a planning proposal, not approval.

## Story map and traceability

Each `CF-*` story refines the existing IDs; it does not replace or independently duplicate an FUP/MOD commitment. Close an FUP/MOD only after all selected applicable child evidence and the original acceptance boundary are satisfied. Cross-cutting stories must be split further if refinement finds they are too large for a delivery iteration.

| ID | Story | Priority | Refines | Key dependencies |
| --- | --- | --- | --- | --- |
| [CF-01](#cf-01--approve-core-release-scope-and-financial-rules) | Approve core scope and Finance rules | Core | FUP-07, MOD-FIN-01/02 | Pilot findings; Finance/security/privacy/IT reviewers |
| [CF-02](#cf-02--let-users-change-their-password) | User password change | Core | FUP-01 | Existing MFA/session controls |
| [CF-03](#cf-03--recover-password-and-mfa-access) | Authorised password/MFA recovery | Core | FUP-01 | CF-02; independent identity-verification policy |
| [CF-04](#cf-04--control-api-and-proxy-abuse) | API/proxy abuse controls | Core | FUP-02 | Deployment/proxy trust profile |
| [CF-05](#cf-05--prepare-a-correction-posting-contract) | Correction rules and fixtures | Core | FUP-03, MOD-FIN-01 | CF-01; accountant |
| [CF-06](#cf-06--return-an-uninvoiced-supplier-receipt) | Uninvoiced supplier return | Core | FUP-03, MOD-FIN-01 | CF-05 |
| [CF-07](#cf-07--correct-an-invoiced-supplier-purchase) | Supplier credit and invoiced return | Core | FUP-03, MOD-FIN-01 | CF-05, CF-06 |
| [CF-08](#cf-08--issue-a-customer-service-credit) | Customer service credit | Core | FUP-03, MOD-FIN-01 | CF-05 |
| [CF-09](#cf-09--record-a-confirmed-refund) | Supplier/customer refund recording | Core | FUP-03, MOD-FIN-01 | CF-07/CF-08 as applicable |
| [CF-10](#cf-10--prepare-opening-migration) | Opening mapping and rehearsal | Core | FUP-04, MOD-FIN-01 | CF-01; source inventory and opening policy |
| [CF-11](#cf-11--import-and-reconcile-opening-balances) | Import opening balances | Core | FUP-04, MOD-FIN-01 | CF-10 |
| [CF-12](#cf-12--configure-approval-and-delegation-policy) | Configurable approval policies | Core | FUP-05 | CF-01; role/SoD design |
| [CF-13](#cf-13--show-assigned-work-and-notifications) | Assigned work and notifications | Core | FUP-05 | CF-12 for policy-driven tasks |
| [CF-14](#cf-14--complete-privacy-discovery-and-requests) | Privacy discovery and requests | Core | FUP-06 | Approved data inventory/policy |
| [CF-15](#cf-15--enforce-retention-and-restore-replay) | Retention, holds and recovery replay | Core | FUP-06 | CF-14; customer retention and recovery decisions |
| [CF-16](#cf-16--deliver-reviewed-finance-reports-and-exports) | Reviewed Finance reports/exports | Core | FUP-07, MOD-FIN-02 | CF-01; CF-11 for opening-data scenarios |
| [CF-17](#cf-17--design-shared-parties-and-access) | Shared-party/access design | Core | MOD-PLT-01 | Existing customer/supplier identities; CF-12 access design |
| [CF-18](#cf-18--validate-capacity-and-query-plans) | 50-user and large-data validation | Core | FUP-08 | Selected release features and representative environment |
| [CF-19](#cf-19--define-cost-centres-and-budgets) | Cost centres and budgets | Selectable | MOD-FIN-02, FUP-05 | CF-01, CF-12 |
| [CF-20](#cf-20--import-and-match-bank-statements) | Bank-file import and split matching | Selectable | MOD-FIN-02 | CF-01; approved bank format and matching policy |
| [CF-21](#cf-21--accept-the-core-release-and-recovery) | Core release/recovery evidence | Core | Phase 1 gate; FUP-01–08 | Selected core stories; pilot and named reviewers |

## Common acceptance rules

All implementation stories include server-side permission checks for relevant action/record/field/report/export scope; explicit state and version rules; audit/history appropriate to the action; safe errors without secrets or unnecessary personal information; accessible keyboard/screen-reader paths; and user/operator documentation updated with actual behaviour. Sensitive approvals use independent actors where specified. Validate direct API denial, stale/concurrent requests and role changes, not merely hidden buttons.

Financial writes use exact INR paise and existing quantity/cost precision, open-period checks, source references and reviewed tax snapshots. Maintain immutable posted history, protected control accounts, company financial locking or a separately reviewed equivalent, atomic source/stock/journal/audit/idempotency outcomes and actor-scoped retry conflict handling. A timeout after commit must be reconciled without duplicate posting. Existing payment recording represents an externally confirmed transfer; this backlog does not send money.

Use synthetic fixtures and independent expected results; record revision, environment, schema, role/actor, command or scenario, result and reviewer. Rehearse migrations and restore on isolated copies. Existing tests or workflow definitions are not evidence for newly implemented stories. Capture defects and owners without credentials, real personal data, private keys, database URLs or recovery material.

## CF-01 — Approve core release scope and financial rules

**Story:** As the Finance owner, I want a reviewed release scope and accounting policy so that the team can implement and test the right rules for our first jurisdiction.

**Acceptance criteria**

1. Record selected jurisdiction, accounting/tax requirements, retained INR policy, period dates/timezone, eligible sources, correction/valuation/rounding and statutory reporting obligations with a qualified accountant's review. INR alone does not select a jurisdiction.
2. Document the current chart/system mappings, protected control accounts, source-to-ledger effects and remaining production gaps. Identify any reports/exports, bank formats, budgets and retention rules selected for this release.
3. Name decision/review owners, pilot findings, environment and unresolved dependencies; create independent synthetic expected-result fixtures for partial settlement, correction and opening cases.
4. Record selected/deferred CF stories and release gates. A policy or this story does not enable postings or certify legal compliance.

**Evidence:** Approved scope/decision record and accountant-reviewed posting/fixture references. The [draft decision record and synthetic examples](CF01_FINANCE_DECISION_RECORD.md) are pending decisions and review; they do not satisfy approval. **Dependencies:** Pilot findings and Finance/privacy/IT input. **Trace:** FUP-07, MOD-FIN-01/02, FR-FIN-01–09.

## CF-02 — Let users change their password

**Story:** As a signed-in user, I want to change my password securely so that I can replace a compromised or expired credential.

**Acceptance criteria**

1. Require an active authenticated session and current-password verification plus any separately approved step-up/MFA policy; enforce the current password-length/UTF-8 limits or a deliberately migrated, documented policy.
2. On success atomically change the hash, revoke other sessions and pending challenges as defined by policy, audit the action without secrets and give clear reauthentication guidance. Specify the current session's behaviour explicitly.
3. Reject invalid current credentials, invalid new passwords, disabled/restricted users and excessive attempts with safe responses; concurrent changes cannot silently overwrite each other.
4. Direct API, desktop, expiry, revocation, audit-redaction and lost-response paths are tested; no password or token appears in diagnostics or retry records.

**Evidence:** Targeted access/API/desktop tests and updated sign-in guide. **Dependencies:** Existing MFA and sessions. **Trace:** FUP-01.

## CF-03 — Recover password and MFA access

**Story:** As an authorised identity recovery operator, I want to restore a verified user's access so that credential loss does not require unsafe database edits.

**Acceptance criteria**

1. Define independent identity verification, eligible operator and separation-of-duties controls; prevent self-escalation, privacy-restricted reactivation and loss of the last active administrator. Preserve supported recovery codes.
2. Issue a limited, single-use, short-lived recovery mechanism without disclosing account existence; protect delivery, rate limits, audit and operator access. No permanent bypass or shared recovery account is created.
3. Completion revokes old sessions/challenges and affected factors, requires fresh MFA enrolment and lets the user establish a compliant password as applicable. Expired, reused, altered or concurrently redeemed attempts fail.
4. Exercise lost authenticator and lost recovery codes, emergency access, role changes, cancellation and compromised recovery attempts. Document operator identity checks, secret handling and escalation without publishing recovery material.

**Evidence:** Threat review, allowed/denied and expiry/replay tests, operator rehearsal. **Dependencies:** CF-02 and approved recovery policy. **Trace:** FUP-01.

## CF-04 — Control API and proxy abuse

**Story:** As the security operator, I want bounded requests and actionable alerts so that expensive reads and writes cannot exhaust the shared service unnoticed.

**Acceptance criteria**

1. Define per-actor/network budgets and bounded request/report/import work, trusted-proxy configuration and exclusion/health-check policy; preserve existing login throttles and reasonable legitimate access.
2. Exceeding a limit yields a safe stable `429` and documented retry guidance; direct API, forged forwarding headers and expensive pagination/report paths respect the applicable controls.
3. Demonstrate expected restart and multi-process behaviour, including how counters are shared or limits change. Document fail-safe behaviour and operational alert ownership without claiming unimplemented distributed coordination.
4. Test normal workloads, boundary bursts, legitimate recovery, storage/limiter failure and a bounded denial-of-service scenario; logs contain no request bodies, credentials or sensitive records.

**Evidence:** Security design, automated boundary/load results and proxy/monitoring handover. **Dependencies:** Approved proxy and deployment profile. **Trace:** FUP-02.

## CF-05 — Prepare a correction posting contract

**Story:** As the accountant, I want reviewed correction and settlement rules before development so that each supported return, credit and refund reconciles to its original source.

**Acceptance criteria**

1. Specify separate supplier uninvoiced receipt return, invoiced purchase credit/return, service customer credit and supplier/customer refund paths, including partial quantities/values and already-settled sources.
2. Define source/allocation ceilings, inventory valuation and current-versus-original-cost variance, GRNI/AP/AR/tax/bank effects, credit/refund evidence, open-period/date rules and decisions for blocked/inactive records.
3. Define independent approval/exception rules, rounding and final-allocation treatment, retry/locking, correction of errors and source/history linkage. Physical movement and financial credit may be separate events.
4. Finance independently calculates representative expected postings and control totals, including partial/full, price/tax differences, later settlement and failed/concurrent attempts; review and version the contract.

**Evidence:** Accountant-approved posting matrix, source/state diagrams and expected-results fixtures. **Dependencies:** CF-01. **Trace:** FUP-03, MOD-FIN-01, FR-FIN-09.

## CF-06 — Return an uninvoiced supplier receipt

**Story:** As warehouse and Finance staff, I want to return eligible accepted goods before invoicing so that stock and GRNI reflect the remaining obligation.

**Acceptance criteria**

1. Link each return line to the original order and accepted receipt line; permit only authorised eligible remaining quantities, with reason, warehouse, date and current version. Damaged evidence that never entered stock is not returned as valued stock.
2. Atomically create the reviewed outgoing movement, GRNI/Inventory posting and any approved valuation variance, preserving original receipt/history and blocking negative stock or closed-period posting.
3. Concurrent returns and invoice allocations cannot consume the same eligible quantity/value; exact retries return one result and a changed payload conflicts. Failure rolls back stock, GL, source and audit.
4. Demonstrate partial/full returns, insufficient stock, stale version and source-to-stock/GRNI/GL reconciliation against CF-05 fixtures.

**Evidence:** Posting/concurrency/retry tests and warehouse/Finance review. **Dependencies:** CF-05. **Trace:** FUP-03, MOD-FIN-01.

## CF-07 — Correct an invoiced supplier purchase

**Story:** As an accountant, I want a supplier credit and linked return for an invoiced purchase so that AP, tax and inventory corrections remain traceable.

**Acceptance criteria**

1. Capture an authorised supplier credit linked to the original posted invoice/allocations and, when goods physically return, the eligible receipt/return lines. Preserve original quantities, tax and price snapshots.
2. Bound cumulative credits and returned quantity by the applicable source after earlier corrections, payments and allocations; separately handle a price-only credit and a physical return under CF-05.
3. Post approved AP/tax/variance/stock effects atomically in an open period, with independent review where policy requires. Never mutate the original posted invoice or auto-assume a refund occurred.
4. Test partial/full credit, previously paid invoice, duplicate supplier reference, competing credits, rejected approvals and receipt/invoice/stock/GRNI/AP/GL tie-out.

**Evidence:** Independent expected-result comparison, concurrency/API/desktop tests. **Dependencies:** CF-05 and CF-06. **Trace:** FUP-03, MOD-FIN-01.

## CF-08 — Issue a customer service credit

**Story:** As an accountant, I want to credit an existing service invoice so that an incorrect or reduced charge is reflected in AR and revenue without rewriting history.

**Acceptance criteria**

1. Link an authorised credit to a posted service/non-stock customer invoice and eligible source lines, retain tax snapshots and reason, and enforce reviewed cumulative value limits.
2. Apply the approved revenue/output-tax/AR postings in an open period. An already collected invoice creates a controlled customer credit position under the reviewed allocation policy; it does not silently create a refund.
3. Concurrent credits, allocations and collections cannot exceed eligible balances. Retry/rollback preserve exactly one credit and its audit/history; forbidden users and stale versions are rejected.
4. Reconcile partial/full, tax and previously collected examples to AR, tax, revenue and GL. Stocked dispatch and physical sales returns are outside this story.

**Evidence:** Finance-reviewed posting tests and direct denial/desktop scenarios. **Dependencies:** CF-05. **Trace:** FUP-03, MOD-FIN-01.

## CF-09 — Record a confirmed refund

**Story:** As an accountant, I want to allocate a confirmed supplier or customer refund to an eligible credit so that balances and bank evidence remain accurate.

**Acceptance criteria**

1. Record direction, party, confirmed external transfer date/reference and allocations to eligible posted credit balances; enforce unique reference and same-party/currency, open-period and outstanding limits.
2. Apply the appropriate reviewed bank and AP/AR/control postings only after independently required decisions. A recorded refund does not initiate a bank transfer; approval alone does not post a payment.
3. Concurrent partial refunds, allocations and retries cannot over-settle or create a duplicate. A failed operation leaves no source, allocation, posting or audit fragment; conflicting retry payloads fail.
4. Verify supplier receipt/customer payout, prior settlement, invalid reference, rejection/timeout and bank reconciliation, including matching external evidence before retry.

**Evidence:** Bank/AP/AR/GL reconciliation and permission/retry tests. **Dependencies:** CF-07 and/or CF-08. **Trace:** FUP-03, MOD-FIN-01.

## CF-10 — Prepare opening migration

**Story:** As a migration operator, I want reviewed mapping and a dry-run process so that opening data can be checked before it affects books.

**Acceptance criteria**

1. Agree cutover date, source ownership, templates and mapping for chart, customers/suppliers/items, stock by warehouse, AR/AP open items, bank and balanced GL opening totals. Preserve existing codes/identities and define duplicate handling.
2. Define exact precision, inventory valuation, open-item detail versus control totals, clearing/opening accounts, ordering, tax treatment and reconciliation tolerances with Finance; prevent double counting between subledgers and GL.
3. Produce row-level validation/errors, expected totals and exceptions from synthetic source data without creating production records; identify unsupported data and resolve before commit.
4. Rehearse backup, isolated migration, rollback/recovery and business approval with a cutover/checklist and protected files. Current master JSON import alone does not satisfy opening migration.

**Evidence:** Approved mapping, sample dry-run report and recovery/cutover plan. **Dependencies:** CF-01. **Trace:** FUP-04, MOD-FIN-01.

## CF-11 — Import and reconcile opening balances

**Story:** As the accountant, I want an approved opening batch posted once so that stock, subledgers and the general ledger start from reconciled source balances.

**Acceptance criteria**

1. Import the CF-10 selected mappings through permission-controlled, versioned preview/approval/commit, binding reviewed input and totals to the approved batch. Reject duplicate identities, invalid quantities, unbalanced GL and out-of-scope periods.
2. Preserve source provenance and post balanced stock, AP/AR, bank and GL openings under one reviewed coherent batch contract; prevent overlap or duplicate opening stock/control balances. Explicitly define all-or-nothing behaviour and any safe staged boundaries.
3. Repeat/parallel commits and interrupted responses cannot duplicate records or partial postings; changed input requires new review. Failures give row-level/actionable errors without exposing protected data.
4. Compare source counts and totals to stock/valuation, AP/AR, bank, trial balance and GL control totals; require named Finance acceptance and a cutover record before using the migrated books.

**Evidence:** Populated-copy migration/retry tests, independent reconciliation and signed business record. **Dependencies:** CF-10. **Trace:** FUP-04, MOD-FIN-01.

## CF-12 — Configure approval and delegation policy

**Story:** As a business owner, I want controlled approval limits and delegation so that purchasing and payment decisions follow an accountable policy.

**Acceptance criteria**

1. Define versioned effective-dated rules, thresholds, approver assignments, delegation/expiry and authorised policy changes for selected existing workflows. Historical decisions retain their policy and document version.
2. Enforce decisions server-side, prevent prohibited self-approval and keep two distinct payment approvers independent of the preparer even after role or policy changes. Policy configuration itself has a separate authorised change/review path.
3. Handle missing/inactive approvers, expired delegation, concurrent decisions and document revision without granting silent overrides; changes clear or re-evaluate approvals according to the approved rules.
4. Test direct API denial, policy boundaries, stale versions, delegated access, self-approval and audit/history. Migrate existing single-role assignments without privilege elevation.

**Evidence:** Reviewed role/SoD/policy matrix, migration and negative tests. **Dependencies:** CF-01 and access design. **Trace:** FUP-05, MOD-FIN-02, MOD-PLT-01.

## CF-13 — Show assigned work and notifications

**Story:** As an approver, I want to see my pending assignments and changes so that I can act on the right documents without searching every register.

**Acceptance criteria**

1. Show only authorised assigned approvals/exceptions with document reference, state and next action; counts and links obey the same record scope as source queries.
2. Refresh or invalidate stale tasks after decision, reassignment, role change, expiry and source revision. Explain unavailable or already-decided work without revealing restricted records.
3. Provide accessible keyboard/screen-reader navigation, empty/loading/error states and safe recovery after connection loss; in-app notifications expose minimal personal/financial information.
4. Test two approvers, reassignment, denied source links, simultaneous decisions and count consistency. External email/SMS notification is not assumed.

**Evidence:** UI/accessibility review and scoped integration tests. **Dependencies:** CF-12 for policy-driven tasks. **Trace:** FUP-05.

## CF-14 — Complete privacy discovery and requests

**Story:** As a privacy officer, I want scoped discovery and reviewed request handling so that applicable personal records are found and handled consistently.

**Acceptance criteria**

1. Maintain a reviewed inventory of current user, customer and supplier fields, histories, free text, imports, logs, exports and backups, including purposes, recipients, scope and owners; identify unsupported copies explicitly.
2. Provide authorised, auditable discovery and protected export/correction/restriction decisions for the selected scope, including customers. Verify identity externally and preserve original request receipt/date and legal-hold decisions.
3. Do not silently alter posted financial/audit history or disclose other people's information. Distinguish completed action, refusal and retained-history outcomes; support reviewed handling beyond interactive result limits.
4. Test denied access, subject matching, hold conflicts, incomplete discovery, secure disclosure and session revocation when restriction applies; logs and exports exclude authentication secrets.

**Evidence:** Privacy-reviewed inventory, synthetic case and permission/export tests. **Dependencies:** Approved privacy/access policy. **Trace:** FUP-06.

## CF-15 — Enforce retention and restore replay

**Story:** As the privacy and recovery operator, I want reviewed retention and restoration procedures so that restrictions and lawful retention remain consistent after a restore.

**Acceptance criteria**

1. Configure or otherwise enforce approved retention schedules and legal holds for each selected data/copy class, with explicit owners, review dates, exceptions and protected evidence. Posted history is not silently erased.
2. Preview and independently review destructive retention actions where required; apply only authorised scope, audit the outcome and protect all current copies, exports and backups according to their lifecycle.
3. Maintain an independently protected record of post-backup restrictions/minimisations and replay them on an isolated restored copy before users regain access; document any manual steps and unresolved external copies.
4. Rehearse holds, retention expiry, restored sessions, replay failure and recovery verification with synthetic data; report any retained history and response limitations honestly.

**Evidence:** Retention/hold matrix, restore drill and privacy reviewer acceptance. **Dependencies:** CF-14 and agreed backup/recovery policy. **Trace:** FUP-06.

## CF-16 — Deliver reviewed Finance reports and exports

**Story:** As Finance, I want reproducible, permission-controlled reports and exports so that I can review and share approved accounting evidence.

**Acceptance criteria**

1. Define selected trial balance, AP/AR/GRNI/stock reconciliation, P&L, balance sheet, tax and audit/report exports by period, filters, source, calculation and rounding. Specify any jurisdiction-specific outputs selected under CF-01.
2. Reports reconcile to posted journals and eligible subledger/control sources, link to permitted sources and distinguish draft, posted, corrected and opening data. Unsupported country filing is never labelled certified or submitted.
3. Restrict fields, rows, drill-through and selected CSV/XLSX/PDF or other formats to explicit grants; protect exported files and avoid formula injection or inadvertent secret disclosure as applicable.
4. Compare independently calculated totals across correction/opening/closed-period examples; test denied reports/exports, pagination, large datasets and accessible error/empty states.

**Evidence:** Finance-approved report definitions, expected totals, permissions and export tests. **Dependencies:** CF-01; CF-11 for opening scenarios. **Trace:** FUP-07, MOD-FIN-02, FR-FIN-06/07/09/10.

## CF-17 — Design shared parties and access

**Story:** As product and engineering leads, we want a reviewed shared-party and access contract so that later CRM and Finance work can reuse trusted identities safely.

**Acceptance criteria**

1. Document current customer codes, supplier/item identifiers and related financial references; specify proposed contact/address relationships, optional employee-to-user links and authoritative domain ownership without implementing future CRM/HR workflows.
2. Define duplicate-candidate review, permitted identity linking, deletion/restriction rules and a compatible migration/backfill strategy. Matching an email alone must not merge financial identities.
3. Define role/action/record/field/search/export boundaries, account migration and SoD interactions with CF-12. Existing nine fixed roles and one-role-per-account remain current until a reviewed implementation changes them.
4. Review sample old/new contract and migration cases for preserved codes/source links, no silent privilege escalation, client compatibility, privacy scope and recovery. Create follow-up implementation stories only after design approval.

**Evidence:** Reviewed conceptual model, contracts/access matrix, migration and threat review. **Dependencies:** Existing identity inventory and CF-12 access design. **Trace:** MOD-PLT-01.

## CF-18 — Validate capacity and query plans

**Story:** As the product owner, I want representative workload evidence so that deployment limits are based on measured performance and intact books.

**Acceptance criteria**

1. Agree environment, mixed roles, dataset sizes, concurrency, ramp-up, duration, network, queries, warm-up and sampling. Include the PRD's proposed 50-user target and a large-data/query-plan profile.
2. Exercise selected current and new workflows, reads, reports, imports, controlled writes, contention and retries using isolated synthetic data; measure screen and server/report timings separately.
3. Report throughput, errors, P95, resource use, lock/pool pressure and query plans against agreed targets; identify bottlenecks and any exclusions. The existing pilot/load harness alone does not prove 50 users.
4. After the run reconcile source counts, balanced journals, stock, AP/AR/GRNI and bank controls and prove no duplicate or over-allocation. Record a supported limit or hold release if targets are not accepted.

**Evidence:** Reproducible profile, reports, reconciliation and product/IT acceptance. **Dependencies:** Selected release scope and representative environment. **Trace:** FUP-08, TR-NFR-01–04.

## CF-19 — Define cost centres and budgets

**Story:** As a Finance controller, I want cost-centre budgets and actuals so that I can review spending and approved exceptions.

**Acceptance criteria**

1. Define cost-centre ownership, hierarchy, effective dates, permitted dimensions, budget periods/versions, revisions and approval scope. Select whether budget checks are advisory or blocking for each workflow.
2. Preserve transaction dimension/budget-policy snapshots and approved exception decisions. Derive actuals from posted sources; distinguish commitments from actual expense and avoid a second ledger.
3. Enforce scoped access, independent approval and closed-period/version rules; concurrent commitments and changes follow a specified reservation/limit policy rather than silently overspending.
4. Reconcile budget/commitment/actual and exception reports to source records; test version changes, denials, retries, correction postings and export scope.

**Evidence:** Finance-approved budget model, policy and reconciliation tests. **Dependencies:** CF-01 and CF-12. **Trace:** MOD-FIN-02, FUP-05. **Selection:** Include only if the release owner selects it.

## CF-20 — Import and match bank statements

**Story:** As an accountant, I want to import an approved bank statement file and match transactions so that reconciliation takes less manual entry while preserving evidence.

**Acceptance criteria**

1. Specify selected file format, date/timezone, sign/currency, required identifiers, size/encoding and protected handling. Preview row-level errors and duplicate candidates before authorised commit.
2. Detect repeated files and transaction lines using the reviewed bank-specific identity policy; allow legitimate same-amount transactions without assuming amount/date alone is unique. Never connect to a bank or initiate transfers.
3. Match permitted split/combined statement/ledger lines under exact allocation ceilings, preserving outstanding-item carry-forward, opening continuity and chronological finalisation; immutable finalised records require a reviewed correction path.
4. Test duplicate/reordered files, competing matches, partial allocations, missing fees, stale versions, rollback/retry, period cutoffs and reconciliation to bank/GL. Deny unauthorised file and report/export access.

**Evidence:** Synthetic bank fixtures, reconciliation/concurrency tests and operator file-handling instructions. **Dependencies:** CF-01 and approved format/matching policy. **Trace:** MOD-FIN-02, FR-FIN-05. **Selection:** Include only if selected.

## CF-21 — Accept the core release and recovery

**Story:** As the release owner, I want a traceable, tested candidate and operational handover so that the business can make an informed core-release decision.

**Acceptance criteria**

1. Record included/deferred stories, candidate source/client/server/contracts/schema versions, deployment/environment, reviewed migration results and client compatibility. Reconcile scope to the actual installed system rather than the source baseline.
2. Demonstrate least-privilege service/runtime roles, trusted TLS, protected configuration, scheduled/monitored encrypted backups and off-host retention; rehearse isolated restore, session revocation and CF-15 replay against agreed RPO/RTO.
3. Collect current unit/API/desktop/security/accessibility/financial and CF-18 performance evidence, signed installer/provenance and dependencies, relevant business/user guide instructions and a named support/incident handover.
4. Finance, privacy/security, customer IT and business/release owners review open defects and required gate evidence; record approval or hold, rollback authority and residual-risk decisions. No automatic approval is inferred.

**Evidence:** Completed release record, independent reviewer decisions and environment-specific recovery/finance results. **Dependencies:** Selected core stories and [pilot gates](NEXT_SPRINT_PLAN.md#6-pilot-entry-and-completion). **Trace:** Phase 1 release gate, FUP-01–08.

## Decisions and refinement before scheduling

Select the first jurisdiction and business/accounting rules; name reviewers and owners; confirm the target installation, supported platforms and backup/retention responsibilities; choose whether budgets and bank-file work are in the core release; and agree the rollout order and estimates. Review whether any country-specific filing, tax, supplier-bank controls or other gaps require additional stories before production. No story authorises a database migration, deployment or action in a bank.
