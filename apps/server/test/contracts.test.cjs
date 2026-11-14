const { test } = require('node:test');
const assert = require('node:assert/strict');
const { customerInput, loginInput } = require('@erp/contracts');

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
