# SMB ERP Desktop — Testing and Deployment Runbook

**Status:** Draft; development and staging procedures with production release gates  
**Version:** 0.2\
**Date:** 17 November 2026\
**Audience:** Developers, QA, customer IT, release and incident owners  
**Related:** [Development](DEVELOPMENT.md) · [PostgreSQL setup](POSTGRES_SETUP.md) · [Deployment](DEPLOYMENT.md) · [Windows installer](WINDOWS_INSTALLER.md) · [Security and access](SMB_ERP_SECURITY_AND_ACCESS.md)

## 1. Purpose and present release status

**Authentication update:** Follow [authentication setup and verification](AUTHENTICATION.md) for current administrator setup, mandatory MFA, role management, migration 3 and test isolation. Integration/desktop test runners now create a disposable database, requiring `CREATE DATABASE`, then create temporary schemas inside it. The older no-MFA login smoke steps and schema-only permission assumptions below must be adapted to the updated flow. Production ERP gates still apply.

This runbook describes how to validate the existing Electron/NestJS/PostgreSQL application, build and test its Windows installer, stage an on-premises deployment and decide whether a release can proceed. It also records the additional testing and operations required for the planned ERP. The product documents are planning inputs; the commands and current capabilities below come from the repository.

**Current application:** Mandatory MFA, nine-role server permissions, customers, supplier/item masters, request approval/rejection, INR accounting/periods/journals, warehouses, weighted stock and bank/stock/ledger reconciliation are implemented. Follow [accounting/inventory setup](ACCOUNTING_INVENTORY.md) and [the posting contract](ACCOUNTING_POSTINGS.md) for the accounting foundation and test coverage. Orders, partial/damaged receiving, invoice matching, dual payment approvals, confirmed transfers, AP/AR, configured tax and statements are implemented under schema 6; see [trade workflows](TRADE_WORKFLOWS.md). Statutory tax filing, credit notes/refunds and bank connectivity remain future work.

**Production gate:** The current repository is not a production-ready ERP. Schema 7 includes encrypted backup/new-database restore and limited import/privacy tools; scheduling/off-host retention, full privacy coverage, configurable policies, recovery operations, production monitoring and financial/security/environment acceptance remain outstanding. The [module roadmap](ERP_MODULE_ROADMAP.md) stages future modules independently of selected core-release acceptance. The default installer is unsigned. Treat the multi-machine procedure in section 6 as a staging/pilot procedure until all applicable gates are met. No tests or deployment are claimed to have run merely because this runbook exists.

## 2. Roles and environment record

Assign a named release owner, QA lead, server/database operator, customer IT contact, security/privacy owner and finance acceptance owner. One person may hold multiple operational roles if independently reviewed; business approvals must still respect separation of duties. Agree maintenance window, rollback authority and support contact before deployment.

Record the following without including secrets:

| Item | Record for each run |
| --- | --- |
| Release | Source revision, application/server version, schema migration version, build and artifact identifiers. |
| Environment | Development/staging/production; owner; Windows and server OS; PostgreSQL version; server hostname and port. |
| Data | Dedicated test database and permitted test accounts; backup identifier and verified restore point for an upgrade. |
| Network | HTTPS hostname, certificate owner/expiry, proxy and firewall boundaries. |
| Evidence | Test result location, installer checksum/signature, approvals, incidents and release decision. |
| Recovery | Recovery point/time objectives, backup location and encryption key custodian, prior compatible server/client version. |

Never put passwords, connection strings containing credentials, tokens, `.env`, private keys or unredacted personal records in the run record, logs, tickets or screenshots. Use a dedicated isolated database with synthetic data for tests.

## 3. Prerequisites and database safety

1. Use Windows with a supported Node.js installation; the repository requires Node.js **22.12 or later**. Install project dependencies using `npm ci` from the repository root. Confirm the supported version matrix before production.
2. Select **one** PostgreSQL target: the native project development cluster, a dedicated existing PostgreSQL server/database, or the Docker development alternative. The local default port is 5432; only one service can bind the same address and port. The API defaults to `127.0.0.1:3001`.
3. Confirm the target database and account in protected configuration without printing or sharing credentials. Set `DATABASE_URL` and any other configuration in the root `.env` or protected environment. Changing an `.env` password does not change PostgreSQL's stored password.
4. Integration and desktop runners create a randomly named disposable `erp_test_...` database using the development DATABASE_URL account, then temporary schemas inside it. They require CREATE DATABASE and drop that disposable database on completion. Use a development account; never run tests using a production database owner. Interrupted runs may leave a disposable database for inspection.
5. `npm run setup` and `scripts/Setup.cmd` initialise the native development setup. Do not use them against an existing or remote deployment. `npm run db:migrate` changes its configured target and may bootstrap an administrator if configured; check the target and take an appropriate backup before running it.
6. Never delete `.local/postgres`, a PostgreSQL data directory or Docker volumes to fix a connection problem. Do not use `docker compose down -v` against data that must be retained.

For exact database options, permissions and account creation, use [PostgreSQL setup](POSTGRES_SETUP.md). Production requires separate restricted runtime, migration and backup roles; the local cluster owner is a development superuser.

## 4. Local development and current automated tests

Run PowerShell from the repository root. Read the database prerequisites first; do not run a setup or migration command against the wrong target.

### 4.1 Prepare and start

For a **new native development cluster only**:

```powershell
npm ci
npm run setup
npm run db:check
```

For an **already provisioned dedicated test database**, configure its protected connection first, then:

```powershell
npm ci
npm run build:server
npm run db:check
npm run db:migrate
```

For routine development, `npm run dev` starts watchers and the desktop. `npm start` builds and launches the local server and desktop. `scripts/Start_Desktop.cmd` invokes `npm start`; it is a development launcher, not a production service. Stop the launcher with Ctrl+C. PostgreSQL runs independently; use the correct service/cluster procedure for the chosen target. `npm run db:start` and `npm run db:stop` control the project-managed native development cluster, not an arbitrary existing server.

### 4.2 Validation sequence

Use the isolated test database described above. Stop and investigate a failed command rather than recording a pass from later commands.

```powershell
npm run check
npm run build
npm test
npm run test:integration
npm run test:desktop
```

| Command | Present coverage and expected result |
| --- | --- |
| `npm run check` | TypeScript checks across workspaces; exits successfully. |
| `npm run build` | Builds shared packages, server and desktop; exits successfully. |
| `npm test` | Runs current logging and server contract tests; exits successfully. |
| `npm run test:integration` | Uses a temporary PostgreSQL schema to exercise authentication, permission denial, validation, retry, audit and transactional rollback; exits successfully and normally removes its schema. |
| `npm run test:desktop` | Starts a test server and two Electron clients against a temporary schema; verifies the shared customer workflow; exits successfully. Requires a working Windows GUI/session. |

These suites now include implemented procurement, books, trade and operational cases; consult current workflow guides and test source for exact coverage. They do not verify proposed module requirements merely because the commands exist. If a test is interrupted, an administrator may inspect leftover `erp_test_...` schemas and remove only a verified disposable test schema under the database's change procedure. Do not run broad schema cleanup commands.

### 4.3 Manual smoke test — current functionality

Use a staging/test server, a pre-provisioned `admin` and `reader`, and clearly synthetic customer details. This test **creates a customer in the selected database**; use a disposable environment and a unique code.

1. Open the desktop and connect to the intended server. For a remote server use the trusted HTTPS origin supplied by IT.
2. Sign in as the administrator. Create a customer with a unique test code and name; confirm a success message and the new row in the register.
3. Sign in on a second client with the reader account; refresh and confirm the same customer is visible. The create form is not shown for a reader.
4. Verify the server rejects a direct unauthorised create attempt with `403` using an approved test harness. Do not paste bearer tokens into tickets or terminal history.
5. Try invalid input and a duplicate code; confirm a useful error and no additional customer. Sign out and verify protected operations require a new sign-in.
6. Review only authorised, sanitised logs and correlate an error reference ID if troubleshooting. Preserve test evidence without secrets or unnecessary personal data.

## 5. Build and verify the Windows installer

On a Windows build machine from a clean checkout:

```powershell
npm ci
npm run package:windows
npm run test:packaged
```

The build produces an NSIS installer, `.sha256` checksum and unpacked desktop under `release/`; the filename includes the application version. `test:packaged` launches the unpacked app and checks its connection screen, bundled assets, preload and isolation. It does **not** test installing the NSIS package, a complete server workflow or a signed production release.

For release distribution, obtain a signed artifact using the protected signing procedure in [Windows installer](WINDOWS_INSTALLER.md), verify that its SHA-256 digest matches the separately trusted release record and verify the code signature/trust on a separate Windows machine. For example, once the exact installer path has been independently selected:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<path-to-installer.exe>'
Get-AuthenticodeSignature -LiteralPath '<path-to-installer.exe>' | Format-List Status,SignerCertificate
```

Compare the calculated digest with the trusted published checksum and confirm an acceptable signature and signer. On a clean test workstation, install the actual `.exe`, launch it, connect to staging, perform the relevant smoke test, upgrade from the previous supported version and uninstall. Verify server data remains intact. Document results, Windows version and artifact identity. Do not install an unsigned development artifact as a production release.

The configured [GitHub Actions workflow](../.github/workflows/windows-installer.yml) runs Linux build/tests with PostgreSQL and a Windows installer build/packaged smoke test on configured events. It uploads workflow artifacts and does not publish a release. Signing is opt-in for a manually dispatched workflow with protected credentials; a workflow file or local run is not evidence that remote CI passed.

## 6. On-premises staging deployment

### 6.1 Pre-deployment

1. Confirm approved source revision, successful tests, staging scope, owner, server and workstation specifications, network routes, and maintenance window.
2. Provision a dedicated staging PostgreSQL database and server account(s), and use protected configuration. Establish a trusted HTTPS hostname, certificate, reverse proxy and firewall rules. The desktop must never receive a database URL or password.
3. Confirm how the server will be supervised and restarted, where sanitised logs are retained, who monitors it, and how backups are encrypted, stored and restored. These operational pieces are not installed automatically by the repository.
4. For an upgrade, take a backup and verify a representative restore in isolation; record current server, client and migration versions. Agree compatibility, stop conditions and rollback authority. Staging should use synthetic or appropriately protected data.
5. Confirm no other service is unintentionally displaced from the intended ports. PostgreSQL 5432 is a convention, not a requirement to reconfigure or stop another service.

### 6.2 Server and desktop

1. Deploy the reviewed server code/build and its required runtime dependencies using the organisation's approved packaging and service-management procedure. The repository does not currently provide a complete production server installer or service definition.
2. Configure the server's protected database connection, host and port. Use a separate privileged migration identity for database changes and a restricted runtime identity. If a same-host proxy is used, keep the API on loopback; do not expose PostgreSQL to workstations.
3. After verifying the target and backup, apply the reviewed migration using the project's documented mechanism under the migration identity. `npm run db:migrate` may also bootstrap an administrator if configured, and changing bootstrap values does not reset an existing account. Switch to the restricted runtime credentials for normal operation.
4. Start the server under the agreed supervisor. Configure the HTTPS reverse proxy to pass `/api/v1/` unchanged and install the trusted certificate chain on client machines through customer IT. `TLS_PROXY_CONFIRMED=true` only acknowledges proxy configuration; it does not enable TLS.
5. Validate readiness through the proxy. From a machine that trusts the staging certificate, replace the illustrative hostname with the approved one:

   ```powershell
   Invoke-RestMethod 'https://<staging-host>/api/v1/health'
   ```

   Expected current response: `status` is `ready`, meaning the API's `SELECT 1` database check succeeded. This unauthenticated endpoint is not a comprehensive security, backup or business-workflow test; restrict exposure as appropriate. A certificate failure must be fixed, not bypassed.
6. Install the selected desktop artifact on a staging Windows workstation, configure the HTTPS server address and execute the manual smoke test in section 4.3. Check a second client and the reader denial. Record artifact, certificate and test evidence.
7. Confirm the service restart and log collection procedures, restore test, controlled shutdown, monitoring and user support contacts. Roll out to additional staging users only after the release owner accepts the evidence.

## 7. Production release gates

Do not proceed with a production ERP release until all gates below have owners, evidence and approval:

- **Function and accounting:** P0 procure-to-pay, finance, inventory and reports are implemented; first jurisdiction, tax rules and posting matrix are approved; end-to-end and reconciliation acceptance passes.
- **Security:** MFA, granular roles, separation of duties, server-side enforcement, reviewed audit, secure transport, restricted database accounts, vulnerability review and signed installer are complete and tested.
- **Privacy:** Controller responsibilities, data inventory, access/retention/request processes, encryption and key management, incident procedures and applicable legal review are complete.
- **Operations:** A supported server installation and supervision process, monitoring, patching, encrypted backups, tested restore and documented recovery objectives exist for the actual deployment.
- **Validation:** Current and new unit/integration/end-to-end tests, Windows install/upgrade/uninstall, accessibility, representative load, security and recovery tests pass. Evidence includes environment and data volume.
- **Change approval:** Customer IT, business/finance, security/privacy and release owners approve the exact artifact, deployment plan, maintenance window and recovery plan. No automatic publication or release is implied by this document.

## 8. Post-deployment verification and handover

1. Confirm service health through the trusted proxy, expected schema version, certificate validity, logging and monitoring. Verify failed backups and health checks produce an actionable alert through the agreed channel.
2. Use approved non-production accounts and data to check login, access boundaries and a representative end-to-end workflow. In production, use a pre-approved non-destructive verification plan; do not create or pay a real business transaction as a casual smoke test.
3. Verify backup completion and a recent isolated restore against the customer's recovery objectives. Review source transactions, stock, subledgers and ledger reconciliation when those modules exist.
4. Record installer/server versions, checksums/signature, test outcomes, unresolved issues and responsible owners. Hand over operating procedures, support contacts, certificate renewal and rollback plan.
5. Monitor the agreed observation period. Release owner closes the change only when acceptance criteria are met; unresolved critical issues trigger section 9.

## 9. Failure and recovery procedures

| Symptom | Immediate action | Recovery / verification |
| --- | --- | --- |
| API port in use or wrong database on 5432 | Stop the deployment; identify the actual process/service and target using customer-approved inspection. Do not stop unrelated services. | Correct configuration or arrange a maintenance change; recheck endpoint and database identity. |
| PostgreSQL password authentication fails | Check which server and username are being used without exposing credentials. | Coordinate password and configuration updates with the database owner; `.env` changes alone do not change the database password. |
| Invalid or untrusted HTTPS certificate | Stop remote connection. Do not disable validation. | IT corrects hostname, trust chain or expiry; repeat the health and client connection tests. |
| API cannot reach PostgreSQL or migrations mismatch | Stop dependent writes and check server, network, target and schema logs. | Fix connection or follow reviewed migration/restore plan; confirm health and expected schema before resuming. |
| Interrupted write / lost response | Treat outcome as unknown; do not blindly repeat a financial action. | Check authoritative record and supported idempotency outcome; reconcile and retry safely or escalate. |
| Installer signature/checksum invalid | Quarantine artifact and halt rollout. | Obtain a verified artifact through the trusted channel and investigate the release chain. |
| Failed migration or corrupted data | Stop rollout and preserve evidence; contact release and database owners. | Use a reviewed forward repair or restore a verified compatible backup into an isolated environment first; validate integrity and accounting reconciliation. |
| Backup or restore test fails | Alert the operations owner and record the exposure window. | Fix backup process, create and verify a new backup, test restoration and assess missed recovery objectives. |
| Suspected security or personal-data incident | Contain affected accounts or systems under the incident plan, preserve evidence and alert security/privacy owners. | Follow [security and access](SMB_ERP_SECURITY_AND_ACCESS.md#9-failure-handling-protocol), including controller-led notification assessment. |

### Rollback decision

The release owner coordinates rollback with the database and business owners. Stop unsafe writes and determine whether the previous application version supports the **current** database schema. If it does, use the approved prior artifact and verify service and business integrity. If a migration is incompatible, do not simply install an older server against the new database: follow the rehearsed forward-repair or backup-restore procedure. Restoring a backup may discard transactions created after that backup; identify, preserve where possible, reconcile and obtain business approval for the recovery point before restoration. Never overwrite the only copy of potentially needed evidence or data.

## 10. Future ERP test plan

This matrix mixes regression obligations for implemented foundations with remaining target tests. Extend executable tests/fixtures for each selected module; neither a scenario listed here nor a previous baseline pass establishes acceptance for a new release. Section 12 identifies proposed module scenarios.

| Test level | Planned acceptance |
| --- | --- |
| Unit / contracts | Approval transitions, validation, tax/rounding policy, posting rules, error contracts and role decisions. |
| Database / concurrency | Parallel partial receipts and invoice/payment allocations cannot exceed eligible quantities or balances; no partial commits; idempotency and migration compatibility. |
| End-to-end | Two or more roles complete request → independent approval → order → partial receipt → invoice match/exception → payment recording → reconciliation. |
| Security / privacy | Denied API/field/export access, MFA and revocation, IPC restrictions, TLS failures, logging sanitisation, retention and data-subject request controls. |
| Accessibility | Keyboard, focus, screen-reader and scaling tests of core workflows and errors on supported Windows configurations. |
| Performance | Representative data and 50 concurrent users; test PRD targets for common screens, routine API requests and standard financial reports with documented conditions. |
| Recovery | Restore representative encrypted backups, verify data and ledger/stock reconciliation, and measure agreed recovery point/time objectives. |
| Release | Signed clean-machine installation, compatibility, upgrade/uninstall, protected server deployment, monitoring and incident drill. |

## 11. Test and release record template

```text
Environment and owner:
Date / release owner:
Source revision / client / server / schema versions:
Test database (identifier only; no connection string):
Windows / server OS / PostgreSQL versions:
Installer artifact / trusted SHA-256 / signing verification:
Commands and manual scenarios / result / evidence location:
Known failures and owner / risk acceptance reference:
Backup identifier / isolated restore verification / recovery objectives:
Security, privacy, finance and customer IT approvals:
Deployment decision / time / rollback authority:
Post-deployment observations / handover:
```

## Executable operations supplement

The implemented schema 7 commands, release gates, maintenance and failure protocols are documented in [Operations runbook](OPERATIONS_RUNBOOK.md), [Backup/restore](BACKUP_RESTORE.md) and [Verification](VERIFICATION.md). Use these executable procedures for the current release; broader scenarios remain planning requirements unless explicitly verified.

## 12. Module expansion acceptance

Reviewed 17 November 2026. These are proposed acceptance scenarios for the [module roadmap](ERP_MODULE_ROADMAP.md), not executed tests or changes to PIL-01–08. Each needs synthetic fixtures, independent expected results, allowed/denied actors and source/client/server/contracts/schema/module versions in its evidence record.

| Module / epic | Business and integrity scenarios | Failure, scope and release scenarios |
| --- | --- | --- |
| Shared platform / MOD-PLT-01 | Preserve customer codes and financial/master links on populated-schema upgrade; reviewed contact matching and optional employee/user link. | Incompatible clients and ungranted module access rejected; no silent role elevation; privacy/import/backup coverage for added entities. |
| Finance / MOD-FIN-01/02 | Opening totals and partial supplier/customer credit/refund, prior settlement, tax/rounding/period effects; reviewed budgets/dimensions, report totals and duplicate bank-file handling. | Concurrent over-credit/refund rejected; rollback/retry leaves one balanced source; AP/AR/GRNI/stock/GL tie-out and scoped exports. |
| CRM / MOD-CRM-01 | Lead qualification, contact linking, stage/activity history, won/lost reasons and customer conversion. | Parallel/retried conversion creates one link; duplicate review preserves financial identities; team/search/field/export denial; no ledger effect. |
| Sales / MOD-SLS-01/02 | Accepted price/discount/credit decisions; partial reserve/pick/dispatch/invoice/collection and stock return/credit; existing service AR regression. | Competing reservations/dispatch cannot oversell; cancellation releases eligible commitments; no double stock/COGS or AR under retry; stock/COGS/AR/tax/bank reconcile. |
| Supply Chain / MOD-SCM-01/02 | Explainable demand/reorder; RFQ/quote selection and approved allocations; quarantine/release, count adjustment and invoiced/uninvoiced supplier returns. | No duplicate procurement of demand; warehouse denial and independent count/quality decision; stale stock version; original receipt/valuation and GRNI/AP/GL reconcile. |
| HR / MOD-HR-01/02 | Employee lifecycle, own/manager leave/attendance, cancellation/balance and independent expense claim through Finance payable/confirmed payment. | No self-approval or duplicate claim posting/payment; concurrent leave preserves balances; denied peer/compensation/receipt access, offboarding/session revocation and retained history. Payroll excluded. |
| Marketing / MOD-MKT-01 | Campaign plan and eligible audience; source links through lead/opportunity/order/invoice; model/window-specific deduplicated funnel and cost/net-revenue metrics. | No unauthorised audience/detail export; suppression overrides old snapshots/reimport; aggregate privacy and retention/restore replay; no journal for attributed pipeline or campaign plan. |
| Optional outbound / MOD-MKT-02 | Approved provider and message intent; eligibility recheck, delivery result and unsubscribe. | Timeout after provider acceptance, duplicate/reordered callback, bounded retry/dead letters, revoked credentials and restore; pause/reconcile uncertain outcomes before resend. |

For every module exercise typed IPC/contract validation, direct API denial, uncertain saves, state/version conflicts, keyboard/screen-reader/scaling, protected diagnostics and representative mixed-workload performance. Rehearse populated-database migration and isolated recovery, including external attachments if selected. Reapply post-backup restrictions/suppressions before access/jobs resume; row counts alone do not establish delivery correctness.

Extend the section 11 release record with module/epic IDs, scope/metric definitions, posting-policy version, backfill/reconciliation results, new grant matrix, attachment/provider/job configuration references (no secrets), tests/results/defects, reviewers and rollback/resumption authority. Use existing build/test commands and add targeted cases when implementing; no new command or module installation mechanism is defined by this plan.
