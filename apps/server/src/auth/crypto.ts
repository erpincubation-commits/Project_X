import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function equalSecret(left: string, right: string) { return timingSafeEqual(Buffer.from(digest(left), 'hex'), Buffer.from(digest(right), 'hex')); }
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Buffer) {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function fromBase32(secret: string) {
  let bits = 0, value = 0; const output: number[] = [];
  for (const char of secret) { const index = alphabet.indexOf(char); if (index < 0) throw new Error('Invalid MFA secret'); value = (value << 5) | index; bits += 5; if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(output);
}
// RFC 6238 / HOTP dynamic truncation, SHA-1, 30-second steps, six digits.
export function totp(secret: string, step = Math.floor(Date.now() / 30000), digits = 6) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', fromBase32(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString().padStart(digits, '0');
}
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) if (step >= 0 && (lastStep === null || step > lastStep) && equalSecret(totp(secret, step), code)) return step;
  return null;
}
function encryptionKey() {
  const key = process.env.MFA_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error('MFA_ENCRYPTION_KEY must be a persistent 32-byte hex key. Run npm run auth:configure.');
  return Buffer.from(key, 'hex');
}
export function validateAuthConfiguration() { encryptionKey(); }
export function encryptSecret(secret: string, owner: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(owner));
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('hex')).join('.');
}
export function decryptSecret(value: string, owner: string) {
  const [iv, tag, data] = value.split('.').map(part => Buffer.from(part, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv); decipher.setAAD(Buffer.from(owner)); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
