# Encrypted backup and recovery

These commands run on the server/operator machine. They do not install PostgreSQL tools, a scheduler, a Windows service or off-site storage. Use PostgreSQL `pg_dump`/`pg_restore` from the same server major version (or a tested compatible newer client). On Windows the tools discover `C:\Program Files\PostgreSQL\<version>\bin`; set `PG_BIN` for another location. For a Docker-hosted local database, set `PG_CONTAINER` to its container name; the tools run through `docker exec -i`. In that mode DATABASE_URL must resolve to the database **inside** the container (the test CI uses loopback:5432). No credentials are put in child-process command-line arguments.

## Prepare the key

```powershell
npm run build:server
npm run backup:key
$env:ERP_BACKUP_KEY_FILE = (Resolve-Path secrets/backup-key).Path
```

The key command creates a new random 256-bit hex key without printing it and refuses to overwrite an existing key. POSIX file mode is restricted; **on Windows, configure NTFS ACLs** so only the backup service identity and authorised recovery custodians can read it. Do the same for archive directories and server secrets. Escrow the backup key separately from the archives and test custodian access. Do not commit or distribute keys. `ERP_BACKUP_KEY` can also be injected by a secret manager; prefer a secured key file to command-line literals. This key is independent of `MFA_ENCRYPTION_KEY`.

## Take and verify a backup

```powershell
npm run db:backup
# Or choose a new destination file in an existing protected directory:
npm run db:backup -- D:\ERPBackups\release-2026-11-15.erpbak
```

Default output is `.local/backups/<unique-name>.erpbak` plus `<archive>.json`. Both files must be copied together. File creation is exclusive; existing files are never overwritten. Failed backups may leave an incomplete encrypted file with no valid manifest: do not treat its presence as success.

The tool exports a repeatable-read snapshot and uses that same snapshot for `pg_dump` and all ERP row counts. It streams a custom archive through AES-256-GCM directly to disk, with a random nonce and an authenticated format header. The manifest contains versions, counts, creation time, server version, size and SHA-256, authenticated using HMAC-SHA-256. It contains no credentials, but its metadata is still restricted. Neither logical dump nor decrypted archive is written as a plaintext temporary file. Protect transport using verified TLS for remote PostgreSQL, encrypted volumes, ACLs and encrypted off-host storage. Backups include password hashes, encrypted MFA data, contacts and financial history; encryption does not make them anonymous.

Preserve the matching application release, installer, configuration, TLS/service configuration and **MFA encryption key** through a separate protected backup process. Logical database archives do not contain server roles/passwords, PostgreSQL cluster configuration, certificates or those external secrets. Without the correct MFA key, restored authenticator secrets cannot be decrypted. Without the backup key, these archives cannot be recovered. Rotation means creating a new key/file, recording which archive uses which key and retaining required older keys until their archives expire.

## Restore rehearsal

```powershell
$env:ERP_BACKUP_KEY_FILE = 'D:\ProtectedKeys\erp-backup-key'
npm run db:restore -- D:\ERPBackups\release-2026-11-15.erpbak erp_restore_rehearsal
```

The target must be a new database named `erp_restore_<letters/numbers/underscores>`. Existing targets and the configured ERP database cannot be overwritten. The operator connection needs CREATE DATABASE. Hash, HMAC and the entire GCM authentication tag are checked **before** target creation or SQL execution. Restore uses one transaction, no archived owners or ACLs. Only restore archives created by a trusted operator with controlled keys; these are database programs, not untrusted uploads.

After restore, the tool compares all captured public `erp_*` row counts and schema versions, validates migration checksums where present, checks posted-journal balance, AP/AR/GRNI, stock projections and inventory-to-GL totals. It then deletes restored bearer sessions and pending MFA challenges and records `recovery.restored`. Row counts intentionally change after this session revocation/audit event. MFA enrollment/recovery codes and user access otherwise remain restored from the snapshot.

Any failure returns a nonzero status. If the target was created before the failure, it remains quarantined for DBA inspection; the tool never silently deletes a database. Successful verification does not publish the target or start the API. Inspect representative orders, posted invoices, attachments if later introduced, audit/history and period controls with the matching release in an isolated environment. Record duration and verify recovery objectives. For old archives, use their matching release first; use migration dry runs on a recovered copy for upgrades.

`npm run test:recovery` performs a real dump/restore with synthetic data in disposable databases and removes them afterward. It tests wrong keys, corruption, row counts, restored-session revocation and refusal to overwrite. It leaves synthetic encrypted test archives in ignored `.local/recovery/` with a deliberately unpersisted test key; these are not operational backups.

## Incident cutover

1. Stop and fence the old API, scheduled jobs and all writers. Confirm the approved recovery point and potential lost transactions with the incident owner.
2. Restore into a new quarantined database. Do not run two writable API instances against old and restored copies. Review and reapply privacy restrictions/minimisations completed **after the backup**, using the separately secured case/deletion register, before reopening access.
3. Recreate the restricted runtime role's grants on the restored database using the DBA's approved provisioning procedure. Use the matching application and MFA key. Update DATABASE_URL securely to the new database. Keep the old database fenced for investigation.
4. Start the API in controlled access, verify readiness/MFA/role denials and reconcile source documents, stock, trial balance, AP/AR/GRNI and bank statements. Compare external bank confirmations before re-entering payments; do not record an already confirmed transfer twice.
5. Reopen access after approval, record cutover and archive hash, take a fresh backup and monitor. Decommission failed/old copies only under an approved retention and incident evidence decision.

No automated destructive live restore or automatic rollback is provided.

## Planned module recovery coverage

Reviewed 17 November 2026. The [module roadmap](ERP_MODULE_ROADMAP.md) adds potential CRM/employee/campaign records, delivery checkpoints and protected attachments. Before shipping them, verify the backup table/source allowlists, schema compatibility, new control reconciliations and retention scope. Current database archive tooling does not establish backup of a future external file store, provider state or scheduler configuration; document and rehearse coordinated coverage and key custody if selected.

An isolated module restore must verify party/source links, reservations versus on-hand stock, dispatch/COGS/AR corrections, employee payables and protected access/exports as applicable. Extend the independent restriction register to contacts/employees and Marketing suppressions. Keep outbound jobs paused until post-backup restrictions/suppressions are replayed and delivery outcomes are reconciled against provider evidence; a restored pending message must not be blindly resent. Retain the current new-database cutover and session-revocation procedure. No recovery command or existing archive format changes in this planning revision.
