# Desktop architecture and migration status

## Current structure

Electron loads bundled React/TypeScript assets in a sandboxed renderer. A context-isolated preload exposes a small set of typed operations. The main process validates IPC senders, handles server requests and retains session tokens in memory. Arbitrary IPC, Node.js access and direct renderer network access are not exposed.

The NestJS server validates requests, enforces admin/read-only permissions, manages sessions and owns database transactions. PostgreSQL stores customers, accounts, session-token hashes, migrations, audit events and idempotency responses. Desktop clients never connect directly to PostgreSQL. Shared contracts are in `packages/contracts`.

## Implemented workflow

Connect to the server, sign in, create a customer as an administrator, and refresh the customer register in another client. A reader can list customers but cannot create them. Duplicate codes are rejected, and retries with the same user and request ID return the original result. Customer creation, its audit record and the stored retry response commit in one transaction.

The native database helper manages an isolated development cluster under `.local/`. Existing PostgreSQL servers and Docker are alternative deployment options. The former Python source, test suite, requirements and entry points have been removed. External SQLite files are not read or migrated. Historical commercial feature documents are planning references and do not describe implemented Electron features.

## Next delivery stages

1. Agree workflow states, accounting postings, permission matrix, country, stock costing and legacy-data migration requirements.
2. Extend identity with MFA, granular roles, administrative account management and configurable approval rules.
3. Implement supplier and item masters, then purchase requests and independent approvals as the next complete workflow.
4. Build finance and inventory invariants, purchase orders, receiving, matching, payments and reconciliation.
5. Validate security, concurrency, accessibility, load, backup/recovery, migration and financial acceptance before production.

The first tax jurisdiction remains undecided. The current customer workflow does not implement tax, payroll or accounting.

## Security and privacy

The architecture follows [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security/) for sandboxing, context isolation, limited IPC and navigation restrictions. HTTPS is required for remote client connections; localhost HTTP is permitted for development.

GDPR compliance also requires organisational and legal decisions about purposes, lawful bases, retention, controller/processor obligations and data-subject requests. Identify personal fields and implement access, export, restriction/erasure, retention, backup handling and incident procedures before real personal-data processing. Encryption and key management need deployment validation. See [European Commission guidance on privacy by design](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en).
