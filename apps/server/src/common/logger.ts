import { createLogger, diagnosticError } from '@erp/logging';
import type { LoggerService } from '@nestjs/common';
import { resolve } from 'node:path';
import { projectRoot } from '../config';

export const serverLogDirectory = resolve(process.env.ERP_LOG_DIR || resolve(projectRoot, '.local/logs/server'));
export const serverLog = createLogger({ component: 'server', directory: serverLogDirectory });
// Nest sometimes supplies raw exceptions or user-controlled values in its logger.
// Keep framework output within the same diagnostic-only field policy.
export class NestLogger implements LoggerService {
  log(_message: unknown, context?: string) { serverLog.info('framework.log', { context }); }
  warn(_message: unknown, context?: string) { serverLog.warn('framework.warning', { context }); }
  error(message: unknown) { serverLog.error('framework.error', diagnosticError(message)); }
}
