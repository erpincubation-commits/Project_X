import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { ErrorFilter } from './common/error.filter';
import { DatabaseService } from './database/database.service';

export async function createApplication() {
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error', 'warn', 'log'] });
  app.use(helmet());
  app.use(json({ limit: '16kb' }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  try {
    const result = await app.get(DatabaseService).pool.query('SELECT max(version) AS version FROM erp_schema_migrations');
    if (result.rows[0].version !== 2) throw new Error('Schema mismatch');
  } catch {
    await app.close();
    throw new Error('Database is unavailable or migrations are missing. Run npm run db:check and npm run db:migrate.');
  }
  return app;
}
