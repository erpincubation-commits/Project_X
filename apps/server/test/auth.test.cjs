const { test } = require('node:test');
const assert = require('node:assert/strict');
const { base32, totp, verifyTotp, encryptSecret, decryptSecret } = require('../dist/auth/crypto.js');
const { setupInput, createUserInput } = require('@erp/contracts');

test('TOTP matches all RFC 6238 SHA-1 test vectors and refuses reuse', () => {
  const secret = base32(Buffer.from('12345678901234567890'));
  for (const [time, expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']]) assert.equal(totp(secret, Math.floor(time / 30), 8), expected);
  const time = 1234567890000, step = Math.floor(time / 30000), code = totp(secret, step);
  assert.equal(verifyTotp(secret, code, null, time), step);
  assert.equal(verifyTotp(secret, code, step, time), null);
  assert.equal(verifyTotp(secret, 'abcdef', null, time), null);
  assert.equal(verifyTotp(secret, totp(secret, step - 3), null, time), null);
});
test('MFA encryption authenticates ciphertext and account identity', () => {
  process.env.MFA_ENCRYPTION_KEY = '2'.repeat(64);
  const encrypted = encryptSecret('private-seed', 'user-a');
  assert.equal(decryptSecret(encrypted, 'user-a'), 'private-seed');
  assert.ok(!encrypted.includes('private-seed'));
  assert.throws(() => decryptSecret(encrypted, 'user-b'));
  const parts = encrypted.split('.'); parts[1] = '0'.repeat(32);
  assert.throws(() => decryptSecret(parts.join('.'), 'user-a'));
});
test('new account contracts reject weak, truncated and elevated input', () => {
  const input = { email: 'admin@example.test', password: 'a-strong-password', setupToken: 'a'.repeat(64) };
  assert.equal(setupInput.safeParse(input).success, true);
  assert.equal(setupInput.safeParse({ ...input, password: 'short' }).success, false);
  assert.equal(setupInput.safeParse({ ...input, password: '😀'.repeat(20) }).success, false);
  assert.equal(setupInput.safeParse({ ...input, role: 'admin' }).success, false);
  assert.equal(createUserInput.safeParse({ email: input.email, password: input.password, role: 'superuser' }).success, false);
});
