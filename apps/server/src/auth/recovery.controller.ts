import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards, ForbiddenException, UnauthorizedException, HttpException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { passwordInput } from '@erp/contracts';
import type { PoolClient } from 'pg';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { parse } from '../common/validation';
import { AuthGuard, AuthRequest } from './auth.guard';
import { AuthService } from './auth.service';
import { digest } from './crypto';

const caseInput = z.object({ email: z.email().max(254).transform(v => v.toLowerCase()), verified: z.literal(true) }).strict();
const verifyInput = z.object({ verified: z.literal(true) }).strict();
const redeemInput = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), newPassword: passwordInput }).strict();
const caseId = z.uuid();
type Actor = { id:string; active:boolean; role:string; auth_version:number; privacy_restricted:boolean; mfa_secret:string|null };
type Recovery = { id:string; subject_id:string; requested_by:string; requested_version:number; subject_version:number; approved_by:string|null; approved_version:number|null; status:string; valid:boolean };

@Controller('identity-recovery')
export class RecoveryController {
  constructor(private readonly database: DatabaseService, private readonly auth: AuthService) {}
  private async actor(client: PoolClient, req: AuthRequest): Promise<Actor> {
    const row = (await client.query<Actor>(`SELECT u.* FROM erp_users u JOIN erp_sessions s ON s.user_id=u.id WHERE u.id=$1 AND s.token_hash=$2 AND u.active AND NOT u.privacy_restricted AND u.role='admin' AND u.mfa_secret IS NOT NULL AND s.auth_version=u.auth_version AND s.expires_at>now() AND s.last_seen_at>now()-interval '30 minutes' FOR UPDATE OF u`, [req.user.id,digest(req.token)])).rows[0];
    if (!row) throw new ForbiddenException('An active administrator session is required.');
    return row;
  }
  private async serial(client: PoolClient) { await client.query('SELECT pg_advisory_xact_lock(83478622)'); }
  private async throttle(key:string, max:number) {
    const row = (await this.database.pool.query<{attempts:number}>(`INSERT INTO erp_login_attempts(email,attempts) VALUES($1,1) ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN erp_login_attempts.window_started < now()-interval '15 minutes' THEN 1 ELSE erp_login_attempts.attempts+1 END, window_started=CASE WHEN erp_login_attempts.window_started < now()-interval '15 minutes' THEN now() ELSE erp_login_attempts.window_started END RETURNING attempts`, [key])).rows[0];
    if (row.attempts > max) { await this.auth.audit(this.database.pool,null,'identity_recovery.throttled','identity_recovery',{},'security'); throw new HttpException('Too many recovery attempts. Wait 15 minutes before trying again.',429); }
  }
  @UseGuards(AuthGuard) @Get('cases') async list(@Req() req:AuthRequest) {
    return this.database.transaction(async c => { await this.serial(c); await this.actor(c,req); return (await c.query(`SELECT r.id,u.email,r.status,r.requested_by AS "requestedBy",r.approved_by AS "approvedBy",r.created_at AS "createdAt",r.expires_at AS "expiresAt" FROM erp_identity_recoveries r JOIN erp_users u ON u.id=r.subject_id WHERE (r.status='PENDING' AND r.created_at>now()-interval '24 hours') OR (r.status='ISSUED' AND r.expires_at>now()) ORDER BY r.created_at DESC LIMIT 100`)).rows; });
  }
  @UseGuards(AuthGuard) @Post('cases') async request(@Req() req:AuthRequest,@Body() body:unknown) {
    const input=parse(caseInput,body); await this.throttle('recovery-operator:'+req.user.id,10);
    return this.database.transaction(async c => {
      await this.serial(c); const actor=await this.actor(c,req);
      const subject=(await c.query<Actor>('SELECT * FROM erp_users WHERE email=$1 FOR UPDATE',[input.email])).rows[0];
      if (!subject || !subject.active || subject.privacy_restricted || subject.id===actor.id) throw new ForbiddenException('The recovery request cannot be accepted.');
      if (subject.role==='admin' && !(await c.query("SELECT 1 FROM erp_users WHERE active AND role='admin' AND id<>$1 LIMIT 1",[subject.id])).rowCount) throw new ForbiddenException('The recovery request cannot be accepted.');
      const id=randomUUID();
      await c.query("INSERT INTO erp_identity_recoveries(id,subject_id,requested_by,requested_version,subject_version,status) VALUES($1,$2,$3,$4,$5,'PENDING')",[id,subject.id,actor.id,actor.auth_version,subject.auth_version]);
      await this.auth.audit(c,actor.id,'identity_recovery.requested',id,{subjectId:subject.id},'identity_recovery'); return {id};
    });
  }
  @UseGuards(AuthGuard) @Post('cases/:id/approve') async approve(@Req() req:AuthRequest,@Param('id') value:string,@Body() body:unknown) {
    const id=parse(caseId,value); parse(verifyInput,body); await this.throttle('recovery-operator:'+req.user.id,10);
    return this.database.transaction(async c => {
      await this.serial(c); const actor=await this.actor(c,req);
      const rec=(await c.query<Recovery>("SELECT *,created_at>now()-interval '24 hours' AS valid FROM erp_identity_recoveries WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if (!rec || rec.status!=='PENDING' || !rec.valid || [rec.requested_by,rec.subject_id].includes(actor.id)) throw new ForbiddenException('The recovery request cannot be approved.');
      const members=(await c.query<Actor>('SELECT * FROM erp_users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[rec.subject_id,rec.requested_by]])).rows;
      const subject=members.find(x=>x.id===rec.subject_id), requester=members.find(x=>x.id===rec.requested_by);
      if (!subject?.active || subject.privacy_restricted || subject.auth_version!==rec.subject_version || !requester?.active || requester.privacy_restricted || requester.role!=='admin' || requester.auth_version!==rec.requested_version) throw new ForbiddenException('The recovery request cannot be approved.');
      const token=randomBytes(32).toString('hex');
      await c.query("UPDATE erp_identity_recoveries SET status='ISSUED', approved_by=$2,approved_version=$3,token_hash=$4,expires_at=now()+interval '15 minutes' WHERE id=$1",[id,actor.id,actor.auth_version,digest(token)]);
      await this.auth.audit(c,actor.id,'identity_recovery.issued',id,{subjectId:subject.id},'identity_recovery');
      return {token,expiresInSeconds:900};
    });
  }
  @UseGuards(AuthGuard) @HttpCode(204) @Post('cases/:id/cancel') async cancel(@Req() req:AuthRequest,@Param('id') value:string) {
    const id=parse(caseId,value);
    await this.database.transaction(async c=>{ await this.serial(c); const actor=await this.actor(c,req); const row=await c.query("UPDATE erp_identity_recoveries SET status='CANCELLED',token_hash=NULL WHERE id=$1 AND status IN ('PENDING','ISSUED') RETURNING subject_id",[id]); if(row.rowCount) await this.auth.audit(c,actor.id,'identity_recovery.cancelled',id,{},'identity_recovery'); });
  }
  @HttpCode(204) @Post('redeem') async redeem(@Req() req:Request,@Body() body:unknown) {
    await this.throttle('recovery-client:'+digest(req.ip || 'unknown'),20);
    const parsed=redeemInput.safeParse(body); if(!parsed.success) { await this.auth.audit(this.database.pool,null,'identity_recovery.redeem_rejected','identity_recovery',{},'security'); throw new UnauthorizedException('The recovery attempt could not be completed. Contact your administrator.'); }
    const passwordHash=await hash(parsed.data.newPassword,12);
    const success=await this.database.transaction(async c=>{
      await this.serial(c);
      const rec=(await c.query<Recovery>("SELECT *,expires_at>now() AS valid FROM erp_identity_recoveries WHERE token_hash=$1 FOR UPDATE",[digest(parsed.data.token)])).rows[0];
      if(!rec || rec.status!=='ISSUED' || !rec.valid || !rec.approved_by) return false;
      const rows=(await c.query<Actor>('SELECT * FROM erp_users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[rec.subject_id,rec.requested_by,rec.approved_by]])).rows;
      const subject=rows.find(x=>x.id===rec.subject_id), requester=rows.find(x=>x.id===rec.requested_by), approver=rows.find(x=>x.id===rec.approved_by);
      if(!subject?.active || subject.privacy_restricted || subject.auth_version!==rec.subject_version || !requester?.active || requester.role!=='admin' || requester.privacy_restricted || requester.auth_version!==rec.requested_version || !approver?.active || approver.role!=='admin' || approver.privacy_restricted || approver.auth_version!==rec.approved_version) return false;
      if(subject.role==='admin' && !(await c.query("SELECT 1 FROM erp_users WHERE role='admin' AND active AND id<>$1 LIMIT 1",[subject.id])).rowCount) return false;
      await c.query('UPDATE erp_users SET password_hash=$2,mfa_secret=NULL,mfa_last_step=NULL,auth_version=auth_version+1 WHERE id=$1',[subject.id,passwordHash]);
      await c.query('DELETE FROM erp_sessions WHERE user_id=$1',[subject.id]);
      await c.query('DELETE FROM erp_auth_challenges WHERE user_id=$1',[subject.id]);
      await c.query('DELETE FROM erp_mfa_recovery_codes WHERE user_id=$1',[subject.id]);
      await c.query("UPDATE erp_identity_recoveries SET status=CASE WHEN id=$2 THEN 'COMPLETED' ELSE 'CANCELLED' END,token_hash=NULL WHERE subject_id=$1 AND status IN ('PENDING','ISSUED')",[subject.id,rec.id]);
      await this.auth.audit(c,null,'identity_recovery.completed',rec.id,{subjectId:subject.id},'identity_recovery'); return true;
    });
    if (!success) await this.auth.audit(this.database.pool,null,'identity_recovery.redeem_rejected','identity_recovery',{},'security');
    if(!success) throw new UnauthorizedException('The recovery attempt could not be completed. Contact your administrator.');
  }
}
