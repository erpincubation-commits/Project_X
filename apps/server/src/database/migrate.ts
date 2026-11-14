import type { Pool } from 'pg';

const migrations = [
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
  ` }
];

export async function migrate(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(83478621)');
    await client.query('CREATE TABLE IF NOT EXISTS erp_schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const applied = new Set((await client.query<{ version: number }>('SELECT version FROM erp_schema_migrations')).rows.map(row => row.version));
    if ([...applied].some(version => !migrations.some(migration => migration.version === version))) throw new Error('The database schema is newer than this application.');
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO erp_schema_migrations(version) VALUES($1)', [migration.version]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
