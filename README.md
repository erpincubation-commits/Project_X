# SMB ERP

A Windows-first Electron desktop application, React interface, NestJS server and shared PostgreSQL database. Implemented workflows include shared customers, supplier/item masters and purchase requests with independent approval or rejection. Permissions, versions, history and retries are enforced by the server.

## Quick start on Windows

Prerequisites: Node.js 22.12+ and PostgreSQL. Native binaries are detected under `C:/Program Files/PostgreSQL`; set `PG_BIN` when installed elsewhere. See [database setup](docs/POSTGRES_SETUP.md) for Docker and existing-server alternatives.

Run from the repository root in a normal PowerShell terminal:

```powershell
npm ci
npm run setup
npm start
```

`setup` creates an ignored root `.env` with random database credentials and authentication keys, initializes an isolated cluster under `.local/postgres`, starts it on `127.0.0.1:5432` and applies migrations. Existing values are preserved. On an empty database, connect in the desktop and use the private `ADMIN_SETUP_TOKEN` from `.env` to create the administrator, enrol an authenticator and save the recovery codes. Existing accounts retain their passwords and enrol MFA at their next sign-in. See [authentication setup and upgrades](docs/AUTHENTICATION.md). Do not share or commit `.env`.

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
    src/procurement/  Supplier/item masters and versioned purchase request workflow
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
| `npm run dev` | Run NestJS watchers, Vite and Electron for development |
| `npm run dev:server` / `npm run dev:desktop` | Run either development application independently |
| `npm run build` | Compile contracts, server and desktop |
| `npm run server` | Run the built server independently |
| `npm run desktop` | Open another desktop client |
| `npm run db:check` | Check PostgreSQL connectivity |
| `npm run auth:configure` | Add missing persistent authentication keys to the server configuration |
| `npm run db:migrate` | Apply migrations; optional legacy bootstrap only on an empty database |
| `npm run db:stop` | Stop the isolated native development database |
| `npm test` | Test contracts, logging and authentication cryptography |
| `npm run test:integration` | Test authentication, permissions, shared data, retries and audit against PostgreSQL |
| `npm run test:desktop` | Exercise two real Electron clients against an isolated test schema |
| `npm run package:windows` | Build a Windows NSIS installer under `release/` |
| `npm run test:packaged` | Launch and check the unpacked Windows desktop |

Integration and desktop test runners create and remove a disposable database, then use temporary schemas inside it. The development database account needs `CREATE DATABASE`; never use production credentials. Desktop tests use profiles under `.local/` and produce `.local/desktop-workflow.png`.

See [development and logs](docs/DEVELOPMENT.md) for live reload, error references and log locations, and [Windows installers](docs/WINDOWS_INSTALLER.md) for packaging, CI artifacts and signing.

## Current scope

This is a development foundation with a working customer workflow, initial administrator setup, mandatory TOTP MFA, recovery codes, session revocation, server-enforced permissions and user/audit screens. Supplier/item masters and purchase request creation, submission, independent approval/rejection, revisions and history are implemented; see [purchasing setup](docs/PROCUREMENT.md). INR accounts, accounting periods, balanced journals, warehouses, weighted average stock, stock/ledger reconciliation and bank matching are implemented; see [accounting and inventory setup](docs/ACCOUNTING_INVENTORY.md) and [posting rules](docs/ACCOUNTING_POSTINGS.md). Purchase orders, partial/damaged receipts, supplier invoice matching and exception resolution, two-person payment approvals, AP/AR, configured tax, bank outstanding items and financial statements are implemented; see [trade workflows](docs/TRADE_WORKFLOWS.md). Statutory tax filing, credit notes/refunds, configurable approval policies, personal-data management, backup automation and production operations remain future work. No claim of GDPR compliance or production readiness is made. See [architecture](docs/DESKTOP_MIGRATION.md) and [deployment](docs/DEPLOYMENT.md).

## Operations and verification

Schema 7 adds **Operations & privacy** in the desktop: reviewed JSON master imports and administrator privacy cases. See [imports/privacy](docs/IMPORTS_AND_PRIVACY.md), [encrypted backup/restore](docs/BACKUP_RESTORE.md), [verification commands](docs/VERIFICATION.md) and the [operations/release runbook](docs/OPERATIONS_RUNBOOK.md).

After stopping the API and taking a verified backup, build, inspect `npm run db:status`, rehearse `npm run db:dry-run`, then apply `npm run db:migrate` and restart the matching server/client. No live database upgrade is performed by the tests.
