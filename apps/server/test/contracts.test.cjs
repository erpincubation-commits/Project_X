const { test } = require('node:test');
const assert = require('node:assert/strict');
const { customerInput, loginInput, changePasswordInput } = require('@erp/contracts');

test('customer contract normalizes codes and rejects invalid or unexpected fields', () => {
  assert.deepEqual(customerInput.parse({ code: ' cust-1 ', name: ' Example ' }), { code: 'CUST-1', name: 'Example' });
  for (const input of [{ code: '', name: 'Name' }, { code: 'A B', name: 'Name' }, { code: 'A', name: 'Name\nOther' }, { code: 'A', name: ' ' }, { code: 'A', name: 'X', role: 'admin' }]) {
    assert.equal(customerInput.safeParse(input).success, false);
  }
});
test('login contract rejects missing credentials and additional fields', () => {
  assert.equal(loginInput.safeParse({ email: 'admin@local.test', password: '' }).success, false);
  assert.equal(loginInput.safeParse({ email: 'ADMIN@local.test', password: 'test' }).data.email, 'admin@local.test');
  assert.equal(loginInput.safeParse({ email: 'admin@local.test', password: 'test', role: 'admin' }).success, false);
});

test('password change contract applies existing byte limits and rejects extra fields', () => {
  assert.equal(changePasswordInput.safeParse({ currentPassword: 'old', newPassword: 'valid-password-123' }).success, true);
  for (const input of [{ currentPassword: '', newPassword: 'valid-password-123' }, { currentPassword: 'old', newPassword: 'short' }, { currentPassword: 'old', newPassword: '\u00e9'.repeat(37) }, { currentPassword: 'old', newPassword: 'valid-password-123', token: 'extra' }]) assert.equal(changePasswordInput.safeParse(input).success, false);
});
