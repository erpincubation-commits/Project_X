# On-premises deployment

## Development on one computer

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

Outstanding: configurable business roles/approvals, account recovery operations, comprehensive rate limiting, production backup scheduling and off-host retention, production monitoring, credit notes/refunds, statutory tax filing, inventory dispatch sales and remaining ERP modules, data-subject request and retention workflows, and security/privacy acceptance testing. These are required before calling the ERP production-ready or GDPR-compliant.

## Schema 7 operational procedures

Use the [operations/release runbook](OPERATIONS_RUNBOOK.md) for preflight, migration dry runs/checksums, cutover, rollback and incident response. [Backup/restore](BACKUP_RESTORE.md) now supplies encrypted snapshot archives and verified new-database recovery. Scheduling, role provisioning, key escrow and monitoring remain operator responsibilities. See [verification](VERIFICATION.md) for executable security, accessibility and load checks and [imports/privacy](IMPORTS_AND_PRIVACY.md) for administrator workflows.
