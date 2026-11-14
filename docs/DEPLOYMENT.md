# On-premises deployment

## Development on one computer

The API listens on `127.0.0.1:3001` by default. PostgreSQL listens on `127.0.0.1:55432`. `npm start` is a convenience launcher for development; it does not install a Windows service. For independent processes, build once and run `npm run server` and `npm run desktop` in separate terminals.

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

Implemented: customer creation/listing, input validation, admin/read-only access, expiring server sessions, per-account login throttling, audit entries and idempotent customer creation. The audit trigger blocks normal updates/deletes, but a database owner can bypass it; it is not tamper-proof storage.

Outstanding: MFA, granular permissions, comprehensive rate limiting, backup automation and restore validation, production monitoring, full accounting/procurement/inventory, data-subject request and retention workflows, and security/privacy acceptance testing. These are required before calling the ERP production-ready or GDPR-compliant.
