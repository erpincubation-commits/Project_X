const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createLogger, diagnosticError } = require('../dist');

test('logs diagnostic fields without credentials, payloads or raw exception messages', () => {
  const directory = mkdtempSync(join(tmpdir(), 'erp-log-'));
  const logger = createLogger({ component: 'test', directory, console: false });
  const error = Object.assign(new Error('password=private-password'), { code: 'ECONNREFUSED' });
  logger.error('request.failed', { ...diagnosticError(error), password: 'private-password', authorization: 'Bearer private-token', body: { name: 'Private Customer' }, databaseUrl: 'postgres://secret', requestId: 'abc', status: 503 });
  const raw = readFileSync(logger.file, 'utf8');
  assert.ok(!raw.includes('private') && !raw.includes('Private') && !raw.includes('postgres://'));
  assert.equal(JSON.parse(raw).errorCode, 'ECONNREFUSED');
  assert.equal(JSON.parse(raw).requestId, 'abc');
});
test('file rotation keeps a bounded set of valid JSON logs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'erp-rotation-'));
  const logger = createLogger({ component: 'test', directory, console: false, maxBytes: 250, backups: 2 });
  for (let i = 0; i < 20; i++) logger.info('request.finished', { status: 200, attempt: i });
  assert.equal(readdirSync(directory).length, 3);
  for (const file of readdirSync(directory)) for (const line of readFileSync(join(directory, file), 'utf8').trim().split('\n')) assert.equal(JSON.parse(line).component, 'test');
});
test('an unavailable log directory does not break a business operation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'erp-log-failure-'));
  const blocker = join(directory, 'file'); writeFileSync(blocker, 'not a directory');
  const logger = createLogger({ component: 'test', directory: blocker, console: false });
  assert.doesNotThrow(() => logger.error('request.failed'));
});
