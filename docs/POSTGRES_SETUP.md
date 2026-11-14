# PostgreSQL development setup

## Native Windows installation

Install PostgreSQL if it is absent. PostgreSQL 18 binaries were detected on this computer under `C:/Program Files/PostgreSQL/18/bin`. The helper uses these binaries to run a separate development cluster, without changing the installed Windows PostgreSQL service or its databases.

```powershell
npm ci
npm run setup
npm run db:check
```

Run in a normal PowerShell terminal under your own Windows account. Windows restricted execution accounts may fail to start `pg_ctl` with a restricted-token error. Keep cluster ownership consistent: use the same Windows account for initialization, startup and shutdown. Set `PG_BIN` in `.env` if auto-detection chooses the wrong installation. The cluster version and binaries must match; upgrades require a tested PostgreSQL upgrade or dump/restore procedure.

The generated root `.env` contains a PostgreSQL connection URL, server port and bootstrap administrator credentials. It is ignored by Git and must be protected. The development cluster is `.local/postgres`, logs are `.local/postgres.log`, and the default port is 55432 on loopback. The database user is a development superuser because initdb creates it as the cluster owner; use separate migration and restricted runtime roles in production.

```powershell
npm run db:start
npm run db:check
npm run db:migrate
npm run db:stop
```

Changing `DATABASE_URL` does not change a password already stored by PostgreSQL. Password rotation must update PostgreSQL and configuration together. Keep `.local/` outside Git. Never delete the data directory to fix a connection problem.

## Existing PostgreSQL server

Configure `DATABASE_URL` in the root `.env` with a database and account provisioned by your administrator. Percent-encode special characters in connection URI credentials. Then run:

```powershell
npm run build:server
npm run db:check
npm run db:migrate
```

Do not run the native setup command against an existing remote deployment. Migrations need schema creation permissions. If both bootstrap administrator values are set, migration creates that account only if its email is absent; it never changes an existing password or role.

## Docker alternative

Start Docker Desktop in Linux-container mode. Use the same root `.env`, then:

```powershell
node tools/init-env.mjs
npm run build:server
npm run db:docker
npm run db:migrate
```

Use either Docker or the native cluster on port 55432. The helper derives Docker credentials from `DATABASE_URL` and runs `infra/compose.yaml`. Data persists in the named Docker volume. Stop it with `docker compose -f infra/compose.yaml stop`; do not use `down -v` unless intentionally destroying disposable data. If Docker needs environment values for that command, `docker stop` using the container name shown by `docker ps` also preserves data.

## Additional users

The administrator bootstrap credentials are in `.env`. To create another account, set environment variables in a PowerShell session, run the command, then clear them:

```powershell
$env:NEW_USER_EMAIL = 'viewer@company.test'
$env:NEW_USER_ROLE = 'reader'
$securePassword = Read-Host 'New account password (12+ characters)' -AsSecureString
$env:NEW_USER_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
npm run db:create-user
Remove-Item Env:NEW_USER_EMAIL, Env:NEW_USER_ROLE, Env:NEW_USER_PASSWORD
```

Allowed roles are `admin` and `reader`. Runtime role management and password changes still need implementation. Account provisioning requires database administrator access. Bootstrap passwords can be removed from `.env` after creating accounts; existing accounts remain valid.

## Verification

Run `npm test`, `npm run test:integration` and `npm run test:desktop`. The latter two use temporary test schemas and clean them up. No existing customer rows are changed. An interrupted test may leave an `erp_test_...` schema for an administrator to inspect and remove.
