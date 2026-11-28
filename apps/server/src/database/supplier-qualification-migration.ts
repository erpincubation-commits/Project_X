export const supplierQualificationMigration={version:15,sql:`
CREATE TABLE erp_supplier_qualifications (
  supplier_id UUID PRIMARY KEY REFERENCES erp_suppliers(id),
  registration_reference VARCHAR(100) NOT NULL,
  evidence_reference VARCHAR(100) NOT NULL,
  valid_until DATE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  review_note VARCHAR(500),
  submitted_by UUID NOT NULL REFERENCES erp_users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES erp_users(id),
  reviewed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  CHECK ((status='PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL)
    OR (status<>'PENDING' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND reviewed_by<>submitted_by))
);
CREATE INDEX erp_supplier_qualification_expiry ON erp_supplier_qualifications(valid_until) WHERE status='APPROVED';
CREATE TABLE erp_supplier_qualification_history (
  id BIGSERIAL PRIMARY KEY, supplier_id UUID NOT NULL REFERENCES erp_suppliers(id), version INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('SUBMITTED','APPROVED','REJECTED')),
  actor_id UUID NOT NULL REFERENCES erp_users(id), occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL, UNIQUE(supplier_id,version)
);
CREATE TRIGGER erp_supplier_qualification_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_supplier_qualification_history FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
`};
