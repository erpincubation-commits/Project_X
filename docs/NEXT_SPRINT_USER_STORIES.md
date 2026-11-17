# Next sprint user stories

**Prepared:** 16 November 2026  
**Goal/capacity:** Controlled staging pilot; one developer; two weeks.  
**Status:** Planned backlog, not implemented changes.  
**Plan:** [Next sprint plan](NEXT_SPRINT_PLAN.md)  
**Effort:** Eight developer days plus two contingency days. Estimates include relevant verification and evidence preparation.

**Expansion review, 17 November 2026:** PIL-01–08 and their estimates are unchanged. The [module roadmap](ERP_MODULE_ROADMAP.md#5-candidate-backlog-and-acceptance) owns proposed MOD-* expansion epics; they are unestimated and outside this sprint. FUP-03/04 map to MOD-FIN-01, FUP-05/07 inform MOD-FIN-02 and FUP-09 informs MOD-SLS-02. Cross-references do not mark existing follow-ups complete.

**Core/Finance story refinement:** The proposed [CORE-FIN epic and CF-01–21 stories](CORE_FINANCE_EPIC_AND_STORIES.md) break down FUP-01–08 and the phase 1 platform/Finance epics with acceptance evidence and dependencies. They are unestimated and outside PIL-01–08. Original FUPs stay open until their applicable acceptance boundaries are met; FUP-09 remains later Sales scope.

## Common acceptance rules

All application changes preserve server-enforced permissions, exact amounts, source immutability, optimistic versions and existing atomic audit/history/retry behaviour. Add named typed contracts and IPC operations where necessary; avoid generic renderer capabilities. Client prompts supplement server controls.

Use synthetic data and isolated test/staging databases. Never print credentials, MFA secrets, tokens, private certificate material or unrestricted request bodies in evidence. Store approved, sanitised evidence with its source revision, candidate version, environment, execution time, reviewer, outcome and defect references. Personal extracts, database archives and keys remain in their separately protected locations.

Each story's listed acceptance checks are future work. A previous local result, a specification, or a CI workflow definition does not mark a story done. The pilot owner must resolve any gate failure or explicitly hold entry; unused contingency does not automatically add scope.

## PIL-01 — Freeze the pilot scope and acceptance record

**User story:** As the pilot owner, I want a clear account of the supported workflow, environment and remaining limits so that reviewers assess the same release.

**Priority:** 1 · **Estimate:** 0.50 developer day · **Dependencies:** User's selected pilot goal/capacity.  
**Requirements:** Desktop PRD sections 3, 6, 9, 11–12; technical requirements TR-REL-04/05 and section 11.  
**Likely work:** Current-status sections in `README.md` and `docs/`; a pilot acceptance record and environment inventory.

**Acceptance criteria**

1. The pilot owner names the ten synthetic actors, business/finance reviewer, IT operator, privacy/security contact and release owner. Test coverage includes all nine roles and two distinct payment approvers.
2. Record two workstation builds, shared-server OS, Node/PostgreSQL versions, API origin, business timezone, dataset, supported scenario, and the source revision/candidate version. Record actual deployed schema status without inferring it from the source tree.
3. Confirm INR, moving weighted average, negative-stock blocking, generic configured tax and confirmed external payment recording. Record undecided jurisdiction and customer-specific RPO/RTO as decisions with named owners.
4. Reconcile obsolete current-status and schema/role statements across the primary documents. Clearly distinguish implemented behaviour, remaining requirements and environment evidence pending; retain source requirement IDs and historical archive notices.
5. Create an acceptance record with each PIL story, required evidence, result, reviewer, defects, mitigation and entry decision. No production acceptance is inferred from this synthetic pilot.

**Verification / done evidence:** Reviewed baseline, completed environment/owner fields, corrected status links and an agreed expected-result workbook or documented calculation for the finance scenario. Credentials are referenced by custodian, never included.

## PIL-02 — Block incompatible clients with clear upgrade guidance

**User story:** As a desktop user, I want the client and server to confirm compatibility so that an unsupported version cannot submit business transactions.

**Priority:** 2 · **Estimate:** 1.00 developer day · **Dependencies:** PIL-01 defines the supported combination.  
**Requirements:** FR-DESK-02/04/05; TR-API-01/02, TR-REL-04; app-flow version-mismatch path.  
**Likely work:** Shared contracts; server health/compatibility endpoint and guard; desktop main-process API client, typed IPC/preload and connection feedback; compatibility documentation.

**Acceptance criteria**

1. Define a minimal compatibility response with server release, API contract revision, schema compatibility and supported desktop contract range. Expose only non-sensitive metadata; keep readiness distinct from compatibility.
2. The main process supplies its own compiled client/contract identity. A supported pair can connect and sign in. The renderer cannot choose an arbitrary client identity or alter the negotiated session state.
3. Unsupported, missing or malformed compatibility metadata produces actionable upgrade guidance and blocks business writes. Define treatment of older servers and clients explicitly; do not silently assume compatibility.
4. Enforce supported contract identity on the server's business API boundary as well as the UI. The marker is a compatibility control, not an authentication credential. Missing/unsupported identity cannot bypass permission checks by sending a direct API request.
5. Reconnecting to another server clears prior compatibility/session state. Expired sessions still follow the existing authentication flow. A server becoming incompatible during an existing session rejects subsequent unsafe requests and does not create a source, journal, audit-success or retry-success record.
6. Preserve the narrow IPC boundary and HTTPS/certificate verification. Return safe errors with request references and a documented stable error code/status.

**Verification / done evidence:** Contract, server and Electron checks for supported, older, newer, missing and malformed versions; reconnect and mid-session change; direct-API rejection; a permitted transaction still completes once after an exact retry.

## PIL-03 — Deploy a protected shared staging server repeatably

**User story:** As the IT operator, I want repeatable server installation with restricted credentials and trusted HTTPS so that two Windows clients can safely share the same staging data.

**Priority:** 3 · **Estimate:** 2.00 developer days · **Dependencies:** PIL-01; IT provides machines, trust material, service-manager choice and administrative access. PIL-02 is required before final acceptance.  
**Requirements:** FR-DESK-01/02/03, FR-PLT-02; TR-DESK-01/02/04, TR-SEC-03/07, TR-REL-04/05, TR-OPS-01/02.  
**Likely work:** Documented/scripted provisioning under `scripts/` or `tools/`, explicit runtime/operator configuration, service/proxy configuration templates and deployment guide. Reuse an approved service manager; do not build a new supervisor.

**Acceptance criteria**

1. A clean staging setup can be followed twice without overwriting secrets, silently resetting accounts, destroying data or duplicating services. A preflight checks prerequisites, ports, schema plan, paths and necessary privileges before changes.
2. Separate migration/operator, runtime and backup responsibilities. The API role has the application grants it needs, but no superuser, role/database creation, schema creation, table ownership or truncate/alter/drop privileges. Restore tests use an explicitly privileged operator rather than broadening the API role.
3. Demonstrate normal application writes, sequence/function use and audit inserts under the restricted role. Attempts to alter posted/audit records, disable their protections or perform DDL fail. Verify future migration grants and the restored database's grants as part of handover.
4. Install the API with the approved Windows service manager and a dedicated restricted service identity. It starts after reboot, has a bounded restart policy and writes protected/rotated logs. A database outage changes readiness and is visible to the named operator.
5. Keep API/PostgreSQL listeners private; use trusted HTTPS for workstation access. Both clients reject untrusted/expired/wrong-host certificates and remote HTTP, and connect using the approved certificate chain. Do not disable certificate checks or the Electron sandbox.
6. Environment/configuration, MFA key, backup key and certificate key have documented NTFS ACLs and named custodians. Migration credentials and database secrets are absent from the desktop and API runtime configuration.
7. Record effective grants, firewall/trust settings, service restart behaviour, diagnostic locations and the day-to-day start/stop/upgrade procedure. Validate any proxy limits/trusted-forwarding configuration; unreviewed headers must not bypass controls.

**Verification / done evidence:** Two-workstation shared-record demonstration, restricted-role integration results, certificate negative cases, reboot/restart/outage drill and sanitised deployment record. `security:check -- --production` passes under the actual runtime configuration, alongside manual privilege review.

## PIL-04 — Operate scheduled backups and demonstrate recovery

**User story:** As the IT operator, I want scheduled, monitored backups and a measured restore rehearsal so that I can recover the pilot's committed records and access controls.

**Priority:** 4 · **Estimate:** 1.00 developer day · **Dependencies:** PIL-03; agreed RPO/RTO, off-host storage, scheduler identity and key custody.  
**Requirements:** FR-PLT-07; TR-OPS-02/03, TR-PRV-03; PRD section 6.2.  
**Likely work:** Scheduler/status wrapper around the existing backup/restore/cleanup commands; protected operational configuration and evidence. Reuse the encryption and restore engine.

**Acceptance criteria**

1. An idempotent scheduler setup runs backups under its intended noninteractive identity at the agreed frequency. It retains the archive and authenticated manifest together, copies them to the approved off-host destination and checks destination integrity.
2. A machine-readable status distinguishes last attempt, last completed local backup and last verified off-host copy. Missing/invalid manifests, nonzero child exit, copy failure and stale last success are failures, not a success based on file existence. An existing successful status cannot hide a newer failed attempt.
3. Route a safe operational alert to the agreed local monitoring mechanism or approved customer channel. Simulate failure and show the operator can see it; do not introduce an unapproved external notification service.
4. Restore a representative backup into a new quarantined database using the existing hash/HMAC/GCM validation. Confirm records, posted journals, stock/AP/AR/GRNI reconciliation, source links and migration checks; confirm old sessions/challenges are revoked.
5. Record the last recoverable transaction time, recovery duration and comparison with the agreed RPO/RTO. Recreate required runtime grants and verify MFA with the preserved MFA encryption key.
6. Rehearse a privacy restriction/minimisation performed after the snapshot: locate it in the separately secured case register and apply its approved outcome before reopening restored access. Preserve original financial/audit records.
7. Wrong keys/corrupt archives/existing target names fail safely. No live database is overwritten or automatically deleted. Document off-host retention/key expiry responsibility and cleanup scheduling without inventing a statutory duration.

**Verification / done evidence:** Scheduled success and failure records, off-host verification, timed restoration report, reconciliations, session-revocation check and post-snapshot privacy replay evidence.

## PIL-05 — Complete keyboard and screen-reader acceptance

**User story:** As a keyboard or screen-reader user, I want the pilot workflow to announce information and keep focus predictable so that I can complete it independently.

**Priority:** 5 · **Estimate:** 0.75 developer day · **Dependencies:** PIL-03; named Windows/Narrator reviewer and supported scaling profile.  
**Requirements:** FR-DESK-06; TR-DESK-06; UI/UX brief sections 8, 10–12; PRD accessibility target.  
**Likely work:** Targeted renderer labels, focus/error/status handling and styles; manual evidence supplementing existing axe tools.

**Acceptance criteria**

1. Complete connection, sign-in/MFA/recovery codes, request/approval, receipt, matching exception, payment decision, reconciliation, import preview and privacy extract paths with keyboard input. Review the actual pilot's primary paths rather than only the connection screen.
2. Windows Narrator identifies names, roles, required/error states, headings, table context and transaction outcomes. Error and pending/uncertain states have understandable announcements; focus is neither trapped nor lost after navigation, submit, validation or failure.
3. Verify skip-to-main, logical Tab/Shift+Tab order, visible focus and colour-independent status. A skip action must preserve the trusted application origin and working IPC.
4. Review agreed 200%/400% scaling and Windows forced-colour/high-contrast cases; content and controls remain reachable with appropriate scrolling. Record any limitation and the affected workflow.
5. Run the existing automated accessibility checks for the candidate, review `incomplete` items manually and fix pilot-blocking findings. A sampled automated pass does not close unexamined primary-screen defects.

**Verification / done evidence:** Screen/step checklist with OS, Narrator/scaling settings, finding IDs, remediation and reviewer outcome; current automated reports. Capture only synthetic content in any approved screenshots.

## PIL-06 — Accept the financial, privacy and security workflow

**User story:** As the business reviewer, I want realistic normal and failure scenarios to reconcile to an expected result so that I can trust the existing workflow during the pilot.

**Priority:** 6 · **Estimate:** 1.00 developer day · **Dependencies:** PIL-01 expected-result fixture; PIL-02–04; finance and privacy/security reviewer availability.  
**Requirements:** FR-PLT-02/03/04, FR-FIN-02/04/07/08, FR-P2P-01–05, FR-INV-02/04, FR-INT-02; TR-API-04/05, TR-SEC-03/04/06, TR-PRV-01/02; PRD section 6.  
**Likely work:** Reusable synthetic fixtures, targeted acceptance cases, review record and bounded fixes. Extend existing suites instead of building duplicate financial engines.

**Acceptance criteria**

1. Distinct actors complete request rejection/revision/approval, PO, partial and damaged delivery, valid receipt, invoice matching/price exception, posting, two independent payment approvals and confirmed-transfer recording. The external transfer reference is synthetic; no banking system is called.
2. The finance reviewer compares independently calculated paise/quantity totals with stock, GRNI, AP, input tax, variance, bank, trial balance and statements. Cover partial payment, AR collection, outstanding bank carry-forward and closed-period rejection/reopening with reasons.
3. Concurrent quantity/payment allocation and duplicate exact retries produce eligible totals exactly once. Force a rollback and interrupt connectivity before/after commit; the UI distinguishes uncertain outcomes and reconciles server state without duplicate financial records.
4. Verify each relevant role's permitted action and direct API denial for forbidden reads/writes, report/history access, self-approval and invalid approver assignment. Identify all nine roles by their actual grants rather than a proposed role matrix.
5. Exercise a master import with invalid/duplicate rows, valid dry run, successful commit and conflict rollback. Exercise a synthetic access case, subject-wide hold, blocked minimisation, approved restriction and retained-history outcome. Check the extract and diagnostics for excluded secrets and unnecessary personal data.
6. Complete a focused threat review covering desktop IPC/origin, authenticated API, TLS proxy, privileged database/operator access, secrets, privacy exports and backup/recovery. Record missing broad rate limiting, account recovery and full retention as residual requirements with owners and severity.
7. Critical integrity, permission or exposure findings block entry. Export the review evidence in the approved restricted location; existing record immutability is preserved throughout fixes.

**Verification / done evidence:** Scenario ledger with expected/actual values and source IDs, current relevant unit/API/Electron results, failure/negative checks, finance review, threat findings and privacy reviewer outcome.

## PIL-07 — Measure the representative pilot workload

**User story:** As the pilot owner, I want measured performance under the actual mix of pilot tasks so that I can set a justified initial usage limit.

**Priority:** 7 · **Estimate:** 0.75 developer day · **Dependencies:** PIL-03; reusable PIL-06 fixtures; agreed workload/data size and performance profile.  
**Requirements:** TR-NFR-01–04; desktop PRD section 3.  
**Likely work:** Extend the disposable load harness and its report; add an explicitly approved isolated staging mode only if needed. Do not repoint an existing tool at production.

**Acceptance criteria**

1. Record hardware/OS/database versions, dataset and ledger/stock sizes, network latency, warm-up, duration, operation proportions and exclusions. Use ten concurrent authenticated actors with their proper roles, not ten unrestricted administrators.
2. Include paginated master/request reads, approval/register activity, receipt/invoice/payment posting contention, exact retries, stock/control reconciliation and financial statement reads. Reuse prepared approvals and fixtures to respect separation of duties.
3. Measure routine API P95 against the inherited proposed 500 ms target, common screen P95 against two seconds, and financial statements against 30 seconds. Report per-operation latency and failures; do not infer screen latency from API timings or replace these targets with the current harness's 2,000 ms default.
4. After load, prove zero duplicate posted sources, no over-receipt/over-allocation/negative stock, balanced journals and stock/AP/AR/GRNI reconciliation. Record resource usage and lock/pool pressure.
5. Use approved synthetic isolated data, a bounded duration/request count and deterministic cleanup. Any new staging target mode requires an explicit allowlist/safety gate, with no production writes or arbitrary unrestricted load target.
6. Document pass/fail, bottlenecks and the resulting pilot limit. The PRD's 50-user requirement remains open: increasing a worker cap alone is not evidence that it is met.

**Verification / done evidence:** Reproducible invocation/profile, per-operation report, actual screen/report samples, reconciliation results and pilot owner acceptance. A failed target is a finding to fix or a reason to hold entry, not a metric to silently relax.

## PIL-08 — Produce the signed candidate and pilot handover

**User story:** As the release owner, I want a traceable signed installer and a complete handover so that the approved pilot can be installed, supported and recovered.

**Priority:** 8 · **Estimate:** 1.00 developer day · **Dependencies:** PIL-02–07 evidence, protected signing identity and hosted CI access. Initiate credential/CI preparation on day 1.  
**Requirements:** FR-DESK-01/05; TR-REL-01–05, TR-OPS-04; operations and installer runbooks.  
**Likely work:** Candidate version/release manifest, SBOM and CI evidence collection, signing verification and clean-machine checklist. Reuse existing NSIS/signing/archive gates.

**Acceptance criteria**

1. Assign a unique candidate version, source revision, API/contract compatibility and schema range. Existing version `0.2.0` is the baseline, not an identifier for every subsequent candidate.
2. Build from the lockfile, generate a machine-readable SBOM for shipped runtime components and record build-tool provenance separately. Run dependency review and record findings/decisions. Do not use a development-only inventory as the desktop runtime SBOM.
3. A hosted CI run for the exact revision completes the required build/type/unit/API/security/recovery/load and Windows desktop/package gates. Preserve the run ID, artifact identity and report links; an older local run is insufficient.
4. Build with signing required, verify the expected Authenticode signer/trust and checksum independently, and retain protected artifacts through the approved distribution channel. Missing credentials or invalid signing holds entry; no unsigned artifact is relabelled as the signed candidate.
5. On a clean supported workstation install, connect over HTTPS, sign in with MFA, and exercise a protected action. Verify the second workstation sees committed shared data. Upgrade a prior supported client, test compatibility rejection, and uninstall without removing shared data.
6. Confirm the desktop archive excludes server secrets/code, databases, test data and private key material. Confirm logs/profile behaviour and endpoint configuration match the supported installation policy.
7. Handover includes operator/support contacts, monitoring and backup checks, key custodians, environment/compatibility matrix, migration/recovery evidence, known limits, unresolved findings and the named pilot entry decision.

**Verification / done evidence:** Signed installer/checksum, signer verification, runtime SBOM, CI run/artifact manifest, installation/upgrade/uninstall record and completed pilot acceptance record.

## Follow-up stories — outside this sprint's eight-day work budget

These retain the product requirements that a constrained staging pilot cannot close. Estimates and acceptance designs must be refined before scheduling them.

| ID | User story | Required completion evidence / boundary |
| --- | --- | --- |
| FUP-01 | As a user/operator, I want secure password change and independently authorised password/MFA recovery so that loss of credentials does not require improvised database edits. | Approved identity verification, limited/single-use expiring recovery, fresh MFA enrollment, session/challenge revocation, no self-escalation, last-admin protection, rate controls and complete audit. Existing recovery codes remain supported. |
| FUP-02 | As the security owner, I want API/proxy abuse controls with visible operational alerts so that reads, reports, imports and privileged actions cannot exhaust shared service capacity. | Per-actor/network budgets, trusted-proxy rules, stable 429/Retry-After behaviour, bounded report/import work, restart/multi-process behaviour, denial-of-service review and load evidence. |
| FUP-03 | As finance and warehouse staff, I want linked returns, credit notes and refunds so that legitimate corrections preserve both stock valuation and subledger integrity. | Accountant-reviewed posting matrix before schema/API work; original receipt/invoice/settlement links, remaining-quantity/value limits, tax/variance handling, open-period rules, independent decisions, retry/concurrency controls and AP/AR/GRNI/stock/GL reconciliation. |
| FUP-04 | As a migration operator, I want validated opening chart, stock and financial-balance templates so that source records reconcile before go-live. | Dry run, source-to-target mapping, balanced openings, exact costing/rounding, duplicate/retry controls, actor approval and a signed reconciliation/cutover record. Master JSON import alone does not meet this. |
| FUP-05 | As an approver/business owner, I want configurable budgets, approval limits, delegation and an assigned work queue so that policy and pending exceptions are explicit. | Versioned policy evaluation, recorded assignment, no prohibited self-approval, independent payment control, safe delegation/expiry/escalation, in-app notifications and accurate scoped counts. |
| FUP-06 | As the privacy lead, I want complete scoped discovery, reviewed correction/restriction and retention handling so that current data, customer records, history, exports and backups are addressed consistently. | Approved data inventory/access roles, configurable retention/holds, no unreviewed deletion of posted history, secure disclosure review and a tested restore-time replay procedure. |
| FUP-07 | As finance, I want the selected country's accounting/tax configuration and complete permission-controlled reports/exports so that operational results meet the approved business scope. | Explicit jurisdiction, accountant review, source-linked reports, audit exports, protected CSV/XLSX/PDF output where selected, and validated tax/statutory scope. INR does not imply a country pack. |
| FUP-08 | As the product owner, I want the 50-user and large-data targets validated so that deployment limits have measured support. | Production-like mixed roles/financial writes/reports, agreed dataset including high-volume query plans, resource/lock analysis, failure accounting and reconciled results; preserve targets until evidence supports a changed requirement. |
| FUP-09 | As sales/warehouse staff, I want orders, reservations, dispatch and sales returns so that stocked sales reach AR and COGS correctly. | Customer/credit policy, partial dispatch, stock/COGS postings, invoice/return allocation, retry/approval rules and stock/AR/GL reconciliation. Scope after financial correction rules. |

The broader backlog now follows the module roadmap: shared-party/access design and core/Finance completion; CRM and Sales with stock fulfilment; expanded Supply Chain sourcing/quality; HR core/expenses; Marketing planning/attribution. Use MOD-PLT/FIN/CRM/SLS/SCM/HR/MKT epic acceptance to refine future stories without duplicating FUP scope. Bank-file/split matching, non-stock AP and sensitive supplier details require selected scope; payroll, fixed assets, manufacturing, projects, mobile and integrations remain conditional extensions. Estimates, owners and workflow/posting specifications are required before scheduling any of these stories.
