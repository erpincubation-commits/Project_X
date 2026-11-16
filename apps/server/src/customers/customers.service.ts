import { ConflictException, Injectable } from '@nestjs/common';
import type { Customer, CustomerInput, User } from '@erp/contracts';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CustomersService {
  constructor(private readonly database: DatabaseService) {}
  async list(page: number) {
    const pageSize = 20;
    const result = await this.database.pool.query<Customer>('SELECT code,name,created_at AS "createdAt" FROM erp_customers ORDER BY code LIMIT $1 OFFSET $2', [pageSize, (page - 1) * pageSize]);
    const count = await this.database.pool.query<{ count: string }>('SELECT count(*) FROM erp_customers');
    return { items: result.rows, total: Number(count.rows[0].count), page, pageSize };
  }
  async create(user: User, input: CustomerInput, requestId: string) {
    try {
      return await this.database.transaction(async client => {
        // Serialize retries for the same user/key before checking the stored result.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [user.id + requestId]);
        const prior = await client.query<{ payload: CustomerInput; response: Customer }>('SELECT payload,response FROM erp_idempotency WHERE actor_id=$1 AND request_id=$2', [user.id, requestId]);
        if (prior.rows[0]) {
          if (prior.rows[0].payload.code !== input.code || prior.rows[0].payload.name !== input.name) throw new ConflictException('This request ID was already used for different customer details.');
          return prior.rows[0].response;
        }
        const result = await client.query<Customer>('INSERT INTO erp_customers(code,name) VALUES($1,$2) RETURNING code,name,created_at AS "createdAt"', [input.code, input.name]);
        const customer = result.rows[0];
        await client.query("INSERT INTO erp_audit_events(actor_id,action,entity_type,entity_id,changes) VALUES($1,'create','customer',$2,$3)", [user.id, input.code, JSON.stringify({ after: input })]);
        await client.query('INSERT INTO erp_idempotency(actor_id,request_id,payload,response) VALUES($1,$2,$3,$4)', [user.id, requestId, JSON.stringify(input), JSON.stringify(customer)]);
        return customer;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Customer code already exists. Choose another code.');
      throw error;
    }
  }
}
