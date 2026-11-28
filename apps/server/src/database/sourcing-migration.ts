export const sourcingMigration = { version: 9, sql: `
 CREATE TABLE erp_supplier_quotes (
  id UUID PRIMARY KEY, request_id UUID NOT NULL REFERENCES erp_purchase_requests(id), request_version INTEGER NOT NULL,
  supplier_id UUID NOT NULL REFERENCES erp_suppliers(id), supplier_code TEXT NOT NULL, supplier_name TEXT NOT NULL,
  reference TEXT NOT NULL CHECK(length(btrim(reference)) BETWEEN 1 AND 100), valid_until DATE,
  currency CHAR(3) NOT NULL, created_by UUID NOT NULL REFERENCES erp_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 );
 CREATE TABLE erp_supplier_quote_lines (
  quote_id UUID NOT NULL REFERENCES erp_supplier_quotes(id), request_line_id UUID NOT NULL REFERENCES erp_purchase_request_lines(id),
  item_code TEXT NOT NULL, item_name TEXT NOT NULL, unit TEXT NOT NULL, quantity NUMERIC(18,6) NOT NULL CHECK(quantity>0),
  unit_price NUMERIC(14,4) NOT NULL CHECK(unit_price>=0), PRIMARY KEY(quote_id,request_line_id)
 );
 CREATE INDEX erp_supplier_quotes_request ON erp_supplier_quotes(request_id,created_at DESC,id DESC);
 CREATE UNIQUE INDEX erp_supplier_quotes_reference ON erp_supplier_quotes(supplier_id,lower(btrim(reference)));
 CREATE TRIGGER erp_supplier_quotes_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_supplier_quotes FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
 CREATE TRIGGER erp_supplier_quote_lines_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_supplier_quote_lines FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
` };
