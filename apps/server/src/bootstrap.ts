import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { ErrorFilter } from './common/error.filter';
import { DatabaseService } from './database/database.service';
import { NestLogger, serverLog } from './common/logger';
import { diagnosticError } from '@erp/logging';
import { requestLogging } from './common/request-logging';
import { validateAuthConfiguration } from './auth/crypto';

export async function createApplication() {
  validateAuthConfiguration();
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: new NestLogger(), abortOnError: false });
  app.use(requestLogging);
  app.use(helmet());
  app.use(['/api/v1/books','/api/v1/trade','/api/v1/operations'],json({ limit: '128kb' }));
  app.use(json({ limit: '16kb' }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  try {
    const result = await app.get(DatabaseService).pool.query('SELECT max(version) AS version FROM erp_schema_migrations');
    if (result.rows[0].version !== 7) throw new Error('Schema mismatch');
  } catch (error) {
    serverLog.error('database.startup_failed', diagnosticError(error));
    await app.close();
    throw new Error('Database is unavailable or migrations are missing. Run npm run db:check and npm run db:migrate.');
  }
  return app;
}
