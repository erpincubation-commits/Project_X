# Changelog

## Unreleased - Operational readiness

- Added create-only master import dry runs with normalized row validation, expiring actor-bound previews, atomic commits, history and retry protection.
- Added administrator privacy cases with original receipt dates, due dates, identity references, subject-wide legal holds, scoped access extracts, restriction and limited current-data minimisation with explicit historical retention.
- Added schema 7, migration status, checksums/gap checks and transactional dry runs.
- Added authenticated AES-GCM encrypted snapshot backups and safe new-target restore with financial/schema/count verification and session revocation.
- Added transient-data cleanup previews, security/configuration and dependency commands, axe/keyboard accessibility verification, a disposable synthetic load harness, CI gates and operational/recovery runbooks.
- Updated the installer dependency graph to patched minimatch 11 for affected 7?10 consumers, with older API consumers preserved.
- Improved footer contrast, visible keyboard focus and skip-to-main navigation.


## Unreleased - Orders, AP/AR, settlements and financial statements

- Added approved-request orders and partial/damaged receiving with atomic stock and GRNI posting.
- Added three-way invoice matching and independently approved price exceptions.
- Added payment reservations, rejection/revision, two independent approvals and confirmed transfer recording.
- Added customer invoices, partial collections, AP/AR ageing and control reconciliation.
- Added configured tax rates, income/balance/cash-flow statements and tax summaries.
- Extended bank reconciliation with outstanding items and chronological finalisation.
- Added migration 6, schema-5 upgrade checks, source immutability and cross-role desktop verification.

## Unreleased - Accounting and inventory foundation

- Added one-time INR books setup, chart of accounts, non-overlapping periods and controlled close/reopen.
- Added balanced journals, immutable postings and linked manual reversals.
- Added warehouses, opening/adjustment/consumption/transfer/count movements and moving weighted average with negative stock blocked.
- Added atomic stock-to-ledger posting, valuation/projection reconciliation, trial balance and bank statement matching/finalisation.
- Added accountant/inventory manager roles, migration 5, versions, retry protection, audit/history and desktop/API workflows.
- Defined receiving, invoice and payment postings before implementing those later workflows; see ACCOUNTING_POSTINGS.md.

## Unreleased — Supplier/item masters and purchase requests

- Added versioned supplier and item registers with validation, active-state management and protected contact fields.
- Added request drafts, submission to an independent approver, approval/rejection with reasons and revision of rejected requests.
- Added scoped purchasing roles, exact decimal estimates, immutable record snapshots and atomic audit/retry records.
- Added schema migration 4 and API concurrency/rollback coverage; expanded Electron verification through independent rejection, revision and approval.

## Unreleased — Administrator setup and MFA

- Added protected first-run administrator setup and mandatory authenticator enrolment before a session is issued.
- Added encrypted TOTP seeds, replay protection, expiring challenges, hashed single-use recovery codes and account-level attempt limits.
- Added fixed server permissions for administrator, reader, identity administrator and auditor roles; desktop account management, session revocation and audit viewing.
- Added schema migration 3, preserving users/customers and invalidating old sessions; setup generates persistent authentication keys without changing existing database credentials.
- Added RFC-vector/crypto, API and two-client Electron coverage. Database integration/desktop tests run in disposable databases.

## 0.2.0 - Electron and shared server

- Replaced the desktop runtime and build system with npm workspaces and TypeScript.
- Added a React/Electron client, NestJS API and shared PostgreSQL customer register.
- Added sign-in, administrator/read-only roles, expiring sessions, audit records and idempotent customer creation.
- Added native PostgreSQL setup, a Docker alternative, database migrations and Windows launch scripts.
- Removed the retired Python source, tests, requirements and protected launcher. External data files were not migrated or changed.
- Moved historical feature inventories into docs/archive; they do not describe the new implementation.
