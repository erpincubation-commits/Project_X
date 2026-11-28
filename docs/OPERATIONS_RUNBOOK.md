# Operations and release runbook

## Supplier qualification policy

The optional server environment setting `REQUIRE_SUPPLIER_QUALIFICATION` accepts exactly `true` or `false`, defaulting to `false` when absent. When true, purchase-order issue requires an approved, unexpired supplier qualification even for suppliers with no previous qualification record. When false, suppliers with no record remain eligible; pending, rejected or expired recorded qualifications still block new orders. Other supplier activity and existing downstream records keep their existing rules.

Before enabling, review the supplier register's **Not recorded**, **Pending review** and **Expired** queues and arrange independent qualification reviews. Record the chosen setting in the deployment change record, configure it in the API service environment (or root development configuration), restart all API instances with the same value, and verify missing/approved/expired supplier cases on an isolated staging database. The policy is captured when the server service is constructed. Invalid values fail configuration validation. No database migration or client change is required. To return to the previous no-record eligibility, set false and restart; this does not approve a pending or expired qualification. Protect server configuration and keep secrets out of change records. No running installation was reconfigured by this source change.

Applies to the Windows Electron client, NestJS server and PostgreSQL schema 16. Execute server commands from the repository root. Keep the database private; only the HTTPS API is exposed to clients. Desktop installations never contain server secrets.

## Commands and evidence

| Command | Purpose | Changes the configured business database? |
| --- | --- | --- |
| `npm run db:status` | Applied/pending versions, SQL checksums and legacy baseline state | No |
| `npm run db:dry-run` | Execute pending migrations in one transaction and roll back | No persisted changes; takes DDL locks |
| `npm run db:migrate` | Apply pending migrations atomically | Yes |
| `npm run db:backup` | Encrypted consistent-snapshot logical backup | Read only |
| `npm run db:restore -- <file> erp_restore_<newname>` | Restore into a new database; verify and revoke restored sessions | Creates a separate database |
| `npm run ops:cleanup` | Preview removal of expired transient records, then roll back | No persisted changes; takes row locks |
| `npm run ops:cleanup -- --apply` | Remove expired sessions, challenges, old throttles and unused import previews | Yes; audited, no financial/history deletion |
| `npm run security:check` | Offline repository/configuration assertions | No |
| `npm run security:dependencies` | Registry advisory check for deployed dependencies; high/critical fail | No |
| `npm run test:integration` | API permissions, atomicity, concurrency, upgrade and privacy/import tests | Disposable database |
| `npm run test:recovery` | Real encrypted dump/restore rehearsal, wrong-key/corruption and overwrite refusal | Disposable databases |
| `npm run test:accessibility` | Actual Electron screens, axe WCAG checks and visible keyboard focus | Disposable database |
| `npm run test:load` | Bounded synthetic authenticated reads/writes and duplicate retries | Disposable database |

Build first with `npm ci`, `npm run build` and `npm run check`. Integration, desktop, recovery and load tests need a **development** database account with CREATE DATABASE. Never give that privilege to the production API role. Reports live under ignored `.local/`; collect only reviewed reports as release evidence, never `.env`, secrets, personal exports, raw production logs or database archives.

## Upgrade and release

1. Name a release operator and rollback owner. Record the current release, schema, installed client versions, TLS certificate expiry, service identity, backup destination, expected outage, RPO and RTO. Agree measurable RPO/RTO with the business; this software does not set a statutory retention period or guarantee recovery time.
2. In CI/staging run build, type checks, unit/API tests, security checks, recovery rehearsal, desktop/accessibility checks and load test. Review manual accessibility results and dependency advisories. Test the signed Windows installer on a clean supported machine. Unsigned builds are development artifacts.
3. Review [backup and restore](BACKUP_RESTORE.md). Stop client access and the API through the configured service manager. Stop scheduled writers/importers too. Keep PostgreSQL running. Take an encrypted backup and restore it to a separate quarantined database; check control balances and sample records. Record archive hash and restore duration.
4. Use the migration role and matching release files. Run `npm run db:status` and `npm run db:dry-run` against the intended database during maintenance. A successful dry run rolls back all migration SQL, but can briefly block other sessions. For a data-heavy upgrade, rehearse on the restored copy first.
5. Run `npm run db:migrate`, then `npm run db:status`. All versions through 16 must be applied and verified. Unknown versions, gaps and checksum mismatches stop execution. Pre-checksum installations establish a baseline on their first migration; that baseline cannot prove older SQL was unchanged. Inspect the deployed release/history before accepting it. Never fix a mismatch by changing stored checksums.
6. Configure the API service with a restricted runtime database role (no SUPERUSER, CREATEDB, CREATEROLE, schema CREATE or table ownership). Grant only required schema usage, table SELECT/INSERT/UPDATE/DELETE, sequence usage and application function execution. Keep migration credentials out of the service environment. Execute `npm run security:check -- --production` under that service configuration; TLS proxy confirmation must be set after actual proxy verification, including a loopback-bound API.
7. Start the matching server and desktop release. Check `/api/v1/health`, sign in with MFA, verify reader denial on protected actions, run one approved test transaction in staging, and inspect audit/request references. Confirm production stock, AP, AR, GRNI, bank reconciliation and trial balance against the pre-release figures. Upgrade clients and server together.
8. Reopen access after sign-off. Monitor readiness, 5xx/429 counts, latency, connection pool pressure, disk capacity, service restarts, certificate and backup age. Alerts and service installation are infrastructure responsibilities, not installed by `npm start`.

Migrations are forward-only. On failure, the migration transaction rolls back; inspect status before retrying. If a completed upgrade must be undone, stop writes and recover the pre-upgrade backup into a **new** database, deploy its matching older server/client, then perform the controlled connection cutover described in the recovery runbook. Reverting application files alone does not revert a database.

## Scheduled operation

Use Task Scheduler or the organisation's scheduler under a dedicated restricted Windows account, with a full working directory and noninteractive secret delivery. Schedule encrypted backups to meet the approved RPO, alert on nonzero exit status/missing manifest or an old last-success time, copy to access-controlled off-host storage, and regularly rehearse recovery. Schedule `ops:cleanup -- --apply` daily; it never removes journals, posted documents, audit events or history. Schedule dependency advisory checks and certificate review. Retention expiry and destruction of backup copies/keys follow the approved policy, not an automatic arbitrary deletion command.

## Failure handling

| Failure | Operator response |
| --- | --- |
| Database unavailable / API not ready | Keep access closed; check service, disk, network and database logs. Do not rerun initial setup or recreate the database. |
| Write timed out / connection lost | Retry the same action with the same idempotency key. Refresh after conflict; do not guess whether payment recording succeeded. |
| Invalid import / conflicting code | Correct the source and run another preview. The entire commit rolls back on a conflict. |
| Migration checksum, unknown version or gap | Stop rollout. Find the matching release and investigate with the DBA. |
| Backup/restore verification failed | Do not cut over. Keep any created target quarantined and retain evidence; retry with a verified archive/key after investigation. |
| Financial reconciliation difference | Stop affected posting, preserve evidence and reconcile source records. Never modify posted ledger/history to force agreement. |
| Suspected data exposure | Restrict access, revoke affected sessions, preserve audit evidence and notify the incident/privacy lead through the approved process. The lead assesses reporting duties. |

Record incident times, affected services, correlation IDs, operator actions, approved recovery point, lost/re-entered transactions and final reconciliation. Share sanitised diagnostics only.

## CI release gates

The Windows installer workflow now gates packaging on server type/unit/API/security/recovery/load checks, then real Windows desktop flows with accessibility scans and the packaged startup smoke. Linux recovery uses the PostgreSQL service container's matching dump/restore binaries. The Windows job creates a separate development cluster using the PostgreSQL binaries supplied by the [official Windows runner image](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md); image changes may require PG_BIN configuration. Reports are uploaded without database archives or keys. These workflow changes must still be exercised by your GitHub runner; a local test pass is not a hosted CI execution.

## Planned module release operations

Reviewed 17 November 2026 for the [module roadmap](ERP_MODULE_ROADMAP.md). Current commands and schema 7 remain unchanged. For each later module candidate record included modules, source/client/server/contracts/schema versions, new permissions/backfills, business reviewer and actual migration/acceptance evidence. Run the existing upgrade procedure with a populated-database rehearsal and the changed module scenarios; verify source/ledger/stock and employee-payable totals where applicable.

Attachments, asynchronous delivery and provider connections are proposed dependencies, not configured services. Before enabling them, name storage/secret custodians, runtime identity, network routes, scheduler ownership, bounded retries, queue/delivery monitoring and backup/recovery coverage. Reassess disk growth, query plans, backup duration and lock contention for the new workload. No module-specific environment variables or launch commands are introduced by this plan.

On restore keep future outbound jobs paused; replay privacy restrictions and suppressions, reconcile external delivery/payment outcomes, then authorise resumption. A healthy API or matching row counts cannot prove messages were not already sent. Payroll and Marketing delivery need separate operational acceptance. Follow [module acceptance](SMB_ERP_TESTING_DEPLOYMENT_RUNBOOK.md#12-module-expansion-acceptance) and update the user guide/handover with actual supported tasks.
