# Desktop architecture and migration status

## Current structure

Electron loads bundled React/TypeScript assets in a sandboxed renderer. A context-isolated preload exposes a small set of typed operations. The main process validates IPC senders, handles server requests and retains session tokens in memory. Arbitrary IPC, Node.js access and direct renderer network access are not exposed.

The NestJS server validates requests, enforces permissions for nine roles (including purchasing, accountant and inventory manager), manages MFA and sessions, and owns database transactions. PostgreSQL stores customer/master/request records, INR ledgers, periods, warehouse stock, valuations, bank reconciliations, encrypted MFA secrets, recovery/challenge/session hashes, migrations, audit/history events and retry responses. Desktop clients never connect directly to PostgreSQL. Shared contracts are in `packages/contracts`. See [authentication](AUTHENTICATION.md) for first-run setup and migration instructions.

## Implemented workflow

Connect to the server, sign in, create a customer as an administrator, and refresh the customer register in another client. A reader can list customers but cannot create them. Duplicate codes are rejected, and retries with the same user and request ID return the original result. Customer creation, its audit record and the stored retry response commit in one transaction.

Purchasing now includes supplier/item maintenance and request creation, submission, independent approval/rejection and revision. Record history, exact decimal estimates, version conflicts and idempotent writes are available through the desktop and API; see [procurement](PROCUREMENT.md).

The native database helper manages an isolated development cluster under `.local/`. Existing PostgreSQL servers and Docker are alternative deployment options. The former Python source, test suite, requirements and entry points have been removed. External SQLite files are not read or migrated. Historical commercial feature documents are planning references and do not describe implemented Electron features.

## Next delivery stages

1. Confirm jurisdiction/tax rules and legacy-data migration. INR, moving weighted average and the source posting matrix are now defined.
2. Extend the implemented MFA, administrative account management and nine-role permissions with configurable business roles and approval rules.
3. Extend the implemented supplier/item masters and request submission/independent approval/rejection workflow with purchase orders and receiving. See [procurement](PROCUREMENT.md) for purchasing access and usage; the current application requires schema 6.
4. Extend implemented source-linked purchasing, AP/AR, payment approval/recording and statements with returns, credit notes/refunds, inventory dispatch and jurisdiction-specific tax. See TRADE_WORKFLOWS.md for migration 6 and supported flows.
5. Validate security, concurrency, accessibility, load, backup/recovery, migration and financial acceptance before production.

INR and moving weighted average with negative stock blocked are selected. [Accounting/inventory](ACCOUNTING_INVENTORY.md) and the [posting contract](ACCOUNTING_POSTINGS.md) describe the financial foundation; [trade workflows](TRADE_WORKFLOWS.md) describe schema 6. The first tax jurisdiction remains undecided; configured rates are implemented; statutory tax/GST filing and payroll are not implemented.

## Security and privacy

The architecture follows [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security/) for sandboxing, context isolation, limited IPC and navigation restrictions. HTTPS is required for remote client connections; localhost HTTP is permitted for development.

GDPR compliance also requires organisational and legal decisions about purposes, lawful bases, retention, controller/processor obligations and data-subject requests. Identify personal fields and implement access, export, restriction/erasure, retention, backup handling and incident procedures before real personal-data processing. Encryption and key management need deployment validation. See [European Commission guidance on privacy by design](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en).
