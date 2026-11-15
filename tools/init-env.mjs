import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) {
  console.log('Keeping the existing root .env configuration.');
} else {
  const databasePassword = randomBytes(24).toString('base64url');
  writeFileSync(envFile, `# Local development only; never commit this file.\nDATABASE_URL=postgresql://erp_dev:${databasePassword}@127.0.0.1:5432/erp_dev\nSERVER_HOST=127.0.0.1\nSERVER_PORT=3001\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created the local server configuration.');
}
let existing = readFileSync(envFile, 'utf8');
for (const name of ['MFA_ENCRYPTION_KEY', 'ADMIN_SETUP_TOKEN']) {
  const placeholder = new RegExp(`^${name}=REPLACE_WITH_64_RANDOM_HEX_CHARACTERS\\s*$`, 'm');
  if (placeholder.test(existing)) existing = existing.replace(placeholder, `${name}=${randomBytes(32).toString('hex')}`);
}
if (existing !== readFileSync(envFile, 'utf8')) writeFileSync(envFile, existing, { mode: 0o600 });
const additions = ['MFA_ENCRYPTION_KEY', 'ADMIN_SETUP_TOKEN'].filter(name => !new RegExp(`^\\s*${name}\\s*=`, 'm').test(existing));
if (additions.length) {
  appendFileSync(envFile, '\n# Server authentication secrets: back up securely; never commit or share.\n' + additions.map(name => `${name}=${randomBytes(32).toString('hex')}`).join('\n') + '\n', { mode: 0o600 });
  console.log('Added missing authentication keys. Read ADMIN_SETUP_TOKEN privately from .env for first-run setup. Existing values were preserved.');
}
