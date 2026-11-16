import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
require('../apps/server/dist/config.js');
const { Pool } = require('pg');
const mode = process.argv[2];
if (!['api', 'desktop', 'accessibility'].includes(mode)) throw new Error('Choose api, desktop or accessibility tests.');
const configured = process.env.DATABASE_URL;
if (!configured) throw new Error('Configure a development PostgreSQL connection first.');
const name = `erp_test_${randomUUID().replaceAll('-', '')}`;
if (!/^erp_test_[a-f0-9]{32}$/.test(name)) throw new Error('Invalid test database name.');
const owner = new Pool({ connectionString: configured, connectionTimeoutMillis: 5000 });
let created = false;
try {
  await owner.query(`CREATE DATABASE "${name}"`); created = true;
  const url = new URL(configured); url.pathname = '/' + name;
  const args = mode === 'api'
    ? ['--test', ...(await readdir(new URL('../apps/server/test/', import.meta.url))).filter(file => file.endsWith('.integration.cjs')).map(file => `apps/server/test/${file}`)]
    : ['tools/desktop-smoke.mjs'];
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, DATABASE_URL: url.toString(), ERP_ACCESSIBILITY_ONLY: mode==='accessibility'?'1':'0' }, stdio: 'inherit', windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', value => resolve(value ?? 1)); });
  process.exitCode = code;
} catch (error) {
  console.error('Isolated tests could not complete. Check PostgreSQL and the development account CREATE DATABASE permission. No production schema is used.');
  const code = error?.code;
  if (typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)) console.error(`Database error code: ${code}`);
  process.exitCode = 1;
} finally {
  if (created) {
    try { await owner.query(`DROP DATABASE "${name}" WITH (FORCE)`); }
    catch { console.error(`Could not remove disposable database ${name}. Ask the database administrator to inspect it.`); process.exitCode = 1; }
  }
  await owner.end();
}
