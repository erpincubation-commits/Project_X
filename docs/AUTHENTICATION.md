# Authentication and administrator setup

## Upgrade an existing development installation

Stop the old application/server before migrating. Back up the database and server configuration using your approved procedure, then run from the repository root:

```powershell
npm ci
npm run auth:configure
npm run db:migrate
npm start
```

`auth:configure` adds missing `MFA_ENCRYPTION_KEY` and `ADMIN_SETUP_TOKEN` values to the ignored server `.env`; it preserves existing values and database credentials. Known placeholders from `.env.example` are replaced with generated values. Keep this configuration private and back up the MFA key securely. Changing or losing the key makes stored authenticator seeds unreadable; do not generate a replacement on a live deployment.

Migration 3 preserves accounts/customers, adds MFA/challenge/recovery data, expands the role constraint, allows unauthenticated audit actors, and invalidates existing sessions. The new server requires schema version 3. Upgrade client and server together: sign-in now requires a second factor. Do not run the older server against the upgraded database. This code change does not automatically migrate an existing installation.

## First administrator on a new database

1. Run database setup. The default configuration no longer creates a fixed administrator account.
2. Open the desktop and connect. If no accounts exist, it shows **Create initial administrator**.
3. The server operator privately supplies `ADMIN_SETUP_TOKEN` from the server configuration. Do not distribute this code with the installer or logs.
4. Enter the setup code, administrator email and a password of at least 12 characters and at most 72 UTF-8 bytes. Confirm the password.
5. Add the displayed secret to a TOTP authenticator as a time-based, six-digit account. Enter its current code within five minutes. Each unfinished enrolment starts with a new setup key: after returning to sign-in, add the newly displayed key and remove the older unfinished entry from your authenticator app.
6. Store the eight single-use recovery codes securely outside the desktop before dismissing them. They are displayed only once; the server stores hashes.

Setup is serialized and closes as soon as any user exists. If interrupted after account creation, sign in using that account's password to restart MFA enrolment. Existing installations sign in with their existing accounts and enrol MFA on the next login.

Legacy `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` remain an optional offline bootstrap path for an empty database. They never reset an existing account or create another bootstrap account after the first user exists. `db:create-user` remains an explicitly privileged database operator command. Do not use bootstrap as a password-reset mechanism.

## Login and recovery

Password verification returns a five-minute challenge, not a session. Every account must complete MFA before accessing protected routes. During enrolment, a secret is provided after the password is verified. Later sign-ins accept an authenticator code or unused recovery code. An accepted time step cannot be reused; wait for the next code if signing in again immediately. TOTP permits the current 30-second step and one adjacent step in each direction; keep clocks accurate.

A challenge permits five attempts. Account-level MFA throttling persists across new challenges and allows ten verification attempts per 15-minute window; password attempts are separately limited to ten per 15-minute window. If a code does not match, confirm the entry uses the latest setup key and that the authenticator device and server have automatically synchronised time. Codes and tokens are never recorded in diagnostic or audit data. Losing all authenticator and recovery material requires a separately authorised operator-assisted recovery process; there is no unauthenticated MFA-reset endpoint.

TOTP uses [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) with SHA-1, six digits and a 30-second step. Seeds are encrypted with AES-256-GCM and bound to the account ID. Passwords use bcrypt with cost 12 and an explicit 72-byte limit; existing valid hashes remain usable. Recovery codes contain 128 random bits and are hashed and consumed atomically. TOTP is not phishing-resistant; see the [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

## Sessions and implemented permissions

The server stores session-token hashes and enforces 30-minute idle and eight-hour absolute expiry. It loads the current account/role on each authenticated request. Disabled accounts, changed access or explicit revocation invalidate existing sessions and pending challenges. Desktop tokens and challenge tokens stay in main-process memory; only the temporary enrolment key and recovery codes are shown. The desktop checks sessions during activity/focus and signs out locally after 30 minutes without interaction. Offline sign-out cannot immediately contact the server.

| Role | Implemented permissions |
| --- | --- |
| `admin` | Read/create customers, provision/manage other users, read audit history. |
| `reader` | Read customers. |
| `identity_admin` | List users and create/enable/disable reader accounts; cannot assign privileged roles or change privileged accounts. |
| `auditor` | Read customers and audit history; no customer creation or account management. |

Use **Account security and access** for provisioning, role changes, enable/disable, audit viewing or **Sign out all my sessions**. Users cannot change their own access; the last active administrator cannot be demoted/disabled. Other business roles in the security specification remain future work. Permissions are fixed in a shared registry and enforced by server guards; client visibility is supplementary.

## API summary

| Route | Access / result |
| --- | --- |
| `GET /api/v1/auth/setup-status` | Public; indicates whether any account exists. |
| `POST /api/v1/auth/setup` | Setup token + new credentials; first account only; returns MFA challenge. |
| `POST /api/v1/auth/login` | Email/password; returns MFA challenge, never a session. |
| `POST /api/v1/auth/mfa/verify` | Challenge + authenticator/recovery code; returns session after successful verification. |
| `GET /api/v1/auth/me` | Authenticated; current user and permissions. |
| `POST /api/v1/auth/logout` | Authenticated; revokes current session. |
| `POST /api/v1/auth/revoke-sessions` | Authenticated; revokes all own sessions/challenges. |
| `GET/POST /api/v1/access/users` | `users.manage`; list/provision accounts. |
| `PATCH /api/v1/access/users/:id` | `users.manage`; authorised role/active change and session revocation. |
| `GET /api/v1/access/audit?page=1` | `audit.read`; 50 events per page, newest first. |

Authentication responses have `Cache-Control: no-store`. Challenges cannot authenticate protected API routes. User creation/access changes and successful authentication commit with their audit events. Failed password/MFA/setup attempts, throttling, permission denials, logout, session revocation and audit access are also recorded without credentials. Audit immutability remains bounded by database privileges: a database owner can bypass the trigger.

## Verification

`npm test` covers RFC vectors, replay protection, authenticated encryption, contracts and logging. `npm run test:integration` and `npm run test:desktop` create a disposable database before running isolated-schema tests and drop it afterward. The development account needs `CREATE DATABASE`; never use production credentials. Interrupted runs may require an administrator to inspect/remove their specifically named `erp_test_...` databases.

The desktop test exercises first-run setup, MFA enrolment for two accounts, provisioning, audit viewing and shared customer access. Automation may require the normal Windows account because restricted execution cannot launch Electron's sandboxed runtime. Keep sandboxing enabled; see [development permissions](DEVELOPMENT.md#windows-development-permissions).
