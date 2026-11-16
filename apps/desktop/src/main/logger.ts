import { app } from 'electron';
import { join } from 'node:path';
import { createLogger, type AppLogger, type LogFields } from '@erp/logging';

let logger: AppLogger | undefined;
function current() { return logger ??= createLogger({ component: 'desktop', directory: join(app.getPath('userData'), 'logs'), console: !app.isPackaged }); }
export const desktopLog = {
  info: (event: string, fields?: LogFields) => current().info(event, fields),
  warn: (event: string, fields?: LogFields) => current().warn(event, fields),
  error: (event: string, fields?: LogFields) => current().error(event, fields)
};
