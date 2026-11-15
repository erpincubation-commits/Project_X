import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { settings } from '../config';
import { serverLog } from '../common/logger';
import { diagnosticError } from '@erp/logging';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: settings().databaseUrl, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  constructor() { this.pool.on('error', error => serverLog.error('database.connection_failed', diagnosticError(error))); }
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); }
      catch (rollbackError) { serverLog.error('database.rollback_failed', diagnosticError(rollbackError)); }
      throw error;
    } finally { client.release(); }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
