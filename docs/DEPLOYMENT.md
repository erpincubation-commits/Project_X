# On-premises deployment

## Development on one computer

Supplier policy: set `REQUIRE_SUPPLIER_QUALIFICATION=true` in the API service environment to require approved, unexpired qualification for every new purchase order. Default false permits suppliers without a qualification record while still blocking pending/rejected/expired recorded qualifications. Restart all API instances with the same setting. Invalid values fail configuration validation. Review **Not recorded** suppliers and complete independent qualification review before activation; verify the policy in staging. See [operator steps](OPERATIONS_RUNBOOK.md#supplier-qualification-policy). No migration is required, and this source change does not reconfigure a running installation.

The API listens on `127.0.0.1:3001` by default. PostgreSQL listens on `127.0.0.1:5432`. `npm start` is a convenience launcher for development; it does not install a Windows service. For independent processes, build once and run `npm run server` and `npm run desktop` in separate terminals.

## Multiple computers

1. Run PostgreSQL and the NestJS server on the customer-owned server. Desktop clients never need DATABASE_URL or database credentials.
2. Place an HTTPS reverse proxy in front of the API. Keep NestJS bound to loopback when the proxy is on the same machine. Serve the `/api/v1/` paths unchanged. Configure a certificate trusted by the Windows clients; the application does not bypass certificate validation.
3. Permit only the HTTPS listener through the firewall. Keep PostgreSQL private. If a separate proxy host requires a non-loopback NestJS binding, explicitly set `SERVER_HOST` and `TLS_PROXY_CONFIRMED=true` only after configuring proxy TLS and firewall access. The flag acknowledges the deployment requirement; it does not turn on TLS itself.
4. Configure the service manager, restart policy and logs on the server. Use separate migration and restricted runtime database roles, encrypted volumes, protected secrets and tested backups before real business use. These operations are not automated by the current development setup.
5. Install the desktop client on each Windows machine. Enter the same HTTPS server origin, click Connect, and sign in with a provisioned account. The desktop persists only the server address. Session tokens remain in main-process memory and are cleared locally on sign-out. Offline sign-out cannot revoke a server session immediately; the server enforces 30-minute idle and 8-hour absolute expiry.

For a local-network proof of concept, a Caddy configuration on the API host could look like this:

```caddyfile
erp.company.internal {
    tls internal
    reverse_proxy 127.0.0.1:3001
}
```

This requires DNS resolving the hostname and deployment of the internal certificate authority to clients through the organisation's trusted certificate process. Reverse-proxy software and certificates are not installed by this repository.

## Windows distribution

`npm run package:windows` builds an NSIS installer into `release/`. The development build is unsigned; code signing, release testing and a signed update process remain release tasks. Build artefacts contain only the desktop application, never `.env` or the server database. A separate server deployment is required.

## Release limitations

Implemented: customer creation/listing, initial administrator setup, bcrypt password hashing, mandatory TOTP MFA and recovery codes, nine server-enforced roles, user access management, session expiry/revocation, authentication throttling and audit viewing/recording. Supplier/item masters and purchase request submission/independent approval/rejection include history, version checks and idempotent writes. Schema 5 adds INR accounts/periods, balanced journals, weighted stock valuation, stock/ledger reconciliation and bank matching. Schema 6 adds orders, partial/damaged receipts, three-way invoice matching, dual payment approvals, AP/AR, configured tax and financial statements; see [trade workflows](TRADE_WORKFLOWS.md). See [authentication](AUTHENTICATION.md), [purchasing](PROCUREMENT.md) and [accounting/inventory](ACCOUNTING_INVENTORY.md). Database owners can bypass ordinary audit/history triggers; these are not tamper-proof storage.

Outstanding core-release work includes configurable roles/approvals, account recovery, broader rate limiting, backup scheduling/off-host retention, production monitoring, credits/refunds, reviewed jurisdiction/accounting scope, complete privacy/retention handling and security/financial/operational acceptance. Schema 7 provides limited privacy-case tools; these do not close all rights/retention requirements. Later module scope is staged separately below. Production readiness requires the gates for the selected release scope; listing future modules does not make every later feature mandatory for the first core release or establish GDPR compliance.

## Schema 7 operational procedures

Use the [operations/release runbook](OPERATIONS_RUNBOOK.md) for preflight, migration dry runs/checksums, cutover, rollback and incident response. [Backup/restore](BACKUP_RESTORE.md) now supplies encrypted snapshot archives and verified new-database recovery. Scheduling, role provisioning, key escrow and monitoring remain operator responsibilities. See [verification](VERIFICATION.md) for executable security, accessibility and load checks and [imports/privacy](IMPORTS_AND_PRIVACY.md) for administrator workflows.

## Planned module rollout

Reviewed 17 November 2026. The [module roadmap](ERP_MODULE_ROADMAP.md) proposes core/Finance completion → CRM → Sales with stock fulfilment → Supply Chain expansion → HR core/expenses → Marketing. The [controlled pilot](NEXT_SPRINT_PLAN.md) remains the immediate staging plan. Finance and procurement/stock foundations already exist; HR, CRM, campaigns and complete stocked Sales are not available by installing the current client.

Module delivery is planned within the existing Electron/NestJS/PostgreSQL deployment. There are no new ERPNext/Frappe services, module installation commands, feature flags, environment variables or dependencies in this documentation change. Future releases must record included modules and client/server/contracts/schema compatibility, rehearse populated-database migrations/backfills, review grants and perform module-specific business reconciliation before cutover. Do not assume a future schema number or infer deployed modules from this plan.

Before a release adds attachments, background jobs or external communications, document protected storage and backup coverage, service identity, approved outbound/network routes, credential custody, scheduling, monitoring and retry/recovery behaviour. Normal local ERP work should continue without a vendor internet requirement; external delivery needs its selected provider connection. Keep outbound jobs paused during restore until privacy/suppression and external delivery outcomes are reconciled. HR payroll and Marketing delivery each require their separate scope/acceptance gates. See [module release acceptance](SMB_ERP_TESTING_DEPLOYMENT_RUNBOOK.md#12-module-expansion-acceptance).
