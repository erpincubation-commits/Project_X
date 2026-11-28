export const quoteWithdrawalMigration = { version: 10, sql: `
 CREATE TABLE erp_supplier_quote_withdrawals (
  quote_id UUID PRIMARY KEY REFERENCES erp_supplier_quotes(id),
  reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 1000),
  withdrawn_by UUID NOT NULL REFERENCES erp_users(id), withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT now()
 );
 CREATE TRIGGER erp_supplier_quote_withdrawals_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_supplier_quote_withdrawals FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
` };
