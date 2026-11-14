import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Pool } from 'pg';
import { z } from 'zod';
import { projectRoot, settings } from '../config';
import { migrate } from './migrate';

function run(binary: string, args: string[]) {
  const result = spawnSync(binary, args, { cwd: projectRoot, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  if (result.status !== 0) throw new Error(`${binary.split(/[\\/]/).pop()} failed. ${result.stderr || result.stdout || result.error?.message || ''}`);
  if (result.stdout) console.log(result.stdout.trim());
}

function pgBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  if (process.platform === 'win32') {
    const root = join(process.env.ProgramFiles || 'C:/Program Files', 'PostgreSQL');
    if (existsSync(root)) {
      const versions = readdirSync(root).sort((a, b) => Number(b) - Number(a));
      const found = versions.map(version => join(root, version, 'bin')).find(path => existsSync(join(path, 'initdb.exe')));
      if (found) return found;
    }
  }
  return ''; // Unix installations may expose binaries through PATH; PG_BIN overrides this.
}

async function nativeDatabase(action: 'setup' | 'start' | 'stop') {
  const url = new URL(settings().databaseUrl);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Native database helpers only manage a loopback development database. Use db:migrate for an existing server.');
  const bin = pgBin();
  const executable = (name: string) => bin ? join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name;
  const data = resolve(projectRoot, '.local/postgres');
  const passwordFile = resolve(projectRoot, '.local/initdb-password');
  mkdirSync(resolve(projectRoot, '.local'), { recursive: true });
  if (!existsSync(join(data, 'PG_VERSION'))) {
    if (action !== 'setup') throw new Error('Local cluster does not exist. Run npm run setup first.');
    if (!url.password) throw new Error('Set a database password in DATABASE_URL.');
    writeFileSync(passwordFile, decodeURIComponent(url.password), { mode: 0o600, flag: 'wx' });
    try {
      run(executable('initdb'), ['-D', data, '-U', decodeURIComponent(url.username), '--pwfile', passwordFile, '-A', 'scram-sha-256', '--encoding=UTF8', '--locale=C']);
    } finally { unlinkSync(passwordFile); }
  }
  // A different Windows security token may not be able to inspect the server PID.
  // Verify the live database and its data directory before attempting another start.
  const probeUrl = new URL(url);
  probeUrl.pathname = '/postgres';
  const probe = new Pool({ connectionString: probeUrl.toString(), connectionTimeoutMillis: 1500 });
  let connectedDirectory: string | undefined;
  try { connectedDirectory = (await probe.query('SHOW data_directory')).rows[0].data_directory; }
  catch { /* A stopped instance is expected during first setup. */ }
  finally { await probe.end(); }
  if (connectedDirectory) {
    const normalized = (value: string) => resolve(value).replaceAll('\\', '/').toLowerCase();
    if (normalized(connectedDirectory) !== normalized(data)) throw new Error('Another PostgreSQL cluster is using this address. Choose a separate port or use db:migrate for the existing server.');
    if (action !== 'stop') { console.log('The local database is already running.'); return; }
  }
  const running = spawnSync(executable('pg_ctl'), ['-D', data, 'status'], { windowsHide: true, encoding: 'utf8' });
  if (action === 'stop') {
    if (connectedDirectory || running.status === 0) run(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']);
    else console.log('The local database is already stopped.');
    return;
  }
  if (running.status !== 0) {
    const port = Number(url.port || 5432);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PostgreSQL port.');
    run(executable('pg_ctl'), ['-D', data, '-l', resolve(projectRoot, '.local/postgres.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start']);
  } else console.log('The local database is already running.');
}

async function createDatabase() {
  const url = new URL(settings().databaseUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(database)) throw new Error('The development database name must use letters, numbers and underscores.');
  url.pathname = '/postgres';
  const pool = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  try {
    const found = await pool.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
    if (!found.rowCount) await pool.query(`CREATE DATABASE "${database}"`);
  } finally { await pool.end(); }
}

async function createUser(pool: Pool, bootstrap: boolean) {
  const email = z.email().max(254).parse(bootstrap ? process.env.BOOTSTRAP_ADMIN_EMAIL : process.env.NEW_USER_EMAIL).toLowerCase();
  const password = bootstrap ? process.env.BOOTSTRAP_ADMIN_PASSWORD : process.env.NEW_USER_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('User password must contain at least 12 characters and at most 72 UTF-8 bytes.');
  const role = bootstrap ? 'admin' : z.enum(['admin', 'reader']).parse(process.env.NEW_USER_ROLE || 'reader');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query('INSERT INTO erp_users(id,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id', [randomUUID(), email, await hash(password, 12), role]);
    if (inserted.rowCount) {
      await client.query("INSERT INTO erp_audit_events(actor_id,action,entity_type,entity_id,changes) VALUES($1,'bootstrap','user',$2,$3)", [inserted.rows[0].id, inserted.rows[0].id, JSON.stringify({ email, role })]);
    }
    await client.query('COMMIT');
    console.log(inserted.rowCount ? 'Account created. Use its configured credentials to sign in.' : 'Account already exists; its password and role were left unchanged.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function main() {
  const command = process.argv[2];
  if (['setup', 'start', 'stop'].includes(command)) {
    await nativeDatabase(command as 'setup' | 'start' | 'stop');
    if (command !== 'setup') return;
    await createDatabase();
  }
  if (command === 'docker') {
    const url = new URL(settings().databaseUrl);
    if (!['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('Docker development helper requires a loopback DATABASE_URL.');
    process.env.ERP_COMPOSE_USER = decodeURIComponent(url.username);
    process.env.ERP_COMPOSE_PASSWORD = decodeURIComponent(url.password);
    process.env.ERP_COMPOSE_DB = decodeURIComponent(url.pathname.slice(1));
    process.env.ERP_COMPOSE_PORT = url.port || '55432';
    run('docker', ['compose', '-f', 'infra/compose.yaml', 'up', '-d', '--wait']);
    return;
  }
  const pool = new Pool({ connectionString: settings().databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    if (command === 'check') {
      const result = await pool.query('SELECT current_database() AS database, version()');
      console.log(`Connected to ${result.rows[0].database}. ${result.rows[0].version.split(',')[0]}`);
    } else if (command === 'setup' || command === 'migrate') {
      await migrate(pool);
      console.log('Database schema is up to date.');
      if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) await createUser(pool, true);
      else console.log('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD, then run db:migrate to create the first account.');
    } else if (command === 'create-user') await createUser(pool, false);
    else throw new Error('Unknown database command.');
  } finally { await pool.end(); }
}
main().catch(error => {
  const code = (error as { code?: string }).code;
  console.error(code ? `Database operation failed (${code}). Check PostgreSQL and the root .env file.` : error instanceof Error ? error.message : 'Database setup failed.');
  process.exitCode = 1;
});
