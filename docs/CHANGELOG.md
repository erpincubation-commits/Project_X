# Changelog

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
