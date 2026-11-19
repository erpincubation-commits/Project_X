export const recoveryMigration = { version: 8, sql: `
 CREATE TABLE erp_identity_recoveries (
  id UUID PRIMARY KEY, subject_id UUID NOT NULL REFERENCES erp_users(id),
  requested_by UUID NOT NULL REFERENCES erp_users(id), requested_version INTEGER NOT NULL,
  subject_version INTEGER NOT NULL, approved_by UUID REFERENCES erp_users(id), approved_version INTEGER,
  token_hash TEXT UNIQUE, status TEXT NOT NULL CHECK(status IN ('PENDING','ISSUED','COMPLETED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ,
  CHECK(subject_id<>requested_by), CHECK(approved_by IS NULL OR (approved_by<>subject_id AND approved_by<>requested_by))
 );
 CREATE INDEX erp_identity_recoveries_subject ON erp_identity_recoveries(subject_id,status);
` };
