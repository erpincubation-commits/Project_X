import { recoveryMigration } from './recovery-migration';
import { sourcingMigration } from './sourcing-migration';
import { quoteWithdrawalMigration } from './quote-withdrawal-migration';
import { quoteRecommendationMigration } from './quote-recommendation-migration';
import { matchingPolicyMigration } from './matching-policy-migration';
import { orderQuoteAwardMigration } from './order-quote-award-migration';
import { serviceAcceptanceMigration } from './service-acceptance-migration';
import { supplierQualificationMigration } from './supplier-qualification-migration';
import { exceptionOwnershipMigration } from './exception-ownership-migration';
import { createHash } from 'node:crypto';
import { operationsMigration } from './operations-migration';
import type { Pool } from 'pg';
import { booksMigration } from './books-migration';
import { tradeMigration } from './trade-migration';

export const migrations = [
  { version: 1, sql: `CREATE TABLE IF NOT EXISTS erp_customers (
    code VARCHAR(32) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'), CHECK (length(btrim(name)) > 0)
  )` },
  { version: 2, sql: `
    CREATE TABLE erp_users (
      id UUID PRIMARY KEY, email VARCHAR(254) UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','reader')), active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE erp_sessions (
      token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES erp_users(id),
      expires_at TIMESTAMPTZ NOT NULL, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX ON erp_sessions(user_id);
    CREATE TABLE erp_login_attempts (
      email VARCHAR(254) PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0,
      window_started TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE erp_audit_events (
      id BIGSERIAL PRIMARY KEY, actor_id UUID NOT NULL REFERENCES erp_users(id),
      action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), changes JSONB NOT NULL
    );
    CREATE TABLE erp_idempotency (
      actor_id UUID NOT NULL REFERENCES erp_users(id), request_id UUID NOT NULL,
      payload JSONB NOT NULL, response JSONB NOT NULL, PRIMARY KEY(actor_id, request_id)
    );
    CREATE FUNCTION erp_reject_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Audit events cannot be changed'; END;
    $$;
    CREATE TRIGGER erp_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_audit_events
      FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
  ` },
  { version: 3, sql: `
    ALTER TABLE erp_users DROP CONSTRAINT erp_users_role_check;
    ALTER TABLE erp_users ADD CONSTRAINT erp_users_role_check CHECK (role IN ('admin','reader','identity_admin','auditor'));
    ALTER TABLE erp_users ADD COLUMN mfa_secret TEXT;
    ALTER TABLE erp_users ADD COLUMN mfa_last_step BIGINT;
    ALTER TABLE erp_users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE erp_sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE erp_audit_events ALTER COLUMN actor_id DROP NOT NULL;
    CREATE INDEX erp_audit_time ON erp_audit_events(occurred_at DESC, id DESC);
    CREATE TABLE erp_auth_challenges (
      token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES erp_users(id),
      enrollment_secret TEXT, auth_version INTEGER NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '5 minutes',
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0)
    );
    CREATE INDEX erp_auth_challenges_user ON erp_auth_challenges(user_id);
    CREATE TABLE erp_mfa_recovery_codes (
      user_id UUID NOT NULL REFERENCES erp_users(id), code_hash TEXT NOT NULL,
      PRIMARY KEY(user_id, code_hash)
    );
    DELETE FROM erp_sessions;
  ` },
  { version: 4, sql: `
    ALTER TABLE erp_users DROP CONSTRAINT erp_users_role_check;
    ALTER TABLE erp_users ADD CONSTRAINT erp_users_role_check CHECK (role IN ('admin','reader','identity_admin','auditor','requester','business_approver','purchasing'));
    CREATE TABLE erp_suppliers (
      id UUID PRIMARY KEY, code VARCHAR(32) UNIQUE NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
      name VARCHAR(160) NOT NULL CHECK(length(btrim(name))>0), contact_email VARCHAR(254) NOT NULL DEFAULT '', phone VARCHAR(40) NOT NULL DEFAULT '',
      payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK(payment_terms_days BETWEEN 0 AND 365), active BOOLEAN NOT NULL DEFAULT true,
      version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_by UUID NOT NULL REFERENCES erp_users(id), updated_by UUID NOT NULL REFERENCES erp_users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE erp_items (
      id UUID PRIMARY KEY, code VARCHAR(32) UNIQUE NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
      name VARCHAR(160) NOT NULL CHECK(length(btrim(name))>0), description VARCHAR(1000) NOT NULL DEFAULT '',
      unit VARCHAR(16) NOT NULL CHECK(unit ~ '^[A-Z0-9][A-Z0-9._-]{0,15}$'), active BOOLEAN NOT NULL DEFAULT true,
      version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_by UUID NOT NULL REFERENCES erp_users(id), updated_by UUID NOT NULL REFERENCES erp_users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE SEQUENCE erp_purchase_request_numbers;
    CREATE TABLE erp_purchase_requests (
      id UUID PRIMARY KEY, number TEXT UNIQUE NOT NULL DEFAULT ('PR-' || nextval('erp_purchase_request_numbers')::text),
      title VARCHAR(160) NOT NULL CHECK(length(btrim(title))>0), justification VARCHAR(2000) NOT NULL CHECK(length(btrim(justification))>=3), currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), needed_by DATE,
      supplier_id UUID REFERENCES erp_suppliers(id), supplier_code VARCHAR(32), supplier_name VARCHAR(160), supplier_version INTEGER,
      requester_id UUID NOT NULL REFERENCES erp_users(id), approver_id UUID REFERENCES erp_users(id),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
      submitted_at TIMESTAMPTZ, decided_at TIMESTAMPTZ, decision_reason VARCHAR(1000),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK(approver_id IS NULL OR approver_id<>requester_id),
      CHECK((supplier_id IS NULL AND supplier_code IS NULL AND supplier_name IS NULL AND supplier_version IS NULL) OR (supplier_id IS NOT NULL AND supplier_code IS NOT NULL AND supplier_name IS NOT NULL AND supplier_version IS NOT NULL)),
      CHECK((status='DRAFT' AND approver_id IS NULL AND submitted_at IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
        OR (status='SUBMITTED' AND approver_id IS NOT NULL AND submitted_at IS NOT NULL AND decided_at IS NULL AND decision_reason IS NULL)
        OR (status IN ('APPROVED','REJECTED') AND approver_id IS NOT NULL AND submitted_at IS NOT NULL AND decided_at IS NOT NULL AND decision_reason IS NOT NULL)),
      CHECK(status<>'REJECTED' OR length(btrim(decision_reason))>=3)
    );
    CREATE TABLE erp_purchase_request_lines (
      id UUID PRIMARY KEY, request_id UUID NOT NULL REFERENCES erp_purchase_requests(id), line_no INTEGER NOT NULL CHECK(line_no BETWEEN 1 AND 100),
      item_id UUID NOT NULL REFERENCES erp_items(id), item_code VARCHAR(32) NOT NULL, item_name VARCHAR(160) NOT NULL, item_version INTEGER NOT NULL,
      unit VARCHAR(16) NOT NULL, quantity NUMERIC(15,6) NOT NULL CHECK(quantity>0), estimated_unit_price NUMERIC(14,4) NOT NULL CHECK(estimated_unit_price>=0),
      UNIQUE(request_id,line_no), UNIQUE(request_id,item_id)
    );
    CREATE INDEX erp_requests_owner ON erp_purchase_requests(requester_id,created_at DESC);
    CREATE INDEX erp_requests_approver ON erp_purchase_requests(approver_id,status,created_at DESC);
    CREATE INDEX erp_requests_status ON erp_purchase_requests(status,created_at DESC);
    CREATE TABLE erp_record_history (
      id BIGSERIAL PRIMARY KEY, entity_type TEXT NOT NULL CHECK(entity_type IN ('supplier','item','purchase_request')), entity_id UUID NOT NULL,
      version INTEGER NOT NULL CHECK(version>0), action TEXT NOT NULL, actor_id UUID NOT NULL REFERENCES erp_users(id),
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), snapshot JSONB NOT NULL,
      UNIQUE(entity_type,entity_id,version)
    );
    CREATE INDEX erp_history_record ON erp_record_history(entity_type,entity_id,id DESC);
    CREATE TRIGGER erp_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_record_history FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
    CREATE TABLE erp_operations (
      actor_id UUID NOT NULL REFERENCES erp_users(id), request_id UUID NOT NULL, operation TEXT NOT NULL,
      payload JSONB NOT NULL, response JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,request_id)
    );
  ` }, booksMigration, tradeMigration, operationsMigration, recoveryMigration, sourcingMigration, quoteWithdrawalMigration, quoteRecommendationMigration, matchingPolicyMigration, orderQuoteAwardMigration, serviceAcceptanceMigration, supplierQualificationMigration, exceptionOwnershipMigration
];

export const migrationChecksum=(sql:string)=>createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
export async function migrationStatus(pool:Pool) {
 const client=await pool.connect();
 try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const exists=(await client.query("SELECT to_regclass('erp_schema_migrations') IS NOT NULL AS exists")).rows[0].exists;
  const hasChecksum=exists && (await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='erp_schema_migrations' AND column_name='checksum'")).rowCount;
  const rows=exists?(await client.query(`SELECT version,applied_at,${hasChecksum?'checksum':'NULL::text AS checksum'} FROM erp_schema_migrations ORDER BY version`)).rows:[];
  validateVersions(rows);
  await client.query('COMMIT');
  return migrations.map(m=>{const r=rows.find(r=>r.version===m.version);return {version:m.version,state:r?'applied':'pending',checksum:migrationChecksum(m.sql),verified:!!r?.checksum,appliedAt:r?.applied_at||null};});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
function validateVersions(rows:{version:number;checksum?:string|null}[]) {
 rows.forEach((row,i)=>{
  const m=migrations[i];
  if(!m || m.version!==row.version) throw new Error('Migration history has a gap or an unknown version. Stop and investigate with the database administrator.');
  if(row.checksum && row.checksum!==migrationChecksum(m.sql)) throw new Error(`Migration ${row.version} checksum mismatch. Restore the matching release; do not edit applied migrations.`);
 });
}
export async function migrate(pool: Pool,options:{dryRun?:boolean}={}) {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='10s'");
  await client.query('SELECT pg_advisory_xact_lock(83478621)');
  await client.query('CREATE TABLE IF NOT EXISTS erp_schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), checksum TEXT)');
  await client.query('ALTER TABLE erp_schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');
  const rows=(await client.query('SELECT version,checksum FROM erp_schema_migrations ORDER BY version')).rows;
  validateVersions(rows);
  const applied=new Set(rows.map(r=>r.version)),pending:number[]=[];
  for(const m of migrations) {
   if(!applied.has(m.version)) {await client.query(m.sql);await client.query('INSERT INTO erp_schema_migrations(version,checksum) VALUES($1,$2)',[m.version,migrationChecksum(m.sql)]);pending.push(m.version);}
   else await client.query('UPDATE erp_schema_migrations SET checksum=$2 WHERE version=$1 AND checksum IS NULL',[m.version,migrationChecksum(m.sql)]);
  }
  await client.query(options.dryRun?'ROLLBACK':'COMMIT');
  return {dryRun:!!options.dryRun,pending,baselineEstablished:rows.some(r=>!r.checksum)};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
