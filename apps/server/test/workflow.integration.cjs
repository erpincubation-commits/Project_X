const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { hash } = require('bcryptjs');
require('../dist/config.js');
const { migrate } = require('../dist/database/migrate.js');

test('shared server workflow: authentication, permissions, persistence, retries and audit', async () => {
  const originalUrl = process.env.DATABASE_URL;
  assert.ok(originalUrl, 'Configure DATABASE_URL before integration tests.');
  const owner = new Pool({ connectionString: originalUrl, connectionTimeoutMillis: 5000 });
  const schema = `erp_test_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^erp_test_[a-f0-9]{32}$/);
  await owner.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(originalUrl);
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  const pool = new Pool({ connectionString: url.toString() });
  let app;
  try {
    await migrate(pool);
    await migrate(pool); // Reapplying must preserve records and schema.
    for (const role of ['admin', 'reader']) await pool.query('INSERT INTO erp_users(id,email,password_hash,role) VALUES($1,$2,$3,$4)', [randomUUID(), `${role}@local.test`, await hash('integration-password', 4), role]);
    app = await require('../dist/bootstrap.js').createApplication();
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    async function request(path, method = 'GET', body, token, key) {
      const response = await fetch(`${base}/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: response.status === 204 ? null : await response.json() };
    }
    assert.equal((await request('/health')).status, 200);
    assert.equal((await request('/customers')).status, 401);
    assert.equal((await request('/auth/login', 'POST', { email: 'admin@local.test', password: 'incorrect' })).status, 401);
    const login = async role => (await request('/auth/login', 'POST', { email: `${role}@local.test`, password: 'integration-password' })).data.token;
    const admin = await login('admin');
    const secondClient = await login('admin');
    const reader = await login('reader');
    assert.match(admin, /^[a-f0-9]{64}$/);
    const customer = { code: 'cust-1', name: 'Shared customer' };
    assert.equal((await request('/customers', 'POST', customer, reader, randomUUID())).status, 403);
    assert.equal((await request('/customers', 'POST', { code: '', name: 'X' }, admin, randomUUID())).status, 400);
    assert.equal((await request('/customers', 'POST', customer, admin)).status, 400);
    const key = randomUUID();
    const results = await Promise.all([request('/customers', 'POST', customer, admin, key), request('/customers', 'POST', customer, admin, key)]);
    assert.ok(results.every(result => result.status === 201));
    assert.deepEqual(results[0].data, results[1].data);
    assert.equal((await request('/customers', 'POST', { ...customer, name: 'Changed' }, admin, key)).status, 409);
    assert.equal((await request('/customers', 'POST', customer, admin, randomUUID())).status, 409);
    const shared = await request('/customers', 'GET', undefined, secondClient);
    assert.equal(shared.data.items[0].code, 'CUST-1');
    assert.equal(shared.data.total, 1);
    assert.equal((await request('/customers?page=0', 'GET', undefined, reader)).status, 400);
    assert.equal((await request('/customers', 'GET', undefined, reader)).data.total, 1);
    assert.equal((await pool.query("SELECT count(*) FROM erp_audit_events WHERE entity_type='customer'")).rows[0].count, '1');
    await assert.rejects(() => pool.query("UPDATE erp_audit_events SET action='tampered'"));
    // Fail the audit insert to prove that the associated customer insert rolls back.
    await pool.query(`CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='FAIL' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fail_test_audit BEFORE INSERT ON erp_audit_events FOR EACH ROW EXECUTE FUNCTION reject_test_audit()`);
    assert.equal((await request('/customers', 'POST', { code: 'FAIL', name: 'Must roll back' }, admin, randomUUID())).status, 500);
    assert.equal((await pool.query("SELECT count(*) FROM erp_customers WHERE code='FAIL'")).rows[0].count, '0');
    assert.equal((await request('/auth/logout', 'POST', undefined, admin)).status, 204);
    assert.equal((await request('/customers', 'GET', undefined, admin)).status, 401);
    await pool.query("UPDATE erp_sessions SET last_seen_at=now()-interval '31 minutes'");
    assert.equal((await request('/customers', 'GET', undefined, reader)).status, 401);
    for (let attempt = 0; attempt < 10; attempt++) assert.equal((await request('/auth/login', 'POST', { email: 'missing@local.test', password: 'wrong' })).status, 401);
    assert.equal((await request('/auth/login', 'POST', { email: 'missing@local.test', password: 'wrong' })).status, 429);
  } finally {
    if (app) await app.close();
    await pool.end();
    process.env.DATABASE_URL = originalUrl;
    await owner.query(`DROP SCHEMA "${schema}" CASCADE`);
    await owner.end();
  }
});
