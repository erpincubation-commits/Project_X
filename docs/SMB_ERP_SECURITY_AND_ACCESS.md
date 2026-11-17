# SMB ERP Desktop — Security, Access and Failure Handling

**Status:** Draft policy and implementation requirements for review  
**Version:** 0.2\
**Date:** 17 November 2026\
**Related:** [PRD](SMB_ERP_DESKTOP_PRD.md) · [Technical requirements](SMB_ERP_TECHNICAL_REQUIREMENTS.md) · [Backend schema](SMB_ERP_BACKEND_SCHEMA.md) · [Application flow](SMB_ERP_APP_FLOW.md) · [Deployment](DEPLOYMENT.md)

## 1. Purpose and scope

Define who should access ERP functions, how sensitive information should be protected, where failures are contained and how staff respond to incidents. This document covers the Windows Electron client, NestJS server, PostgreSQL, customer-managed infrastructure, backups and operational support.

The detailed roles, permission rules, privacy features and response processes below are **proposed P0 requirements**, unless identified as current. They need product, customer IT, finance and privacy approval and implementation before production. They do not represent an approved access policy, an active incident-response service or proof of GDPR compliance. The original PRD and architecture documents are reference inputs, not operational instructions.

## 2. Current security baseline and gaps

**Implementation update:** Initial administrator setup, mandatory TOTP MFA, recovery codes, session revocation, a nine-role permission registry, user access management and audit viewing are implemented. Supplier/item masters and request submission/independent approval/rejection now enforce record scopes, self-approval restrictions, history, versions and retry protection. See [authentication](AUTHENTICATION.md) and [procurement](PROCUREMENT.md). Schema 6 adds strict invoice allocation, independent price acceptance, scoped payment review and two distinct payment approvers. [Trade access rules](TRADE_WORKFLOWS.md) are authoritative. Schema 5 adds accountant and inventory manager roles, period controls, immutable journals/stock, versioned writes and bank reconciliation. See [actual accounting/inventory access](ACCOUNTING_INVENTORY.md), including the breadth of books.read. The detailed business-role matrix below remains a proposed target beyond the supported registry. The operational summaries below describe current controls; the later proposed matrix is a broader target.

The repository implements nine fixed roles, mandatory MFA, customer/purchasing/accounting/inventory authorisation, password hashing, idle and absolute session expiry, per-account sign-in throttling, input validation, sanitised logging, request IDs, React error boundaries and idempotent domain mutations. The desktop uses context isolation and a sandboxed renderer; session tokens are held in the main process. Remote connections require HTTPS and certificate validation.

The audit trigger prevents ordinary modification, but a database owner can bypass it. Schema 7 supplies encrypted backup/new-database restore tools and limited privacy-case operations; scheduling, off-host retention, production monitoring, full rights/retention coverage, configurable role policies and bank connectivity remain gaps. Existing Windows installer builds are unsigned unless explicitly signed. HTTPS, database privileges, encryption at rest and operation of backup tools depend on the deployment.

Current role grants are authoritative in packages/contracts/src/index.ts and described in AUTHENTICATION.md, PROCUREMENT.md and ACCOUNTING_INVENTORY.md. The broader role matrix below remains proposed; it must not be mistaken for grants already enforced by the application.

## 3. Security ownership

| Responsibility | Proposed owner | Required action |
| --- | --- | --- |
| Business access and approvals | Customer business/data owner | Approve roles, data scope, thresholds and periodic access reviews. |
| User provisioning and revocation | Customer identity administrator | Verify requests, assign approved roles and promptly disable accounts. |
| Server, network and backups | Customer IT / operations | Maintain infrastructure, trusted certificates, encryption, backups, patching and restore tests. |
| Security incident coordination | Named customer incident lead | Triage, contain, preserve evidence, coordinate recovery and assign communications. |
| Personal data decisions | Controller's privacy lead / DPO, where applicable | Assess lawful basis, retention, data requests, breach notification and legal obligations. |
| Product security and patches | Application maintainer | Fix supported software, provide updates and technical guidance; support access is authorised and logged. |
| Financial policy | Customer finance owner and qualified accountant | Approve posting rules, separation of duties and reconciliation. |

Each deployment must name actual people, deputies, contact channels and escalation coverage. A vendor or support person does not receive unrestricted business access by default.

## 4. Access principles

1. Use named accounts, least privilege, explicit business need and deny-by-default server enforcement. UI visibility is not authorisation.
2. Apply permissions to the action **and** permitted organisation, record, field, report and export scope. A user sees only records required for assigned work; approvers see the details needed for their assigned decisions.
3. Roles may be combined only after separation-of-duties checks. Neither an infrastructure administrator nor a user administrator automatically receives finance, payment, audit-content or personal-data permissions.
4. Sensitive changes require a recorded actor, reason when appropriate, and an independent authorised approval. Delegation and temporary access require an expiry and audit trail.
5. All privilege changes, account recovery and emergency access are reviewed. Disable users and revoke sessions when access ends.

## 5. Proposed roles and permission matrix

### 5.1 Roles

| Code | Role | Responsibility and default data scope |
| --- | --- | --- |
| `IAM` | Identity administrator | Provision/disable accounts and assign only approved roles; no automatic operational transaction or audit-content access. |
| `CFG` | Configuration administrator | Maintain approved operational configuration and non-financial system settings; cannot grant their own roles or approve transactions. |
| `REQ` | Requester | Create and view own purchase requests; view necessary item and supplier information. |
| `APR` | Business approver | View assigned documents and decide within approved delegated limits, excluding own submissions. |
| `BUY` | Purchasing | Maintain permitted supplier records and purchase orders; bank-detail changes follow a separate approval path. |
| `WH` | Warehouse | View assigned orders and maintain receipts, stock movements and authorised adjustments for assigned locations. |
| `AP` | Accounts payable | Enter invoices, review matching and prepare payable items or payment batches; no automatic authority to approve a batch they prepared. |
| `FIN` | Finance controller | Maintain accounting, reconcile, post authorised journals and close/reopen periods subject to policy. |
| `PAY` | Payment approver | Review and independently approve assigned batches within limits. Recording payment or bank execution requires separately granted authority. |
| `AUD` | Auditor | Read approved audit and financial evidence in assigned scope; no mutation. Export is a separate explicit grant. |
| `PRV` | Privacy officer | Manage authorised personal-data requests and retention outcomes in assigned scope; no default payment or role-management permissions. |
| `OPS` | Infrastructure operator | Operate services, backups and monitoring using separate OS/database privileges; no automatic ERP business-user role. |

CRM/Sales, HR and Marketing now have proposed boundaries in section 12; manufacturing/customer-service permissions remain separately scoped. The existing nine-role, single-role-per-account registry must be mapped deliberately during any access redesign without silent elevation.

### 5.2 Permission assignments

**Legend:** `✓` = proposed grant within assigned scope; `A` = assigned decision only and subject to section 5.3; `O` = own records only; `—` = no default grant. Separate explicit grants may be approved; role combination never overrides separation-of-duties checks. `OPS` access is infrastructure-level and is not an ERP data permission.

| Permission | IAM | CFG | REQ | APR | BUY | WH | AP | FIN | PAY | AUD | PRV |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Provision/disable users and assign approved roles | ✓ | — | — | — | — | — | — | — | — | — | — |
| Change system/approval configuration | — | ✓ | — | — | — | — | — | — | — | — | — |
| View own / assigned purchase request | — | — | O | A | ✓ | — | — | ✓ | — | ✓ | — |
| Create or submit purchase request | — | — | ✓ | — | — | — | — | — | — | — | — |
| Approve/reject assigned request | — | — | — | A | — | — | — | — | — | — | — |
| View relevant supplier/order data | — | — | O | A | ✓ | ✓ | ✓ | ✓ | A | ✓ | — |
| Maintain supplier master and purchase orders | — | — | — | — | ✓ | — | — | — | — | — | — |
| Propose supplier bank-detail change | — | — | — | — | ✓ | — | — | ✓ | — | — | — |
| Independently approve supplier bank-detail change | — | — | — | — | — | — | — | A | — | — | — |
| Record goods receipt / permitted stock movement | — | — | — | — | — | ✓ | — | — | — | — | — |
| Enter invoice and resolve authorised match exceptions | — | — | — | — | — | — | ✓ | ✓ | — | — | — |
| Prepare payment batch | — | — | — | — | — | — | ✓ | ✓ | — | — | — |
| Independently approve payment batch | — | — | — | — | — | — | — | — | A | — | — |
| Record payment / allocation | — | — | — | — | — | — | — | ✓ | — | — | — |
| Post journal, reconcile and close period | — | — | — | — | — | — | — | ✓ | — | — | — |
| View assigned financial reports | — | — | — | — | — | — | ✓ | ✓ | A | ✓ | — |
| View audit evidence within assigned scope | — | — | — | — | — | — | — | — | — | ✓ | — |
| Handle authorised privacy requests | — | — | — | — | — | — | — | — | — | — | ✓ |

`O` in the supplier/order row means only the minimum supplier/order information linked to the user's own request; it is not access to the supplier register or bank details. Financial reports, audit records and personal data require explicit scope; hiding sensitive fields in the client is insufficient. A read-only customer user maps only to the approved customer read permission, not to a blanket auditor role. The matrix is a starting policy and requires a separate export permission matrix, field-level rules and customer sign-off.

### 5.3 Separation of duties and privilege lifecycle

- The requester cannot approve their own request; a batch preparer cannot approve that batch. Payment batches require two distinct authorised approvers, neither of whom is the preparer. Supplier bank-detail change proposer and approver must be different users. Enforce checks against actual actors and document versions, even when users hold multiple roles.
- Product and finance owners define monetary limits, delegated coverage and other conflicting combinations before release. Exceptions must be time-limited, independently approved and logged; a technical administrator cannot bypass business approval by default.
- Requests for new access state business purpose, scope, approver and expiry where applicable. Identity administrators cannot grant themselves new privileges; an independent authorised reviewer approves privileged access.
- Disable accounts promptly when employment or responsibility ends; invalidate sessions and review outstanding tasks. Review privileged roles and dormant accounts on a customer-defined schedule.
- Emergency access requires a named, time-limited account or controlled elevation, explicit incident reason, independent review and immediate revocation after use. Never share a standing password; record all use and rotate exposed credentials.

## 6. Authentication and session policy

**Current:** Password login, hashed session tokens, per-account throttling, 30-minute idle and eight-hour absolute session expiry exist. Tokens are held in desktop main-process memory; local sign-out clears them, but a disconnected client cannot instantly revoke a server session.

**Required before production:** Named account provisioning, strong password storage, suitable authentication throttling and secure recovery; MFA for privileged and other applicable users; administrative server-side revocation; and a documented lifecycle for lockouts, lost MFA and compromised credentials. Agree the MFA methods, session limits and customer identity integration. Account recovery must verify identity through an approved independent process, not reveal whether an account exists unnecessarily, and be audited.

Enforce secure TLS for production client/server connections, validate certificates and protect the proxy-to-server hop when it crosses hosts. Do not embed credentials or database URLs in the desktop. Secure deployment and key storage are customer and maintainer responsibilities. Signing and trusted distribution are required for production installers.

## 7. Data privacy rules

The customer acting as controller determines purposes, lawful bases, notices, retention and request decisions; vendor/processor responsibilities depend on the actual relationship. Apply privacy by design and default: collect only needed fields, restrict access, maintain accuracy, protect confidentiality and delete or anonymise when appropriate. See the [European Commission's data-protection principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en) and [obligations guidance](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en).

| Data class | Examples | Minimum handling |
| --- | --- | --- |
| Authentication secrets | Passwords, session tokens, recovery codes, signing keys | Never log or export; use approved secure storage and rotation; no raw passwords or bearer tokens in database or renderer storage. |
| Personal data | User details, supplier contact information, employee records in later modules | Limit collection, scope and display; classify and document purpose, access and retention; protect exports and support access. |
| Sensitive financial data | Supplier bank details, payment records, accounting data | Restrict fields and actions, encrypt storage/backups, require independent approval for bank changes and retain appropriate audit history. |
| Business and audit records | Orders, approvals, invoices and audit events | Protect integrity and access; retain according to approved legal/business policy; do not include unnecessary sensitive values. |
| Diagnostics and backups | Error logs, support bundles, database backups | Sanitise logs; encrypt backups and restrict keys; document retention, restore, access and secure disposal. |

Before real personal-data processing, maintain a data inventory and documented retention schedule, including audit logs, exports, non-production copies and backups. Use synthetic data for development where practical. Restrict support exports and use a secure authorised channel; never request or send `.env`, passwords, tokens or private keys. Record support access and remove it when finished.

For data-subject requests, receive and log the request, verify identity proportionately, locate relevant data, assess the applicable right and any financial/legal retention obligations, document the decision and respond through an appropriate channel. Erasure is not absolute; apply restrictions, deletion or anonymisation as appropriate and handle backup expiry/restores under documented policy. Where GDPR applies, responses are generally due without undue delay and in principle within one month, subject to applicable conditions and extensions; the privacy lead must manage the deadline. See [European Commission guidance on requests](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en).

## 8. Error boundaries and safe responses

An error boundary is both a technical containment point and a rule for what the user sees. It must not hide a partial financial outcome or turn an authorisation failure into a successful operation.

| Boundary | Required behaviour | Status |
| --- | --- | --- |
| Renderer / React | Catch render failures, present a recoverable screen and safe diagnostic access. Event handlers and async failures need separate handling; a React boundary alone does not catch all errors. Preserve unsaved inputs only where safely supported. | Basic root boundary and error reporting exist; feature-level isolation and complete recovery need design. |
| Preload / IPC / main | Validate sender, operation and argument shape; reject untrusted calls. Catch transport and OS failures without exposing tokens or arbitrary privileged operations. | Narrow typed IPC and sender validation exist; ongoing verification required. |
| API request | Validate inputs, authenticate and authorise on server. Return safe, consistent error and correlation ID; avoid stack traces, SQL, secrets and account-enumeration details. | Current exception filter returns `message`, `statusCode`, `requestId`; a stable error-code contract is planned. |
| Domain / transaction | Abort on invariant, permission or concurrency failure. Commit stock, accounting, approval, audit and idempotency records atomically where required; rollback on failure. | Implemented for customer creation only; ERP transactions are planned. |
| Database / dependency | Timeout safely; distinguish service unavailability from a known transaction outcome. Do not expose internal database errors. | Some database connection errors map to 503; broader dependency handling is planned. |
| Process / service | Log sanitised fatal event, stop accepting unsafe work and let the service manager restart according to a controlled policy. Avoid infinite restart loops; alert an operator. | Server fatal-event handling exists; production service management and alerting are planned. |
| Backup / monitoring | Report failures independently of the protected service where feasible; never show success before backup verification. | Planned. |

### API and user-facing error classification

| Class | Expected response | User/operator action |
| --- | --- | --- |
| Invalid request `400` / oversized `413` | Safe validation explanation; no internal exception details. | Correct input; contact support with reference if unexpected. |
| Unauthenticated `401` | Generic sign-in/session message. | Sign in again; follow approved recovery process. |
| Forbidden `403` | Safe permission message without revealing restricted records. | Request access through an authorised owner. |
| Missing `404` | Safe not-found response; consider concealment of restricted record existence. | Refresh or contact the record owner. |
| Conflict `409` | Identify a stale update, duplicate, or idempotency conflict without sensitive data. | Refresh, review the authoritative state and resolve deliberately. |
| Rate limited `429` | Safe retry guidance; no secrets. | Wait for the allowed period or contact IT. |
| Internal / unavailable `500` / `503` | Generic message and correlation ID; server records sanitised diagnostic event. | Operator investigates; user retries only when safe. |

Status codes beyond the current implementation are proposed contract requirements, not a guarantee that every endpoint supports them today. Do not automatically retry non-idempotent writes or reveal whether a payment was made when the outcome is unknown.

## 9. Failure-handling protocol

### 9.1 Common response

1. **Detect and classify:** Record time, affected service, severity, current user impact and correlation IDs. Do not include credentials or unnecessary personal data in the ticket.
2. **Protect and contain:** Stop unsafe writes, restrict compromised accounts or isolate affected infrastructure where appropriate. Preserve evidence and availability of safe read-only operations only if verified.
3. **Assign and escalate:** Notify the named incident lead and relevant IT, finance or privacy owners through approved internal channels. Determine whether personal data or financial integrity may be affected.
4. **Investigate and recover:** Check health, recent changes, sanitised logs and backup status. Restore or repair through authorised procedures; confirm data integrity, permissions and reconciliation before reopening writes.
5. **Communicate and review:** Give affected users clear status and safe next steps. Record decisions, recovery evidence, root cause, corrective actions, owners and deadlines; review the incident without exposing sensitive data unnecessarily.

### 9.2 Scenarios and runbooks

| Failure | Immediate handling | Recovery and verification |
| --- | --- | --- |
| Client/server network loss | Show disconnected state; do not silently queue financial writes. For an uncertain outcome, tell the user to check the server before retrying. | Restore trusted connectivity. Look up the committed operation by authorised record/reference; reuse the same idempotency key only where supported, then reconcile. |
| Invalid TLS certificate | Refuse connection and notify IT; never offer a bypass. | IT checks hostname, expiry, trust chain and certificate deployment, then verifies a trusted connection. |
| Expired or compromised session | Reject access; clear local session and revoke server sessions for a compromise. | Verify identity through approved recovery, rotate affected credentials and review access/audit events. |
| API or database unavailable | Return safe unavailable response with reference; block dependent writes rather than claiming success. | Check service and database health, capacity and connectivity; recover through approved procedures and test representative operations. |
| Timeout after write | Mark outcome as **unknown**, not failed or successful; avoid blind repeat submission. | Search authoritative records and idempotency outcome. If committed, show result; if not, retry safely under the supported policy. Escalate unresolved discrepancies to finance. |
| Concurrent edit or duplicate | Reject conflicting operation and preserve known state. | Reload record and resolve deliberately; do not overwrite another user's approved change. |
| Failed migration or upgrade | Stop rollout; preserve logs and prevent incompatible writes. | Assess forward repair versus verified backup restore, follow rehearsed procedure and reconcile before reopening. |
| Backup failure or suspected corruption | Alert IT; record the period at risk and protect remaining backups. | Repair backup process, create a new backup, test isolated restoration and notify owners if recovery objectives were missed. |
| Security incident or ransomware | Isolate affected systems/accounts, preserve evidence and contact incident/security and privacy leads promptly. | Recover from a verified clean backup only after containment; validate integrity, access and monitoring before service restoration. |
| Suspected personal-data breach | Escalate immediately to the controller/privacy lead and preserve the discovery timeline. | Assess likelihood and severity of harm, document facts and decisions, and carry out applicable notifications through authorised people. |

### 9.3 Personal-data breach escalation

Where GDPR applies, the controller must assess whether a personal-data breach is likely to result in a risk to individuals and, when notification is required, notify the relevant supervisory authority without undue delay and, where feasible, within 72 hours of becoming aware; a delay requires reasons. A processor must notify its controller without undue delay. Communication to affected people may also be required where the breach is likely to result in a high risk. The privacy lead determines applicability and records the assessment; do not wait for a complete technical investigation before escalating. See the [EDPB guidance on data breaches](https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en).

## 10. Logging, audit and monitoring

- Separate diagnostic logs from business audit events. Capture timestamp, component, event, severity, safe correlation ID and outcome; include actor and affected record in authorised audit records where appropriate.
- Never log raw passwords, tokens, database URLs, unrestricted request bodies, private keys or unnecessary personal/financial data. Sanitize exception details and control access to support bundles.
- Audit changes to roles, access, approval rules, sensitive supplier details, payment decisions, journals and privacy actions, including failures where useful. Security events that lack an authenticated user need an explicit system/anonymous actor model.
- Use restricted write/read paths, independent administrative oversight, protected backups and retention policies for audit records. The existing database trigger does not protect against a database owner; no absolute tamper-proof claim should be made.
- Define alerts and owners for authentication abuse, privileged access, service/database failures, backup/restore failures, disk capacity and suspicious financial changes. Monitoring and response schedules require customer-specific agreement.

## 11. Verification and release gates

Before a production release, demonstrate and record:

1. A reviewed role, record-scope, field and export matrix; tests for allowed and denied API actions, combined roles, self-approval and privilege changes.
2. MFA and secure recovery for applicable users; session expiry/revocation, lost-device and emergency-access tests.
3. TLS/certificate tests; desktop sandbox and IPC tests; secrets and installer-signature review; least-privilege server/database and backup accounts.
4. Error-boundary and dependency-failure tests, including renderer crash, database outage, uncertain write, idempotent retry, concurrency conflict and rollback.
5. Financial integrity and reconciliation tests, including independent approvals and supplier bank-detail changes.
6. An approved privacy inventory, request and retention processes, access to exports, breach escalation and organisational responsibilities.
7. Monitoring and incident contacts, a rehearsed restoration, measured customer-approved recovery objectives, and tested migration/upgrade recovery.
8. Security review, dependency inventory and remediation of release-blocking findings. Exceptions require named approval, expiry and an accountable owner.

None of the proposed controls should be treated as complete until implemented, configured and tested in the actual deployment. Agree the pilot customer, first jurisdiction, approval limits, support access, incident contacts, retention periods and recovery objectives before final approval.

## Implemented operational access

Schema 7 adds imports.manage for administrator and purchasing roles (customer imports additionally require customers.create), and privacy.manage for administrators only. Identity administrators and auditors do not receive privacy exports or mutation rights. Subject-wide holds block minimisation/restriction release; restricted users/suppliers cannot be ordinarily reactivated. Historical financial/audit data remains retained. See [imports/privacy](IMPORTS_AND_PRIVACY.md) and [verification](VERIFICATION.md).

## 12. Proposed module access boundaries

Reviewed 17 November 2026 for the [module roadmap](ERP_MODULE_ROADMAP.md). These are permission-design requirements for MOD-PLT-01 and the domain epics, not new role codes or current grants. Current fixed-role users gain no future-module access through their job title. Define action, record, field, search, aggregate and export scope before module implementation.

| Responsibility | Proposed allowed scope | Required denial / independent decision |
| --- | --- | --- |
| CRM owner / Sales user | Assigned leads, contacts, opportunities and authorised quotes/orders; minimum customer/credit status for the task. | Other teams' contacts and bulk export denied by default; customer merge/conversion and ownership transfer audited; no access to supplier payments or employee data. |
| Sales manager / credit reviewer | Assigned team's pricing/discount review; Finance-approved credit authority under explicit policy. | No self-approved price/credit exception when independence required; accepted version and decision actor retained; no automatic journal or refund grant. |
| Purchasing / warehouse | Approved sourcing, count/quality/return decisions and dispatch within explicit warehouse scope. | Separate proposer/reviewer for count or quality exceptions; no payment approval/execution through purchasing or warehouse role; no cost/financial fields unless separately granted. |
| Finance / settlement | Approved invoices/credits/refunds, employee payable posting and confirmed settlements within reviewed scope. | Preserve independent payment controls and source reconciliation; salary/medical/profile data not required for reimbursing a claim; no direct control-account workaround. |
| Employee / line manager | Own profile/requests/claims and explicitly assigned reports' leave/attendance decisions. | No peer profiles, compensation or unrelated receipts; prohibit own-claim/own-leave approval; delegated manager access expires and does not expose all HR records. |
| HR administrator | Approved employee/lifecycle/leave fields and HR reports. | No identity-role assignment, claim settlement or unrestricted finance access by default; payroll grants separately designed if payroll is selected. |
| Marketing planner / sender | Approved campaign metadata, purpose/channel eligibility and scoped audiences/results. | No unrestricted CRM export, employee audience reuse, credit balances or authentication data; independent audience/send approval as policy requires; suppression cannot be bypassed by reimport or new campaign. |
| Integration/job identity | Narrowly scoped delivery or synchronisation actions with protected service credentials. | No interactive administrator impersonation; verify callbacks, replay protection and per-operation audit; pause on restore/credential compromise. |

Separate contact preferences, suppression evidence and employee records from unrestricted history, diagnostics and dashboards. Extend discovery/holds/retention to new entities and attachments before processing real records. Customer deduplication cannot automatically merge financial identities or override a restriction. Marketing eligibility is a purpose/channel policy decision to review with the controller; merely holding an address does not authorise sending.

Module acceptance must test direct API access, altered IDs, team/manager reassignment, offboarding/session revocation, denied field/search/report/export access, self-approval and combined-role conflicts where composable roles are introduced. Restore drills replay post-backup restrictions/suppressions before jobs resume. New service credentials/providers/attachments require named operational ownership and protected backup/key handling. Payroll requires a separate sensitive-data and legal/accounting review.
