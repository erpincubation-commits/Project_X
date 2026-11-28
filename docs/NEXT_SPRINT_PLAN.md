# Next sprint: controlled pilot readiness

**Prepared:** 16 November 2026  
**Status:** Proposed delivery plan; pilot goal and capacity confirmed by the user  
**Capacity:** One developer, two weeks / ten working days  
**Planning baseline:** Commit `4aecda3` — `feat: add ERP accounting, procurement, trade, and operations workflows`  
**Companion backlog:** [Next sprint user stories](NEXT_SPRINT_USER_STORIES.md)

**Expansion review, 17 November 2026:** The [six-module roadmap](ERP_MODULE_ROADMAP.md) adds a longer-term Finance, CRM/Sales, Supply Chain, HR and Marketing plan. This sprint remains phase 0 with the same PIL-01–08 scope, eight planned developer days and two contingency days. Roadmap discovery/stories are not added to this sprint or claimed complete by this document review.

The proposed [CORE-FIN epic and stories](CORE_FINANCE_EPIC_AND_STORIES.md) refine phase 1 follow-ups after this pilot. Their priority, estimates, owners and release inclusion require refinement; they do not consume this sprint's reserved time.

## 1. Sprint outcome

Prepare a repeatable, recoverable staging pilot of the existing purchase-to-payment workflow on two Windows workstations and one shared on-premises server. A business reviewer should be able to complete the workflow, inspect its accounting and audit evidence, and observe recovery from an interrupted request or failed service.

The user selected **controlled pilot readiness** and **one developer for two weeks**. This plan assumes synthetic business data, up to ten named test accounts, and a private staging environment. The existing roles require ten test actors to cover all nine roles and a second independent payment approver. A real-data production rollout requires a separate release decision against the remaining product requirements.

The sprint preserves the agreed product choices: Electron/React/TypeScript, NestJS/TypeScript, PostgreSQL, Windows first, one company per deployment, INR, moving weighted average, negative stock blocked, configured tax rates without statutory filing, and two independent payment approvers. Payments record confirmed external transfers. No bank connection or money transmission is part of the pilot.

## 2. Current baseline and gaps

The following is a source/document review, not a new execution of the application's tests or a verification of the deployed database. The source currently requires schema **10**; the installed schema must be checked during staging preparation.

| Area | Implemented in the committed source | Work required for the pilot |
| --- | --- | --- |
| Identity and access | Administrator setup, password hashing, mandatory TOTP MFA, recovery codes, session expiry/revocation, nine roles, audit recording. | Verify access on the staging installation; agree named custodians, two active administrators and recovery-code handling. Operator-assisted account recovery remains a follow-up requirement. |
| Purchasing | Supplier/item masters, requests, independent approval/rejection, orders, partial/damaged receipt evidence, invoice matching and independent price exceptions. | Execute a business-reviewed scenario and the exception paths with separate actors. |
| Finance and stock | INR accounts/periods, balanced journals, weighted average, stock controls, AP/AR, dual payment approval, collections, bank reconciliation and statements. | Confirm the posting rules and resulting source/ledger totals against an independently prepared expected result. |
| Imports and privacy | Create-only master JSON import previews/commit, verified privacy cases, subject holds, scoped extracts, restrictions and current-data minimisation with retained history. | Exercise valid/invalid imports and a complete synthetic privacy case, including post-backup restriction handling during recovery. |
| Compatibility | Server startup checks the database schema. `/health` currently returns readiness only; the client has no negotiated compatibility contract. | Add and enforce a client/server compatibility contract. |
| Deployment | Development launchers and deployment procedures exist. Windows service setup, runtime-role provisioning, TLS installation and monitoring are operator-managed. | Produce a repeatable staging installation using protected configuration and separate operator/runtime credentials. |
| Recovery | Encrypted snapshot backup, authenticated manifest, new-database restore, reconciliation checks and restored-session revocation exist. | Schedule, monitor and copy backups off the server; measure a staging recovery drill. |
| Verification | Unit/API/Electron/axe/recovery/load tools and CI gates exist. | Collect evidence for this candidate and environment, including human accessibility and finance review. |
| Capacity | The current load harness uses synthetic customer reads/creates/retries, defaults to eight workers, and permits at most 32. | Exercise the actual pilot workload with ten actors. The PRD's 50-user target requires a separate larger validation. |
| Distribution | NSIS packaging, artifact checksums, archive exclusions and optional signing are implemented. | Obtain a signed, identifiable candidate, an SBOM, a successful hosted CI run and clean-machine installation evidence. |

Source anchors: [server health](../apps/server/src/app.module.ts), [schema gate](../apps/server/src/bootstrap.ts), [desktop API client](../apps/desktop/src/main/api-client.ts), [role contracts](../packages/contracts/src/index.ts), [load harness](../tools/load-test.mjs), [installer configuration](../apps/desktop/electron-builder.config.cjs), and [CI workflow](../.github/workflows/windows-installer.yml).

## 3. Capacity and committed candidate scope

These are provisional developer-day estimates, including implementation, review preparation and verification. They are not an established team velocity. External reviewers' time and infrastructure lead times are dependencies, rather than extra development capacity.

| Priority | Story | Deliverable | Developer days |
| --- | --- | --- | ---: |
| 1 | [PIL-01](NEXT_SPRINT_USER_STORIES.md#pil-01--freeze-the-pilot-scope-and-acceptance-record) | Freeze pilot scope, reconcile document status and create the acceptance record. | 0.50 |
| 2 | [PIL-02](NEXT_SPRINT_USER_STORIES.md#pil-02--block-incompatible-clients-with-clear-upgrade-guidance) | Client/server compatibility negotiation and server enforcement. | 1.00 |
| 3 | [PIL-03](NEXT_SPRINT_USER_STORIES.md#pil-03--deploy-a-protected-shared-staging-server-repeatably) | Repeatable staging service, least-privilege database role, TLS and two-client connection. | 2.00 |
| 4 | [PIL-04](NEXT_SPRINT_USER_STORIES.md#pil-04--operate-scheduled-backups-and-demonstrate-recovery) | Scheduled/monitored backups and a measured recovery drill. | 1.00 |
| 5 | [PIL-05](NEXT_SPRINT_USER_STORIES.md#pil-05--complete-keyboard-and-screen-reader-acceptance) | Human keyboard, screen-reader and scaling review with fixes. | 0.75 |
| 6 | [PIL-06](NEXT_SPRINT_USER_STORIES.md#pil-06--accept-the-financial-privacy-and-security-workflow) | Reconciled business scenario, privacy/security review and failure evidence. | 1.00 |
| 7 | [PIL-07](NEXT_SPRINT_USER_STORIES.md#pil-07--measure-the-representative-pilot-workload) | Ten-actor mixed workload and performance report. | 0.75 |
| 8 | [PIL-08](NEXT_SPRINT_USER_STORIES.md#pil-08--produce-the-signed-candidate-and-pilot-handover) | Signed candidate, SBOM, CI evidence, installation and handover. | 1.00 |
| | **Planned work** | | **8.00** |
| | **Contingency** | Defects, retesting, deployment friction and review follow-up. | **2.00** |
| | **Total capacity** | | **10.00** |

Contingency is reserved for completing these outcomes. Additional business features are not scheduled as automatic stretch work. If a story grows, reduce the pilot's optional scenarios or postpone entry; retain compatibility, permissions, accounting integrity, protected deployment and recovery gates.

## 4. Delivery sequence

| Day | Work allocation | Evidence / checkpoint |
| --- | --- | --- |
| 1 | PIL-01: 0.5; PIL-02: 0.5. | Confirm scope, owners, environment and expected accounting result. Draft compatibility contract. |
| 2 | PIL-02: 0.5; PIL-03: 0.5. | Compatible/incompatible paths work; start protected staging setup. |
| 3 | PIL-03: 1.0. | Service, roles, TLS and configuration verified on the staging server. |
| 4 | PIL-03: 0.5; PIL-04: 0.5. | Two clients connect; backup schedule and status monitoring installed. |
| 5 | PIL-04: 0.5; PIL-05: 0.5. | Restore drill measured; begin keyboard/Narrator review. |
| 6 | PIL-05: 0.25; PIL-06: 0.75. | Accessibility findings recorded/fixed; run financial and exception scenarios. |
| 7 | PIL-06: 0.25; PIL-07: 0.75. | Reconciliation and privacy/security evidence; mixed workload report. |
| 8 | PIL-08: 1.0. | Candidate version, signature, SBOM, hosted CI, install/upgrade/uninstall evidence and handover. |
| 9–10 | Contingency and targeted retesting. | Resolve blockers, repeat affected checks and hold the pilot entry review. |

Dependency order: PIL-01 establishes the acceptance profile; PIL-02 and PIL-03 establish the usable staging system; PIL-04 protects it; PIL-05–07 assess it; PIL-08 packages the accepted result. Signing credentials and the hosted CI environment must be arranged from day 1, even though final packaging occurs later.

## 5. Dependencies and decisions

| Required decision/resource | Owner to name | Needed by | Effect if unavailable |
| --- | --- | --- | --- |
| Staging server, two Windows workstations, exact OS/Node/PostgreSQL versions and isolated network access. | User / customer IT. | Day 1. | No environment acceptance; keep work at candidate preparation. |
| Approved service manager, service identity, TLS origin/certificate trust and protected key storage. | Customer IT. | Day 1. | PIL-03 cannot be accepted. |
| Backup schedule, off-host destination, key custodians and measurable pilot RPO/RTO. | IT and business owner. | Before PIL-04. | Recovery objectives remain unaccepted; pilot entry is held. |
| Finance reviewer and agreed expected postings/rounding/tax treatment for synthetic examples. | Business/finance reviewer. | Day 1; review day 6. | No financial acceptance. |
| Privacy/security reviewer and a restricted synthetic request/incident register. | User / nominated privacy/security lead. | Day 1; review day 6. | No privacy/security acceptance. |
| Windows signing identity and protected CI credentials; repository access to inspect hosted runs. | Release owner. | Start day 1; available by day 8. | Produce a development candidate, but hold signed-pilot entry. |
| Reviewer availability for keyboard/Narrator and business walkthroughs. | User / tester. | Days 5–7. | Automated scans alone do not close the manual acceptance item. |

The jurisdiction is still undecided. INR does not select an Indian statutory tax implementation. Generic tax configuration is sufficient for synthetic pilot scenarios; country-specific production configuration remains a separate requirement. Choose the staging business timezone and synchronise clocks before validating posting dates, privacy receipt dates and MFA.

No actual staging installation, production migration, certificate issuance, release publication or application implementation is performed by this planning document.

## 6. Pilot entry and completion

The pilot entry review requires:

1. A source revision, candidate version, supported environment record and reconciled schema status. Migration rehearsal preserves records; migration/operator secrets are absent from API and desktop deployment configuration.
2. Trusted HTTPS from both workstations, an API that restarts under the approved service manager, a restricted runtime database role, and enforced compatibility/permission failures.
3. The complete request → approval → order → partial/damaged receipt → match/exception → invoice → two-approver payment recording → reconciliation scenario, with source IDs and reviewed expected totals.
4. A valid encrypted off-host backup, a successful isolated recovery against the agreed RPO/RTO, restored-session revocation and a record of post-backup privacy actions to replay before reopening.
5. No unresolved critical security, financial-integrity, permission, recovery or accessibility blocker. Lesser findings have explicit owners, impact, mitigation and due dates accepted by the pilot owner.
6. The accessibility and mixed-workload evidence specified in PIL-05 and PIL-07. A ten-actor pilot result is recorded separately from the outstanding 50-user product target.
7. A signed, verified candidate, reviewed SBOM/dependency findings, successful hosted CI evidence and two-workstation installation checks. A workflow file or an old local pass is not acceptance evidence for this release.
8. Named support/incident contacts and an accepted handover, followed by a short business walkthrough on the installed candidate.

Pilot completion means the named reviewers accept this constrained staging workflow and record its defects and next priorities. It does not close all P0 product requirements or constitute a production approval. If an entry gate fails, retain the candidate and evidence, assign a remediation owner, and reschedule the pilot rather than lowering the gate without a recorded decision.

## 7. Follow-up backlog and production gates

The following work remains visible because the source PRD includes it, but it exceeds this sprint's capacity. Detailed follow-up stories are in the companion backlog.

| Order | Follow-up | Reason / dependency |
| --- | --- | --- |
| 1 | Account lifecycle: change password, authorised password/MFA recovery and emergency administration. | Recovery codes exist; a complete operator-assisted recovery process does not. Required before relying on the application with real users/data. |
| 2 | Comprehensive API/proxy abuse controls and operational security findings. | Current throttling is authentication-specific. The sprint reviews exposure and verifies a staging configuration; it does not deliver a distributed application-wide limiter. |
| 3 | Receipt returns, supplier/customer credit notes, refunds and controlled financial correction. | Posted documents are immutable. Review posting/allocation rules first; do not use direct database edits or unrelated manual control-account journals as substitutes. |
| 4 | Opening chart/stock/financial migration and migration reconciliation. | The implemented importer creates master records only. Financial migration needs accountant-reviewed templates and source-to-ledger reconciliation. |
| 5 | Configurable approval/budget rules, work queue/notifications and sensitive supplier payment-detail controls. | Present approvals use fixed roles, explicit assignments and two payment approvers. These do not satisfy every configurable P0 requirement. |
| 6 | Privacy completeness, retention configuration, customer restrictions and support/export scope. | Current minimisation retains history/backups; broader retention and rights handling need reviewed decisions and workflows. |
| 7 | Country/accounting review, required statutory treatment, report exports and audit exports. | A selected jurisdiction and reviewed reports are outstanding production decisions. |
| 8 | Representative 50-user testing and large-data/query-plan review. | The current harness and this pilot do not prove the PRD's full capacity target. |
| 9 | Shared contacts/CRM, quotations, sales orders, reservations, stock dispatch/COGS and sales returns. | Roadmap 2A/2B after core/Finance correction and shared-party rules; service AR already exists. FUP-09 remains the stock-sales story. |
| 10 | Supply Chain replenishment/sourcing, supplier returns, quarantine/quality and count approval. | Roadmap phase 3; basic reservation/dispatch is included with Sales in phase 2B. |
| 11 | HR employees/leave/attendance and Finance-integrated expenses. | Roadmap phase 4; employee access/privacy and payable contracts first, payroll separately gated. |
| 12 | Marketing plans, eligible audiences, campaign/source attribution and results. | Roadmap phase 5 after CRM/Sales; outbound delivery separately selected and accepted. |
| Later | Non-stock AP, bank-file/split matching, fixed assets, manufacturing, payroll, projects, external integrations and mobile access. | Select individual capabilities through the roadmap and pilot findings; no added sprint commitment. |

The restricted pilot needs two active administrators and separately held recovery codes. A lockout beyond existing supported recovery stops the exercise and follows the authorised staging recovery procedure; the sprint must not introduce an unauthenticated reset shortcut. This operational boundary is not a replacement for follow-up account-recovery development.

## 8. Document review and traceability

User decisions set scope and stack. Current code, migrations, contracts, workflow guides and the latest changelog establish implementation status. Requirement documents describe intended scope. The original web documents and archives supply product context; their stack instructions and historical feature labels are not current implementation instructions.

| Reviewed input | Contribution to this plan |
| --- | --- |
| `C:\Users\parit\Downloads\SMB_ERP_PRD.md` | Original phase-1 foundation, purchase-to-pay, migration/recovery, security, accessibility and performance goals; later modules remain phased. |
| `C:\Users\parit\Downloads\ERP_Architecture.md` | Module dependencies and hero workflow. Its Next.js/FastAPI/Alembic stack is superseded by the agreed desktop stack. |
| [Desktop PRD](SMB_ERP_DESKTOP_PRD.md), sections 3, 5–12. | Pilot measures, FR-DESK/PLT/FIN/P2P/INV requirements and release gates. |
| [Technical requirements](SMB_ERP_TECHNICAL_REQUIREMENTS.md), sections 4–13. | Compatibility, identity, transaction, operational, performance and release requirements. |
| [Application flow](SMB_ERP_APP_FLOW.md). | Installation, roles, purchase-to-pay, exceptions, period close, privacy and recovery walkthroughs. |
| [UI/UX brief](SMB_ERP_UI_UX_DESIGN_BRIEF.md). | Keyboard, screen-reader, scaling, task clarity and uncertain-write evaluation. |
| [Backend schema](SMB_ERP_BACKEND_SCHEMA.md). | Integrity, versioning, migration and privacy modelling; proposed logical tables are not all deployed tables. |
| [Security/access](SMB_ERP_SECURITY_AND_ACCESS.md). | Separation of duties, recovery, privacy, failure response and independent operational controls. |
| [Testing/deployment specification](SMB_ERP_TESTING_DEPLOYMENT_RUNBOOK.md). | Environment record, clean-machine installation, acceptance, recovery and handover evidence. |
| [Authentication](AUTHENTICATION.md), [procurement](PROCUREMENT.md), [accounting/inventory](ACCOUNTING_INVENTORY.md), [trade workflows](TRADE_WORKFLOWS.md). | Current implemented flows, actual grants, validation and unsupported corrections. |
| [Accounting postings](ACCOUNTING_POSTINGS.md) and [trade posting rules](TRADE_POSTING_RULES.md). | Existing posting contract and return/credit design dependencies. |
| [Operations](OPERATIONS_RUNBOOK.md), [backup/restore](BACKUP_RESTORE.md), [imports/privacy](IMPORTS_AND_PRIVACY.md), [verification](VERIFICATION.md). | Existing operational tools, procedures and the difference between automated checks and environment acceptance. |
| [PostgreSQL setup](POSTGRES_SETUP.md), [deployment](DEPLOYMENT.md), [development](DEVELOPMENT.md), [installer](WINDOWS_INSTALLER.md). | Development versus service operation, roles, TLS, signing, distribution and diagnostic ownership. |
| [README](../README.md), [migration status](DESKTOP_MIGRATION.md), [changelog](CHANGELOG.md). | Commit-level baseline and discoverability; identified outdated status statements to reconcile. |
| [Archive notice](archive/README.md), [historical changelog](archive/CHANGELOG.md), [commercial feature map](archive/COMMERCIAL_FEATURE_MAP.md), [crosswalk](archive/ERPNEXT_MODULE_CROSSWALK.md). | Historical roadmap context only; retired Python/pilot functionality is not counted as delivered Electron scope. |

Documentation review on 17 November 2026 reconciled customer-only/MFA baseline statements in the affected specifications and corrected the migration guide to schema 7 while adding the module roadmap. PIL-01 must still reconcile the candidate and installed environment, review remaining README/specialist limits and validate actual role/task instructions. This planning review does not close PIL-01 acceptance. Preserve requirement intent while clearly labelling **implemented**, **partially implemented**, **planned** and **environment acceptance pending**.

## 9. Planning validation

This task produces the sprint plan and user stories. Before handing over the documents, check story links, requirement identifiers, estimate totals, schedule allocation, dependencies and consistency with commit `4aecda3`. Application tests are scheduled as story acceptance work; previously reported local results must be re-associated with the actual pilot candidate before release.
