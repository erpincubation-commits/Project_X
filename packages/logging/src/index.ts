import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export type Level = 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;
// Only explicitly approved diagnostics may enter logs. Never serialize requests,
// response bodies, configuration objects, headers, SQL, or arbitrary error messages.
const permitted = new Set(['requestId', 'method', 'route', 'status', 'durationMs', 'errorName', 'errorCode', 'causeCode', 'reason', 'exitCode', 'signal', 'processType', 'channel', 'context', 'attempt', 'version']);
export function diagnosticError(error: unknown): LogFields {
  if (!error || typeof error !== 'object') return { errorName: 'UnknownError' };
  const candidate = error as { name?: unknown; code?: unknown; cause?: { code?: unknown } };
  return { errorName: candidate.name, errorCode: candidate.code, causeCode: candidate.cause?.code };
}

export function createLogger(options: { component: string; directory: string; console?: boolean; maxBytes?: number; backups?: number }) {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const backups = options.backups ?? 3;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(backups) || backups < 1 || backups > 20) throw new Error('Invalid log rotation limits.');
  const file = join(options.directory, `${options.component}-${process.pid}.log`);
  let failed = false;
  function write(level: Level, event: string, fields: LogFields = {}) {
    const safe: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (!permitted.has(key)) continue;
      if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean') safe[key] = value;
      else if (typeof value === 'string') safe[key] = value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180);
    }
    const record = JSON.stringify({ timestamp: new Date().toISOString(), level, component: options.component, pid: process.pid, event: /^[a-z0-9._-]{1,80}$/.test(event) ? event : 'invalid_event', ...safe }) + '\n';
    try {
      mkdirSync(options.directory, { recursive: true, mode: 0o700 });
      if (existsSync(file) && statSync(file).size + Buffer.byteLength(record) > maxBytes) {
        const oldest = `${file}.${backups}`;
        if (existsSync(oldest)) unlinkSync(oldest);
        for (let index = backups - 1; index >= 1; index--) if (existsSync(`${file}.${index}`)) renameSync(`${file}.${index}`, `${file}.${index + 1}`);
        renameSync(file, `${file}.1`);
      }
      appendFileSync(file, record, { mode: 0o600 });
    } catch {
      if (!failed) { failed = true; try { process.stderr.write('ERP log file could not be written. Check the log folder permissions and available disk space.\n'); } catch { /* No writable diagnostic sink remains. */ } }
    }
    if (options.console !== false) {
      try { (level === 'error' ? process.stderr : process.stdout).write(record); } catch { /* A closed console must not interrupt application work. */ }
    }
  }
  return { file, info: (event: string, fields?: LogFields) => write('info', event, fields), warn: (event: string, fields?: LogFields) => write('warn', event, fields), error: (event: string, fields?: LogFields) => write('error', event, fields) };
}
export type AppLogger = ReturnType<typeof createLogger>;
