import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@erp/contracts';
import { DatabaseService } from '../database/database.service';

export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }

@Injectable()
export class AuthService {
  private readonly dummyHash = hash('invalid-account-password', 12);
  constructor(private readonly database: DatabaseService) {}

  async login(email: string, password: string) {
    const attempt = await this.database.pool.query<{ attempts: number }>(`
      INSERT INTO erp_login_attempts(email, attempts) VALUES($1, 1)
      ON CONFLICT(email) DO UPDATE SET
        attempts = CASE WHEN erp_login_attempts.window_started < now() - interval '15 minutes' THEN 1 ELSE erp_login_attempts.attempts + 1 END,
        window_started = CASE WHEN erp_login_attempts.window_started < now() - interval '15 minutes' THEN now() ELSE erp_login_attempts.window_started END
      RETURNING attempts`, [email]);
    if (attempt.rows[0].attempts > 10) throw new HttpException('Too many sign-in attempts. Wait 15 minutes before trying again.', 429);
    const result = await this.database.pool.query<User & { password_hash: string; active: boolean }>('SELECT id, email, role, password_hash, active FROM erp_users WHERE email=$1', [email]);
    const account = result.rows[0];
    const valid = await compare(password, account?.password_hash || await this.dummyHash);
    if (!account?.active || !valid || Buffer.byteLength(password) > 72) throw new UnauthorizedException('Email or password is incorrect.');
    const token = randomBytes(32).toString('hex');
    await this.database.transaction(async client => {
      await client.query('DELETE FROM erp_login_attempts WHERE email=$1', [email]);
      await client.query("DELETE FROM erp_sessions WHERE expires_at < now() OR last_seen_at < now() - interval '30 minutes'");
      await client.query("INSERT INTO erp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')", [tokenHash(token), account.id]);
      await client.query("INSERT INTO erp_audit_events(actor_id,action,entity_type,entity_id,changes) VALUES($1,'login','user',$2,'{}')", [account.id, account.id]);
    });
    return { token, user: { id: account.id, email: account.email, role: account.role } as User };
  }

  async authenticate(token: string): Promise<User> {
    const result = await this.database.pool.query<User>(`
      UPDATE erp_sessions s SET last_seen_at=now() FROM erp_users u
      WHERE s.token_hash=$1 AND s.user_id=u.id AND u.active AND s.expires_at>now()
        AND s.last_seen_at>now()-interval '30 minutes'
      RETURNING u.id,u.email,u.role`, [tokenHash(token)]);
    if (!result.rows[0]) throw new UnauthorizedException('Your session has expired. Sign in again.');
    return result.rows[0];
  }

  async logout(token: string) { await this.database.pool.query('DELETE FROM erp_sessions WHERE token_hash=$1', [tokenHash(token)]); }
}
