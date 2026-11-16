export const operationsMigration = { version:7, sql:`
 CREATE TABLE erp_import_batches (
   id UUID PRIMARY KEY, actor_id UUID NOT NULL REFERENCES erp_users(id), kind TEXT NOT NULL CHECK(kind IN ('supplier','item','customer')),
   digest TEXT NOT NULL, rows JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '30 minutes',
   committed_at TIMESTAMPTZ, result JSONB
 );
 CREATE INDEX ON erp_import_batches(expires_at) WHERE committed_at IS NULL;
 CREATE TABLE erp_privacy_cases (
   id UUID PRIMARY KEY, subject_type TEXT NOT NULL CHECK(subject_type IN ('user','supplier','customer')), subject_id TEXT NOT NULL,
   kind TEXT NOT NULL CHECK(kind IN ('ACCESS','RECTIFICATION','ERASURE','RESTRICTION')), status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','COMPLETED','REFUSED','APPLIED_WITH_RETENTION')),
   verification_ref VARCHAR(300) NOT NULL, resolution_ref VARCHAR(300), legal_hold BOOLEAN NOT NULL DEFAULT false,
   version INTEGER NOT NULL DEFAULT 1, created_by UUID NOT NULL REFERENCES erp_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   received_on DATE NOT NULL CHECK(received_on<=current_date), due_at DATE GENERATED ALWAYS AS ((received_on+interval '1 month')::date) STORED
 );
 CREATE INDEX ON erp_privacy_cases(subject_type,subject_id);
 ALTER TABLE erp_users ADD COLUMN privacy_restricted BOOLEAN NOT NULL DEFAULT false;
 ALTER TABLE erp_users ADD CONSTRAINT erp_user_restriction CHECK(NOT privacy_restricted OR NOT active);
 ALTER TABLE erp_suppliers ADD COLUMN privacy_restricted BOOLEAN NOT NULL DEFAULT false;
 ALTER TABLE erp_suppliers ADD CONSTRAINT erp_supplier_restriction CHECK(NOT privacy_restricted OR NOT active);
` };
