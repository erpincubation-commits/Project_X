export const quoteRecommendationMigration = { version: 11, sql: `
 CREATE UNIQUE INDEX erp_supplier_quotes_id_request ON erp_supplier_quotes(id,request_id);
 CREATE TABLE erp_quote_recommendations (
  id UUID PRIMARY KEY, sequence BIGSERIAL UNIQUE, request_id UUID NOT NULL REFERENCES erp_purchase_requests(id),
  quote_id UUID NOT NULL, reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 1000),
  recommended_by UUID NOT NULL REFERENCES erp_users(id), recommended_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(quote_id,request_id) REFERENCES erp_supplier_quotes(id,request_id)
 );
 CREATE INDEX erp_quote_recommendations_request ON erp_quote_recommendations(request_id,sequence DESC);
 CREATE TRIGGER erp_quote_recommendations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_quote_recommendations FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
` };
