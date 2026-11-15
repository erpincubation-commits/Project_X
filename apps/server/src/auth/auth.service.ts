import { ConflictException, ForbiddenException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { rolePermissions, type AuthChallenge, type User, type SessionResult } from '@erp/contracts';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { base32, decryptSecret, digest, encryptSecret, equalSecret, verifyTotp } from './crypto';

export const tokenHash = digest;
type Account = User & { password_hash: string; active: boolean; mfa_secret: string | null; mfa_last_step: string | null; auth_version: number };
export function publicUser(account: Pick<User, 'id' | 'email' | 'role'>): User {
  return { id: account.id, email: account.email, role: account.role, permissions: rolePermissions[account.role] || [] };
}

@Injectable()
export class AuthService {
  private readonly dummyHash = hash('invalid-account-password', 12);
  constructor(private readonly database: DatabaseService) {}
  async audit(client: Pick<PoolClient, 'query'>, actor: string | null, action: string, entityId: string, changes: object = {}, entityType = 'user') {
    await client.query('INSERT INTO erp_audit_events(actor_id,action,entity_type,entity_id,changes) VALUES($1,$2,$3,$4,$5)', [actor, action, entityType, entityId, JSON.stringify(changes)]);
  }
  async denied(user: User | undefined, permissions: string[]) { await this.audit(this.database.pool, user?.id || null, 'access.denied', 'permission', { permissions }, 'security'); }
  async setupStatus() { return { setupRequired: !(await this.database.pool.query('SELECT 1 FROM erp_users LIMIT 1')).rowCount }; }
  private async throttle(key: string) {
    const result = await this.database.pool.query<{ attempts: number }>(`
      INSERT INTO erp_login_attempts(email,attempts) VALUES($1,1) ON CONFLICT(email) DO UPDATE SET
      attempts=CASE WHEN erp_login_attempts.window_started < now()-interval '15 minutes' THEN 1 ELSE erp_login_attempts.attempts+1 END,
      window_started=CASE WHEN erp_login_attempts.window_started < now()-interval '15 minutes' THEN now() ELSE erp_login_attempts.window_started END RETURNING attempts`, [key]);
    if (result.rows[0].attempts > 10) {
      await this.audit(this.database.pool, null, 'auth.throttled', 'authentication');
      throw new HttpException('Too many sign-in attempts. Wait 15 minutes before trying again.', 429);
    }
  }
  private async challenge(client: PoolClient, account: Account): Promise<AuthChallenge> {
    await client.query('DELETE FROM erp_auth_challenges WHERE expires_at < now()');
    const token = randomBytes(32).toString('hex');
    const secret = account.mfa_secret ? null : base32(randomBytes(20));
    await client.query('INSERT INTO erp_auth_challenges(token_hash,user_id,enrollment_secret,auth_version) VALUES($1,$2,$3,$4)', [digest(token), account.id, secret ? encryptSecret(secret, account.id) : null, account.auth_version]);
    await this.audit(client, account.id, secret ? 'mfa.enrollment_started' : 'auth.password_verified', account.id);
    return { challenge: token, mfaRequired: true, ...(secret ? { enrollment: { secret, uri: `otpauth://totp/${encodeURIComponent('SMB ERP:' + account.email)}?secret=${secret}&issuer=SMB%20ERP&algorithm=SHA1&digits=6&period=30` } } : {}) };
  }
  async setup(email: string, password: string, setupToken: string) {
    await this.throttle('initial-setup');
    const configured = process.env.ADMIN_SETUP_TOKEN;
    if (!configured || !/^[a-f0-9]{64}$/.test(configured) || !equalSecret(setupToken, configured)) {
      await this.audit(this.database.pool, null, 'setup.denied', 'initial-setup');
      throw new ForbiddenException('Administrator setup was not authorised. Ask the server administrator for the setup code.');
    }
    const passwordHash = await hash(password, 12);
    return this.database.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(83478622)');
      if ((await client.query('SELECT 1 FROM erp_users LIMIT 1')).rowCount) throw new ConflictException('Administrator setup is already complete. Sign in instead.');
      const result = await client.query<Account>("INSERT INTO erp_users(id,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING *", [randomUUID(), email, passwordHash]);
      await this.audit(client, result.rows[0].id, 'setup.completed', result.rows[0].id, { role: 'admin' });
      return this.challenge(client, result.rows[0]);
    });
  }
  async login(email: string, password: string) {
    await this.throttle(email);
    const account = (await this.database.pool.query<Account>('SELECT * FROM erp_users WHERE email=$1', [email])).rows[0];
    const valid = await compare(password, account?.password_hash || await this.dummyHash);
    if (!account?.active || !valid || Buffer.byteLength(password) > 72) {
      await this.audit(this.database.pool, account?.id || null, 'auth.login_failed', account?.id || 'unknown');
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.database.transaction(async client => {
      const current = (await client.query<Account>('SELECT * FROM erp_users WHERE id=$1 FOR UPDATE', [account.id])).rows[0];
      if (!current.active || current.auth_version !== account.auth_version) throw new UnauthorizedException('Sign in again.');
      return this.challenge(client, current);
    });
  }
  async verifyMfa(challengeToken: string, code: string): Promise<SessionResult> {
    // Commit failed counters/audit before throwing an authentication error.
    const outcome = await this.database.transaction(async client => {
      const identity = (await client.query<{ user_id: string }>('SELECT user_id FROM erp_auth_challenges WHERE token_hash=$1', [digest(challengeToken)])).rows[0];
      // Consistent user-before-challenge locking avoids deadlocks across concurrent challenges.
      const account = identity ? (await client.query<Account>('SELECT * FROM erp_users WHERE id=$1 FOR UPDATE', [identity.user_id])).rows[0] : undefined;
      const challenge = (await client.query<{ user_id: string; enrollment_secret: string | null; auth_version: number; attempts: number; expired: boolean }>('SELECT *, expires_at <= now() AS expired FROM erp_auth_challenges WHERE token_hash=$1 FOR UPDATE', [digest(challengeToken)])).rows[0];
      if (!challenge || challenge.expired) {
        await this.audit(client, null, 'mfa.challenge_rejected', 'authentication'); return { failure: 'expired' as const };
      }
      if (challenge.attempts >= 5) {
        await this.audit(client, account?.id || null, 'mfa.challenge_rejected', 'authentication'); return { failure: 'attempts' as const };
      }
      if (!account?.active || account.auth_version !== challenge.auth_version) return { failure: 'expired' as const };
      await client.query('UPDATE erp_auth_challenges SET attempts=attempts+1 WHERE token_hash=$1', [digest(challengeToken)]);
      const limit = await client.query<{ attempts: number }>(`INSERT INTO erp_login_attempts(email,attempts) VALUES($1,1) ON CONFLICT(email) DO UPDATE SET
        attempts=CASE WHEN erp_login_attempts.window_started < now()-interval '15 minutes' THEN 1 ELSE erp_login_attempts.attempts+1 END,
        window_started=CASE WHEN erp_login_attempts.window_started < now()-interval '15 minutes' THEN now() ELSE erp_login_attempts.window_started END RETURNING attempts`, ['mfa:' + account.id]);
      if (limit.rows[0].attempts > 10) { await this.audit(client, account.id, 'mfa.throttled', account.id); return { failure: 'throttled' as const }; }
      const enrolling = !!challenge.enrollment_secret;
      let accepted = false, step: number | null = null;
      if (!(enrolling && account.mfa_secret)) {
        const encrypted = enrolling ? challenge.enrollment_secret : account.mfa_secret;
        if (encrypted) step = verifyTotp(decryptSecret(encrypted, account.id), code, account.mfa_last_step === null ? null : Number(account.mfa_last_step));
        accepted = step !== null;
        if (!accepted && !enrolling && /^[a-f0-9]{32}$/i.test(code.replaceAll('-', ''))) {
          const used = await client.query('DELETE FROM erp_mfa_recovery_codes WHERE user_id=$1 AND code_hash=$2 RETURNING code_hash', [account.id, digest(code.replaceAll('-', '').toLowerCase())]);
          accepted = !!used.rowCount;
          if (accepted) await this.audit(client, account.id, 'mfa.recovery_used', account.id);
        }
      }
      if (!accepted) { await this.audit(client, account.id, 'mfa.verification_failed', account.id); return { failure: 'incorrect' as const }; }
      let recoveryCodes: string[] | undefined;
      if (enrolling) {
        await client.query('UPDATE erp_users SET mfa_secret=$2,mfa_last_step=$3 WHERE id=$1', [account.id, challenge.enrollment_secret, step]);
        recoveryCodes = Array.from({ length: 8 }, () => randomBytes(16).toString('hex'));
        for (const recovery of recoveryCodes) await client.query('INSERT INTO erp_mfa_recovery_codes(user_id,code_hash) VALUES($1,$2)', [account.id, digest(recovery)]);
        await client.query('DELETE FROM erp_sessions WHERE user_id=$1', [account.id]);
        await client.query('DELETE FROM erp_auth_challenges WHERE user_id=$1', [account.id]);
        await this.audit(client, account.id, 'mfa.enabled', account.id);
      } else {
        if (step !== null) await client.query('UPDATE erp_users SET mfa_last_step=$2 WHERE id=$1', [account.id, step]);
        await client.query('DELETE FROM erp_auth_challenges WHERE token_hash=$1', [digest(challengeToken)]);
      }
      await client.query('DELETE FROM erp_login_attempts WHERE email=ANY($1::text[])', [[account.email, 'mfa:' + account.id]]);
      await client.query("DELETE FROM erp_sessions WHERE expires_at < now() OR last_seen_at < now()-interval '30 minutes'");
      const token = randomBytes(32).toString('hex');
      await client.query("INSERT INTO erp_sessions(token_hash,user_id,expires_at,auth_version) VALUES($1,$2,now()+interval '8 hours',$3)", [digest(token), account.id, account.auth_version]);
      await this.audit(client, account.id, 'login', account.id, { factor: enrolling ? 'enrollment' : step === null ? 'recovery' : 'totp' });
      return { token, user: publicUser(account), ...(recoveryCodes ? { recoveryCodes } : {}) };
    });
    if ('failure' in outcome) {
      if (outcome.failure === 'expired') throw new UnauthorizedException('This verification attempt has expired. Select Back to sign in and start again.');
      if (outcome.failure === 'attempts') throw new UnauthorizedException('Too many codes were tried for this attempt. Select Back to sign in and start again.');
      if (outcome.failure === 'throttled') throw new HttpException('Too many verification attempts. Wait 15 minutes before trying again.', 429);
      throw new UnauthorizedException('The code did not match. Check your authenticator account and device time, then try a new code.');
    }
    return outcome;
  }
  async authenticate(token: string): Promise<User> {
    const result = await this.database.pool.query<Account>(`UPDATE erp_sessions s SET last_seen_at=now() FROM erp_users u
      WHERE s.token_hash=$1 AND s.user_id=u.id AND u.active AND u.mfa_secret IS NOT NULL AND s.auth_version=u.auth_version
      AND s.expires_at>now() AND s.last_seen_at>now()-interval '30 minutes' RETURNING u.id,u.email,u.role`, [digest(token)]);
    if (!result.rows[0]) throw new UnauthorizedException('Your session has expired. Sign in again.');
    return publicUser(result.rows[0]);
  }
  async logout(token: string, user: User) {
    await this.database.transaction(async client => { await client.query('DELETE FROM erp_sessions WHERE token_hash=$1', [digest(token)]); await this.audit(client, user.id, 'logout', user.id); });
  }
  async revokeSessions(user: User) {
    await this.database.transaction(async client => {
      await client.query('UPDATE erp_users SET auth_version=auth_version+1 WHERE id=$1', [user.id]);
      await client.query('DELETE FROM erp_sessions WHERE user_id=$1', [user.id]);
      await client.query('DELETE FROM erp_auth_challenges WHERE user_id=$1', [user.id]);
      await this.audit(client, user.id, 'auth.sessions_revoked', user.id);
    });
  }
}
