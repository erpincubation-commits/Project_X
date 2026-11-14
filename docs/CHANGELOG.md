# Changelog

## 0.2.0 - Electron and shared server

- Replaced the desktop runtime and build system with npm workspaces and TypeScript.
- Added a React/Electron client, NestJS API and shared PostgreSQL customer register.
- Added sign-in, administrator/read-only roles, expiring sessions, audit records and idempotent customer creation.
- Added native PostgreSQL setup, a Docker alternative, database migrations and Windows launch scripts.
- Removed the retired Python source, tests, requirements and protected launcher. External data files were not migrated or changed.
- Moved historical feature inventories into docs/archive; they do not describe the new implementation.
