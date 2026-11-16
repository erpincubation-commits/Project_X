import { createApplication } from './bootstrap';
import { settings } from './config';
import { serverLog, serverLogDirectory } from './common/logger';
import { diagnosticError } from '@erp/logging';
import type { INestApplication } from '@nestjs/common';

let running: INestApplication | undefined;
let stopping = false;
function failed(event: string, error: unknown) {
  if (stopping) return;
  stopping = true;
  serverLog.error(event, diagnosticError(error));
  const code = (error as { code?: string } | null)?.code;
  console.error(code === 'EADDRINUSE' ? 'The API port is already in use. Stop the other server or change SERVER_PORT.' : 'ERP server stopped. Check configuration, PostgreSQL availability and migrations.');
  console.error(`Diagnostic logs: ${serverLogDirectory}`);
  process.exitCode = 1;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  void (running?.close() || Promise.resolve()).catch(closeError => serverLog.error('application.shutdown_failed', diagnosticError(closeError))).finally(() => clearTimeout(timeout));
}
process.on('uncaughtException', error => failed('process.uncaught_exception', error));
process.on('unhandledRejection', error => failed('process.unhandled_rejection', error));

async function main() {
  const config = settings();
  running = await createApplication();
  await running.listen(config.port, config.host);
  serverLog.info('application.ready');
  console.log(`ERP API ready at http://${config.host}:${config.port}/api/v1`);
}
main().catch(error => failed('application.startup_failed', error));
