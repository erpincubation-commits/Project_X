import { Body, ConflictException, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { createUserInput, updateUserInput, type ManagedUser } from '@erp/contracts';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { parse } from '../common/validation';
import { AuthGuard, AuthRequest } from './auth.guard';
import { PermissionsGuard, RequirePermissions } from './permissions.guard';
import { AuthService } from './auth.service';

const columns = 'id,email,role,active,(mfa_secret IS NOT NULL) AS "mfaEnabled"';
@Controller('access')
@UseGuards(AuthGuard, PermissionsGuard)
export class AccessController {
  constructor(private readonly database: DatabaseService, private readonly auth: AuthService) {}
  @Get('users') @RequirePermissions('users.manage')
  async users() { return (await this.database.pool.query<ManagedUser>(`SELECT ${columns} FROM erp_users ORDER BY email LIMIT 500`)).rows; }
  @Post('users') @RequirePermissions('users.manage')
  async create(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = parse(createUserInput, body);
    if (request.user.role !== 'admin' && input.role !== 'reader') throw new ForbiddenException('Only an administrator may assign privileged roles.');
    const passwordHash = await hash(input.password, 12);
    try {
      return await this.database.transaction(async client => {
        const result = await client.query<ManagedUser>(`INSERT INTO erp_users(id,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING ${columns}`, [randomUUID(), input.email, passwordHash, input.role]);
        await this.auth.audit(client, request.user.id, 'user.created', result.rows[0].id, { role: input.role });
        return result.rows[0];
      });
    } catch (error) { if ((error as { code?: string }).code === '23505') throw new ConflictException('An account with this email already exists.'); throw error; }
  }
  @Patch('users/:id') @RequirePermissions('users.manage')
  async update(@Req() request: AuthRequest, @Param('id') value: string, @Body() body: unknown) {
    const id = parse(z.uuid(), value); const input = parse(updateUserInput, body);
    if (id === request.user.id) throw new ForbiddenException('Ask another administrator to change your access.');
    return this.database.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(83478622)');
      const before = (await client.query<ManagedUser>('SELECT id,email,role,active FROM erp_users WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!before) throw new ConflictException('Account no longer exists. Refresh the list.');
      if (request.user.role !== 'admin' && (before.role !== 'reader' || input.role !== 'reader')) throw new ForbiddenException('Only an administrator may change privileged accounts.');
      if (before.role === 'admin' && before.active && (input.role !== 'admin' || !input.active)) {
        if (!(await client.query("SELECT 1 FROM erp_users WHERE role='admin' AND active AND id<>$1 LIMIT 1", [id])).rowCount) throw new ConflictException('Keep at least one active administrator.');
      }
      const result = await client.query<ManagedUser>(`UPDATE erp_users SET role=$2,active=$3,auth_version=auth_version+1 WHERE id=$1 RETURNING ${columns}`, [id, input.role, input.active]);
      await client.query('DELETE FROM erp_sessions WHERE user_id=$1', [id]);
      await client.query('DELETE FROM erp_auth_challenges WHERE user_id=$1', [id]);
      await this.auth.audit(client, request.user.id, 'user.access_changed', id, { before: { role: before.role, active: before.active }, after: input });
      return result.rows[0];
    });
  }
  @Get('audit') @RequirePermissions('audit.read')
  async audit(@Req() request: AuthRequest, @Query('page') value: unknown = '1') {
    const page = parse(z.coerce.number().int().min(1).max(100000), value);
    const result = await this.database.pool.query('SELECT id::text,actor_id AS "actorId",action,entity_type AS "entityType",entity_id AS "entityId",occurred_at AS "occurredAt",changes FROM erp_audit_events ORDER BY id DESC LIMIT 50 OFFSET $1', [(page - 1) * 50]);
    await this.auth.audit(this.database.pool, request.user.id, 'audit.viewed', 'audit', { page }, 'security');
    return { items: result.rows, page };
  }
}
