import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) {
  console.log('Keeping the existing root .env configuration.');
} else {
  const databasePassword = randomBytes(24).toString('base64url');
  const adminPassword = randomBytes(18).toString('base64url');
  writeFileSync(envFile, `# Local development only; never commit this file.\nDATABASE_URL=postgresql://erp_dev:${databasePassword}@127.0.0.1:55432/erp_dev\nSERVER_HOST=127.0.0.1\nSERVER_PORT=3001\nBOOTSTRAP_ADMIN_EMAIL=admin@local.test\nBOOTSTRAP_ADMIN_PASSWORD=${adminPassword}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with random database and administrator passwords. Read BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD there to sign in.');
}
