# SMB ERP

A Windows-first Electron desktop application, React interface, NestJS server and shared PostgreSQL database. The implemented workflow is sign in, create a customer, and view that customer from another client. Administrator and read-only roles are enforced by the server.

## Quick start on Windows

Prerequisites: Node.js 22.12+ and PostgreSQL. Native binaries are detected under `C:/Program Files/PostgreSQL`; set `PG_BIN` when installed elsewhere. See [database setup](docs/POSTGRES_SETUP.md) for Docker and existing-server alternatives.

Run from the repository root in a normal PowerShell terminal:

```powershell
npm ci
npm run setup
npm start
```

`setup` creates an ignored root `.env` with random passwords, initializes an isolated cluster under `.local/postgres`, starts it on `127.0.0.1:55432`, applies migrations and creates an administrator. It preserves an existing `.env`. Open `.env` and use `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` to sign in. Do not share or commit this file.

`npm start` builds both applications, starts the server, waits for readiness and opens Electron. Click **Connect**, sign in, and save a customer. Run `npm run desktop` in another terminal to verify shared records in a second desktop client. Closing the app stops the server started by `npm start`; PostgreSQL remains running. Later launches may need `npm run db:start` after a reboot.

Double-click alternatives: `scripts/Setup.cmd` for first-time setup; `scripts/Start_Desktop.cmd` for normal use.

## Repository layout

```text
apps/
  desktop/
    src/main/         Electron main process, API client and preload bridge
    src/renderer/     React screens and styles
    package.json      Desktop build and Windows packaging configuration
  server/
    src/auth/         Login, sessions and authentication guard
    src/customers/    Customer controller and transactional persistence
    src/database/     PostgreSQL pool, migrations and administration CLI
    src/common/       Validation and structured error responses
    test/             Contract and PostgreSQL integration tests
packages/contracts/   Shared API types and input schemas
infra/                Optional Docker PostgreSQL configuration
tools/                Setup, combined launcher and Electron workflow test
scripts/              Windows launch shortcuts
docs/                 Database, deployment and architecture documentation
package.json          npm workspaces and root commands
```

The application no longer contains a Python runtime, Python source or Python build configuration. External SQLite databases are untouched; there is no automatic data migration.

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Compile contracts, server and desktop |
| `npm run server` | Run the built server independently |
| `npm run desktop` | Open another desktop client |
| `npm run db:check` | Check PostgreSQL connectivity |
| `npm run db:migrate` | Apply migrations and bootstrap the configured administrator |
| `npm run db:stop` | Stop the isolated native development database |
| `npm test` | Validate input contracts |
| `npm run test:integration` | Test authentication, permissions, shared data, retries and audit against PostgreSQL |
| `npm run test:desktop` | Exercise two real Electron clients against an isolated test schema |
| `npm run package:windows` | Build a Windows NSIS installer under `release/` |

Database tests create and remove their own temporary schemas. The database account must be permitted to create schemas. Desktop tests use profiles under `.local/` and produce `.local/desktop-workflow.png`.

## Current scope

This is a development foundation with a working customer workflow. Purchasing, accounting, inventory, MFA, configurable permissions, personal-data management, backup automation and production operations remain future work. No claim of GDPR compliance or production readiness is made. See [architecture](docs/DESKTOP_MIGRATION.md) and [deployment](docs/DEPLOYMENT.md).
