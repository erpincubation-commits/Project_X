# CRM foundation: epic and user stories

**Prepared:** 19 November 2026  
**Status:** Proposed backlog; unestimated, unscheduled and not implemented or accepted  
**Source baseline:** Application 0.2.0 / database schema 8; deployed versions are unverified  
**Parent plan:** [ERP module roadmap, phase 2A](ERP_MODULE_ROADMAP.md#4-delivery-sequence-and-gates)  
**Traceability:** MOD-CRM-01, FR-CRM-01/02 and MOD-PLT-01

## Epic: CRM-FOUNDATION — Qualify prospects and hand customers to Sales

**As** a sales representative and sales manager, **I want** a shared, permission-controlled view of contacts, leads, opportunities and follow-ups, **so that** we can track potential business, hand a qualified prospect to Sales and avoid creating duplicate customer identities.

**Current foundation:** The application has a customer register, administrator customer creation and service/non-stock customer invoices and collections. It does not have a CRM workspace, contacts, leads, opportunities, CRM activities or a prospect-conversion workflow. See the [user guide](USER_GUIDE.md#customers-suppliers-and-items) for current tasks. The current nine fixed roles and one role per account do not grant new CRM permissions merely because of a job title.

**Proposed initial scope:** shared contacts/addresses and party links; lead intake, assignment and qualification; opportunities, stage history and activities; reviewed matching and conversion/linking to an existing or new customer; scoped pipeline reporting, import, privacy, migration and release evidence. Customer creation/association and Finance references retain a single authoritative customer identity.

**Out of scope for this increment:** quotations, sales orders, inventory dispatch, revenue posting and customer credit decisions (Sales/Finance); campaigns, audience sending and attribution beyond capturing a simple source reference (Marketing); email/calendar sync, telephony, automated outreach, external lead capture, mobile/offline work, customer support and automatic party merges. These may be proposed separately and require their own scope and integrations.

**Accountable functions to name:** product owner, sales operations, customer-data owner, security/privacy lead, engineering lead and release/IT owner. Responsibility assignments, estimates and dates are not approved by this document.

## Epic acceptance

1. Product and sales operations approve the initial statuses, qualification criteria, ownership/team model, customer-conversion policy and report definitions. CF-17/MOD-PLT-01 shared-party/access decisions and phase 1 release dependencies are reviewed; an unapproved design is not treated as a completed prerequisite.
2. Authorised users can create and maintain scoped contact/lead data, assign follow-ups, progress opportunities and convert or link a lead to a customer. Duplicate candidates are reviewed by an authorised user; matching an email never automatically merges financial identities.
3. Existing customer codes, financial references and service invoicing remain intact through a populated-database upgrade. Concurrent or repeated conversion results in one durable lead-to-customer association; no CRM transition posts a journal, changes stock, creates an invoice or records revenue.
4. Direct API, search, field, history, report, export and import permissions enforce the approved scopes. Privacy discovery/retention, audit, compatibility, migration, backup/restore, accessible desktop use and representative workload evidence cover the released scope.
5. Product, sales operations, privacy/security and IT reviewers record results, unresolved defects and a release decision for the actual candidate and environment. This backlog is not evidence of deployment, compliance or feature acceptance.

## Story map and dependencies

`Core` identifies a candidate phase 2A foundation; `Selectable` needs an explicit scope decision. Priorities and dependencies are proposals, not scheduling commitments. Split large stories during refinement; estimate design, migration, UI, tests, documentation and review together. The current controlled pilot remains unchanged.

| ID | Proposed story | Priority | Main dependencies |
| --- | --- | --- | --- |
| [CRM-01](#crm-01--approve-crm-scope-and-shared-party-rules) | Approve CRM scope and shared-party rules | Core | Phase 1 decisions, CF-17/MOD-PLT-01 |
| [CRM-02](#crm-02--define-crm-access-and-ownership) | Define CRM access and ownership | Core | CRM-01; phase 1 access design |
| [CRM-03](#crm-03--maintain-contacts-and-addresses) | Maintain contacts and addresses | Core | CRM-01/02 |
| [CRM-04](#crm-04--capture-and-qualify-a-lead) | Capture and qualify a lead | Core | CRM-01/02/03 |
| [CRM-05](#crm-05--assign-and-transfer-lead-ownership) | Assign and transfer lead ownership | Core | CRM-02/04 |
| [CRM-06](#crm-06--review-duplicate-candidates) | Review duplicate candidates | Core | CRM-03/04 |
| [CRM-07](#crm-07--track-an-opportunity) | Track an opportunity | Core | CRM-04/05 |
| [CRM-08](#crm-08--manage-follow-up-activities) | Manage follow-up activities | Core | CRM-02/04/07 |
| [CRM-09](#crm-09--link-or-convert-a-qualified-lead) | Link or convert a qualified lead | Core | CRM-02/04/06; reviewed customer-create authority |
| [CRM-10](#crm-10--hand-an-opportunity-to-sales) | Hand an opportunity to Sales | Core | CRM-07/09; approved handoff contract |
| [CRM-11](#crm-11--review-the-scoped-pipeline) | Review the scoped pipeline | Core | CRM-02/07/08 |
| [CRM-12](#crm-12--import-contacts-and-leads) | Import contacts and leads | Selectable | CRM-03/04/06; import/privacy design |
| [CRM-13](#crm-13--support-crm-privacy-requests-and-retention) | Support CRM privacy requests and retention | Core | CRM-01/02; CF-14/15 privacy decisions |
| [CRM-14](#crm-14--release-and-recover-the-crm-increment) | Release and recover the CRM increment | Core | Selected stories, phase 1 gates, reviewers and environment |

## Common acceptance rules

Each implementation story must specify server-enforced action, record, field, search, history, report and export scope as applicable. Tests exercise direct API denial, altered identifiers, changes in ownership/access, stale versions, concurrent writes and safe uncertain-response handling. UI visibility is supplementary. Existing fixed-role assignments are not silently upgraded; any new role or policy requires an explicit reviewed migration and session/access behaviour.

Business writes have stable identifiers, versioned state transitions, actor/time/source history and an appropriate atomic audit/idempotency boundary. Exact retries must not duplicate a customer or business event; conflicting payloads and stale versions fail safely. CRM records do not create ledger or stock effects. Use bounded, deterministically ordered search and reports with accessible keyboard/screen-reader flows and clear loading, empty, error and permission states.

Use synthetic data for development and acceptance. Do not place real contact details, credentials, identity documents or unrestricted CRM contents in documentation, logs or test evidence. New personal-data fields, notes and exports require approved purpose, access, retention, discovery/hold and restore handling. Update the [user guide](USER_GUIDE.md), specialist docs and actual deployment instructions in the same change when a story is implemented.

## CRM-01 — Approve CRM scope and shared-party rules

**Story:** As the product owner, I want a reviewed CRM data and workflow scope so that staff share reliable identities and know which operations they can perform.

**Acceptance criteria**

1. Name product, sales, customer-data, privacy/security, IT and engineering reviewers; record selected CRM use cases, entity ownership, required fields, lawful-purpose and retention decisions, and unsupported channels.
2. Review CF-17/MOD-PLT-01 decisions for customer codes, supplier/customer/contact relationships and existing financial references; define duplicate review, ownership, customer conversion and migration compatibility. Do not approve automatic identity merges.
3. Agree lead and opportunity state transitions, valid owners, optional sources, win/loss reasons, activity types, conversion eligibility and Sales handoff; identify disputed or missing decisions as open.
4. Prepare synthetic examples for a new lead, an existing customer, duplicate candidates, a won/lost opportunity and denied access. Define the candidate release scope and its dependencies without implying phase 1 or CRM is accepted.

**Evidence:** Reviewed decision record, party/relationship diagram, permission and transition requirements, and synthetic cases. **Trace:** MOD-PLT-01, MOD-CRM-01, CF-17, FR-CRM-01/02.

**Review draft:** [CRM-01 scope and shared-party decision record](CRM01_SCOPE_DECISION_RECORD.md) contains candidate rules, a conceptual diagram and synthetic cases. Reviewer names, decisions and approvals remain outstanding; this story and CF-17 remain open.

## CRM-02 — Define CRM access and ownership

**Story:** As a sales operations owner, I want clear CRM access and ownership rules so that users see and change only the records needed for their work.

**Acceptance criteria**

1. Define proposed representative, manager, customer-data and auditor responsibilities, including assignment/team boundaries and which fields, notes, history, imports, reports and exports each may access. These are proposed permissions, not current role grants.
2. Enforce allowed and denied operations on the server for list, detail, direct identifiers and related records; scoped counts and duplicate candidates must not reveal hidden contact names or details.
3. Specify reassignment, inactive owners, employment/access changes, session revocation and permitted manager coverage. Preserve decision history and avoid silent privilege elevation during migration from the current fixed roles.
4. Test cross-team/record/field access, direct API calls, ownership transfer, role change, revoked sessions and both permitted and denied export/report access using named synthetic actors.

**Evidence:** Reviewed access matrix, migration and allowed/denied API/UI tests. **Dependencies:** CRM-01 and phase 1 access design. **Trace:** MOD-PLT-01, FR-CRM-01/02.

## CRM-03 — Maintain contacts and addresses

**Story:** As an authorised sales user, I want to maintain useful contact and address information so that colleagues can identify the right person and organisation.

**Acceptance criteria**

1. Create, view and edit only approved fields with validation, active/inactive status, actor/time/version and appropriate change history. Address and contact requirements come from CRM-01, not assumptions about all countries.
2. Link a contact to one or more permitted customer/supplier records where authorised, using explicit relationships. Do not create a new customer, alter an existing customer code or expose unrelated supplier/Finance fields merely by creating a contact.
3. Reject stale or unauthorised changes; handle concurrent edits, inactive/restricted parties and duplicate link attempts without overwriting another user's work. Provide scoped search and accessible forms.
4. Test allowed/denied field and relationship access, linking one contact to multiple organisations, version conflicts and audit redaction. Data may be collected only for an approved purpose.

**Evidence:** Contract/API/UI tests, data inventory and sales/privacy review. **Dependencies:** CRM-01/02. **Trace:** MOD-PLT-01, FR-CRM-01.

## CRM-04 — Capture and qualify a lead

**Story:** As a sales representative, I want to record and qualify a potential customer so that I can decide whether to pursue the opportunity.

**Acceptance criteria**

1. Create a lead with only approved identity/contact/source fields, assigned owner and next action; validate required fields and show possible duplicates through CRM-06. A source is descriptive, not permission to contact.
2. Support reviewed new, qualified and disqualified transitions, with actor, date and reason where required; specify permissible reopening and retain prior history. A qualified lead may proceed to opportunity or conversion according to policy.
3. Server checks ownership/scope, current version, inactive/restricted data and allowed transition. Retrying a creation or transition does not duplicate the record or decision.
4. Test valid and incomplete intake, disqualification/reopening, stale/concurrent edits, denied team access and safe handling of an uncertain save. No customer, opportunity or journal is created implicitly by qualification.

**Evidence:** State/permission tests and sales walkthrough using synthetic leads. **Dependencies:** CRM-01/02/03. **Trace:** FR-CRM-01, MOD-CRM-01.

## CRM-05 — Assign and transfer lead ownership

**Story:** As a sales manager, I want to assign or transfer leads so that each prospect has an accountable owner.

**Acceptance criteria**

1. Assign an eligible active user/team within the approved scope; show the responsible owner and pending next action without revealing unrelated records.
2. Authorised transfers record the old/new owner, actor, time and reason when required. Define treatment of open activities and opportunities explicitly; transfer does not automatically grant Finance access.
3. Prevent assignment to disabled or ineligible users and reject conflicting updates. On access revocation or deactivation, apply the reviewed policy for pending work and flag unassigned work to an authorised manager.
4. Verify scoped access before/after transfer, direct API denial, inactive owners, audit history and simultaneous transfer attempts. Notify only as allowed by the selected in-app notification policy.

**Evidence:** Permission, reassignment and stale-write tests. **Dependencies:** CRM-02/04. **Trace:** FR-CRM-01.

## CRM-06 — Review duplicate candidates

**Story:** As a customer-data steward, I want to review potential duplicates so that a prospect can be linked safely without combining unrelated financial identities.

**Acceptance criteria**

1. Define explainable candidate matching on approved identity/contact fields, normalisation and bounded results; matching is a suggestion, not proof of identity or permission to contact.
2. Show only candidates and fields the reviewer is authorised to see. If a possible match is restricted, provide a safe escalation path without revealing protected identifiers or forcing creation of another customer.
3. Record the authorised link, create-new or escalation decision and rationale where policy requires; concurrent changes or a newly created matching customer trigger a fresh review under the approved rules.
4. Test same-email different organisations, one contact at multiple customers, restricted candidates and simultaneous reviews. No automatic customer/supplier merge, financial-record rewrite or deletion occurs.

**Evidence:** Duplicate-policy review, scoped search and concurrency tests. **Dependencies:** CRM-03/04. **Trace:** MOD-PLT-01, FR-CRM-02.

## CRM-07 — Track an opportunity

**Story:** As a sales representative, I want to track an opportunity through reviewed stages so that I can understand progress and next actions.

**Acceptance criteria**

1. Create an opportunity linked to an eligible lead or authorised existing customer, an owner, a description, expected close date and optional estimated value. Define monetary precision/currency for forecasts without treating it as booked revenue.
2. Move through the CRM-01 reviewed stages, recording actor/time and prior state; won/lost require the defined reason and retain the historical record. Reopen or cancellation rules are explicit.
3. An opportunity can be associated with a lead/customer according to approved cardinality; stage changes check version and permissions, do not create quotations/invoices, and do not post or alter financial records.
4. Test stage transitions, invalid reversals, restricted links, owner changes, stale writes and concurrent decisions. Ensure history and searches obey the same scope as the opportunity.

**Evidence:** State-machine, permission and no-ledger-effect tests. **Dependencies:** CRM-04/05. **Trace:** FR-CRM-01, MOD-CRM-01.

## CRM-08 — Manage follow-up activities

**Story:** As a sales representative, I want to schedule and complete follow-ups so that I can keep track of my next actions on leads and opportunities.

**Acceptance criteria**

1. Create an assigned task or interaction note linked to an authorised lead/opportunity, with approved type, due date, state and minimal notes. Define the business timezone and overdue calculation.
2. Support completion, cancellation and reassignment with actor/time/history; show assigned work only to authorised users. Owner changes use the agreed CRM-05 policy.
3. Prevent links to hidden or missing records and reject stale edits. Notes and notifications omit secrets and unnecessary sensitive personal data; no email/calendar provider integration is assumed.
4. Test upcoming/overdue/completed views, invalid links, ownership change, denied note/history access, keyboard operation and retry after connection loss.

**Evidence:** Scoped API/UI tests and accessibility review. **Dependencies:** CRM-02/04/07. **Trace:** FR-CRM-01.

## CRM-09 — Link or convert a qualified lead

**Story:** As an authorised sales user, I want to link a qualified lead to an existing customer or create a reviewed customer so that the handoff avoids duplicate financial identities.

**Acceptance criteria**

1. Show eligible existing customers and approved duplicate-review outcomes; let an authorised user explicitly select an existing customer or request/create a new one with the current customer-code validation. Preserve existing customer codes and financial relationships.
2. Define separate permissions for lead conversion, viewing/linking an existing customer and creating a new customer. A user lacking customer-create authority must not gain it through conversion; provide an authorised review/handoff path.
3. Commit the unique lead-to-customer association, approved customer creation if selected, conversion state, history, audit and successful retry outcome atomically. Concurrent or repeated attempts produce one association and no duplicate customer; conflicting payloads fail safely.
4. Test link/create paths, restricted candidates, duplicate codes, concurrent conversion, permission changes, stale versions and rollback/uncertain responses. Conversion does not create a quote, order, invoice, stock movement or journal.

**Evidence:** Populated-schema migration, concurrency/idempotency and direct permission-denial tests. **Dependencies:** CRM-02/04/06 and approved customer-create authority. **Trace:** FR-CRM-02, MOD-CRM-01.

## CRM-10 — Hand an opportunity to Sales

**Story:** As a sales representative, I want to hand a qualified opportunity and customer context to the Sales team so that agreed information is not re-entered or mistaken for a completed sale.

**Acceptance criteria**

1. Define the permitted handoff state and minimal customer, contact, opportunity and ownership fields; preserve source identifiers and apply record/field permissions at both ends.
2. An authorised handoff produces a traceable CRM state/reference and makes the approved information available for a later Sales workflow. If Sales quoting is not yet implemented, show a clear pending/manual handoff state without a nonfunctional quote action.
3. Repeated handoffs, changes in ownership and revoked permissions follow a documented retry/version policy; history identifies the acting user and receiving responsibility.
4. Test authorised/denied handoff, missing conversion/customer, stale opportunity and repeated requests. A won opportunity or handoff is not a Sales order, invoice, cash receipt or posted revenue.

**Evidence:** Reviewed cross-domain contract and API/UI acceptance using synthetic prospects. **Dependencies:** CRM-07/09; Sales integration requires separately approved MOD-SLS-01. **Trace:** MOD-CRM-01, MOD-SLS-01 boundary.

## CRM-11 — Review the scoped pipeline

**Story:** As a sales manager, I want a pipeline view so that I can follow assigned opportunities and overdue work without exposing another team's data.

**Acceptance criteria**

1. Define stages, date/timezone, ownership, conversion/win/loss and overdue calculations, value precision/currency, freshness and included/excluded statuses before implementation.
2. Show authorised filters, scoped counts and drill-through to permitted records; forecasts and expected values are labelled estimates, distinct from accepted orders, posted revenue and collected cash.
3. Aggregate, search, pagination and exports enforce the same underlying row/field permissions; small or filtered aggregates must not reveal data outside the approved policy.
4. Compare independently calculated results for changed stage/owner, duplicate lead conversion and overdue tasks. Test empty/large data, restricted drill-through, accessible list/board alternatives and report responsiveness under an agreed workload.

**Evidence:** Approved metric definitions, independent synthetic calculations and scoped report/UI tests. **Dependencies:** CRM-02/07/08. **Trace:** FR-CRM-01, FR-RPT-01/03.

## CRM-12 — Import contacts and leads

**Story:** As an authorised data steward, I want to preview and import a reviewed contact/lead file so that initial CRM data can be introduced without uncontrolled duplicates.

**Acceptance criteria**

1. Select and document permitted format, size, field mapping, owner/source defaults and personal-data handling. Existing schema 8 master-only JSON import does not currently accept contacts or leads.
2. Preview row-level validation, duplicate candidates and restricted/missing references before an authorised commit; no merge or conversion may be inferred from an email match. Limit candidate information to the operator's scope.
3. Bind approval to the reviewed input and define all-or-nothing or explicit staged boundaries; enforce duplicate/retry/concurrent commit protection and report conflicts without exposing protected rows. Existing customer identities are never overwritten by an import.
4. Test invalid rows, repeated files, changed input, role changes, rollback and privacy-safe diagnostics. Document protected staging files, expiry and disposal.

**Evidence:** Import contract, synthetic batch/rollback tests and privacy review. **Dependencies:** CRM-03/04/06 and approved format/import design. **Selection:** Include only if selected for the CRM release. **Trace:** FR-CRM-02, FR-INT-02.

## CRM-13 — Support CRM privacy requests and retention

**Story:** As a privacy officer, I want CRM records included in discovery, restrictions and retention decisions so that a request can be handled across relevant copies.

**Acceptance criteria**

1. Catalogue contact, address, lead, opportunity, activity, note, history, import, report/export and backup fields, purposes, recipients, access and retention; identify external/manual copies explicitly.
2. Extend authorised subject matching, protected extraction, correction/restriction and hold-aware minimisation decisions to selected CRM records, with review of third-party information and retained business/financial history.
3. Prevent ordinary edits or conversion from bypassing a restriction. Document residual history, export/backup lifecycle and independently recorded post-backup actions; replay restrictions before reopening a restored instance.
4. Exercise identity verification and synthetic access/restriction/hold cases, denied exports, disputed matches and restore replay; a tool or feature alone does not establish legal compliance.

**Evidence:** Privacy-reviewed inventory, end-to-end cases, denied-access and isolated recovery results. **Dependencies:** CRM-01/02 and CF-14/15 privacy decisions. **Trace:** FR-CRM-02, FUP-06.

## CRM-14 — Release and recover the CRM increment

**Story:** As the release owner, I want a tested CRM candidate and recovery plan so that the business can decide whether to use the new workflows safely.

**Acceptance criteria**

1. Record the selected stories, source/client/server/contracts/schema versions and supported environment. Rehearse migration from a populated schema 8 copy, preserving customer codes, existing customer/Finance references and users' intended grants; define client compatibility and rollback/forward repair.
2. Execute the selected CRM end-to-end, negative permission, retry/concurrency, regression, accessible desktop and representative workload scenarios using synthetic data. Reconcile conversion/customer counts and verify no CRM event posted to stock or GL.
3. Verify backup coverage and an isolated restore of CRM records/relationships, restricted exports and post-backup privacy replay. Record operator responsibilities, RPO/RTO results and review any chosen attachment/integration dependency before enabling it.
4. Deliver accurate user/admin instructions, support handover, results and unresolved defects; obtain explicit sales/product, privacy/security and IT/release review for the actual candidate. No new release or deployment is implied by the story document.

**Evidence:** Versioned release record, populated-upgrade/restore drill, tests and named reviewer decisions. **Dependencies:** Selected stories, phase 1 gates and representative environment. **Trace:** MOD-CRM-01 and phase 2A exit gate.

## Decisions before scheduling

Confirm team capacity, CRM priority after phase 1, owners and the initial stage/permission matrix. Decide which party types and import format are required; whether linking existing customers, creating new customers or both are permitted; what duplicate reviewers may see; retention and source-field policy; and how the Sales handoff operates before quotations exist. Define estimates and split stories only after those decisions and relevant CF-17, CF-12 and privacy dependencies are reviewed.
