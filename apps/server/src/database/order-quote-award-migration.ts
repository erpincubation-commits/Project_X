// Preserve legacy unlinked orders while making a new quote-backed order's
// provenance agree with its approved request and supplier at the database layer.
export const orderQuoteAwardMigration = { version: 13, sql: `
 CREATE UNIQUE INDEX erp_supplier_quotes_award_identity ON erp_supplier_quotes(id,request_id,supplier_id);
 ALTER TABLE erp_purchase_orders ADD COLUMN quote_id UUID;
 ALTER TABLE erp_purchase_orders ADD CONSTRAINT erp_order_quote_identity
   FOREIGN KEY(quote_id,request_id,supplier_id) REFERENCES erp_supplier_quotes(id,request_id,supplier_id);
 CREATE FUNCTION erp_preserve_order_quote_identity() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
   IF OLD.quote_id IS DISTINCT FROM NEW.quote_id OR
     (OLD.quote_id IS NOT NULL AND (OLD.request_id IS DISTINCT FROM NEW.request_id OR OLD.supplier_id IS DISTINCT FROM NEW.supplier_id)) THEN
     RAISE EXCEPTION 'Order quotation provenance cannot be changed';
   END IF;
   RETURN NEW;
 END;
 $$;
 CREATE TRIGGER erp_order_quote_identity_immutable BEFORE UPDATE OF quote_id,request_id,supplier_id ON erp_purchase_orders
   FOR EACH ROW EXECUTE FUNCTION erp_preserve_order_quote_identity();
` };
