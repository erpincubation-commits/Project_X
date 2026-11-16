import { config } from 'dotenv';
import { resolve } from 'node:path';

export const projectRoot = resolve(__dirname, '../../..');
config({ path: resolve(projectRoot, '.env'), quiet: true });

export function settings() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is missing. Run npm run setup or configure the root .env file.');
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL URL.');
  const port = Number(process.env.SERVER_PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SERVER_PORT must be between 1 and 65535.');
  const host = process.env.SERVER_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && process.env.TLS_PROXY_CONFIRMED !== 'true') {
    throw new Error('Remote listening requires TLS_PROXY_CONFIRMED=true and a configured HTTPS reverse proxy. See docs/DEPLOYMENT.md.');
  }
  return { databaseUrl, port, host };
}
