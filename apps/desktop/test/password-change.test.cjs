const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
const logs = [];
let fetchImpl;
Module._load = function(name, ...args) {
  if (name === 'electron') return { net: { fetch: (...args) => fetchImpl(...args) } };
  if (name === './logger') return { desktopLog: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) } };
  return original.call(this, name, ...args);
};
const { ApiClient } = require('../dist/main/api-client.js');
Module._load = original;

test('lost password-change response clears local token and never records secrets', async () => {
  const client = new ApiClient('http://127.0.0.1:3001');
  const token = 'a'.repeat(64), oldPassword = 'old-password-secret', newPassword = 'new-password-secret';
  client.token = token;
  let calls = 0;
  fetchImpl = async (_url, options) => {
    calls++;
    if (calls === 1) { assert.equal(options.headers.Authorization, `Bearer ${token}`); throw new Error('network failure'); }
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify({ message: 'Sign in again.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  };
  const result = await client.changePassword({ currentPassword: oldPassword, newPassword });
  assert.equal(result.ok, false);
  assert.match(result.error, /result is unknown.*new password.*previous password/i);
  await client.me();
  assert.equal(calls, 2);
  for (const secret of [token, oldPassword, newPassword]) assert.ok(!JSON.stringify(logs).includes(secret));
});

test('lost recovery response is not retried or logged with credentials', async () => {
  const client = new ApiClient('http://127.0.0.1:3001');
  const recoveryToken = 'b'.repeat(64), password = 'recovery-password-secret';
  let calls = 0;
  fetchImpl = async () => { calls++; throw new Error('network failure'); };
  const result = await client.redeemRecovery({ token: recoveryToken, newPassword: password });
  assert.equal(result.ok, false);
  assert.equal(calls, 1);
  for (const secret of [recoveryToken, password]) assert.ok(!JSON.stringify(logs).includes(secret));
});
