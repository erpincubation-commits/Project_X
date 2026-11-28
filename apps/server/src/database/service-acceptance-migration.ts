// Service lines are distinct from stocked lines. This migration is deliberately
// not registered until the acceptance, invoicing, permissions and upgrade paths
// are integrated and verified together.
export const serviceAcceptanceMigration={version:14,sql:`
ALTER TABLE erp_items ADD COLUMN item_kind TEXT NOT NULL DEFAULT 'STOCK' CHECK(item_kind IN ('STOCK','SERVICE'));
ALTER TABLE erp_items ADD COLUMN service_expense_account_id UUID REFERENCES erp_accounts(id);
ALTER TABLE erp_items ADD CONSTRAINT erp_item_service_account CHECK ((item_kind='STOCK' AND service_expense_account_id IS NULL) OR (item_kind='SERVICE' AND service_expense_account_id IS NOT NULL));
ALTER TABLE erp_purchase_request_lines ADD COLUMN item_kind TEXT NOT NULL DEFAULT 'STOCK' CHECK(item_kind IN ('STOCK','SERVICE'));
ALTER TABLE erp_purchase_request_lines ADD COLUMN service_expense_account_id UUID REFERENCES erp_accounts(id);
ALTER TABLE erp_purchase_request_lines ADD CONSTRAINT erp_request_line_service_account CHECK ((item_kind='STOCK' AND service_expense_account_id IS NULL) OR (item_kind='SERVICE' AND service_expense_account_id IS NOT NULL));
ALTER TABLE erp_order_lines ADD COLUMN item_kind TEXT NOT NULL DEFAULT 'STOCK' CHECK(item_kind IN ('STOCK','SERVICE'));
ALTER TABLE erp_order_lines ADD COLUMN service_expense_account_id UUID REFERENCES erp_accounts(id);
ALTER TABLE erp_order_lines ADD CONSTRAINT erp_order_line_service_account CHECK ((item_kind='STOCK' AND service_expense_account_id IS NULL) OR (item_kind='SERVICE' AND service_expense_account_id IS NOT NULL));
ALTER TABLE erp_journals DROP CONSTRAINT erp_journals_source_check;
ALTER TABLE erp_journals ADD CONSTRAINT erp_journals_source_check CHECK(source IN ('MANUAL','STOCK','REVERSAL','AP_INVOICE','AR_INVOICE','AP_PAYMENT','AR_COLLECTION','SERVICE_ACCEPTANCE'));
ALTER TABLE erp_record_history DROP CONSTRAINT erp_record_history_entity_type_check;
ALTER TABLE erp_record_history ADD CONSTRAINT erp_record_history_entity_type_check CHECK(entity_type IN ('supplier','item','purchase_request','account','period','journal','warehouse','stock_movement','bank_reconciliation','books','tax','purchase_order','goods_receipt','supplier_invoice','customer_invoice','payment','collection','service_acceptance'));
CREATE SEQUENCE erp_service_acceptance_numbers;
CREATE TABLE erp_service_acceptances (
 id UUID PRIMARY KEY, number TEXT UNIQUE NOT NULL DEFAULT('SA-'||nextval('erp_service_acceptance_numbers')),
 order_id UUID NOT NULL REFERENCES erp_purchase_orders(id), date DATE NOT NULL, reference VARCHAR(160) NOT NULL CHECK(length(btrim(reference))>0),
 evidence VARCHAR(1000) NOT NULL CHECK(length(btrim(evidence))>=3), accepted_by UUID NOT NULL REFERENCES erp_users(id),
 journal_id UUID NOT NULL UNIQUE REFERENCES erp_journals(id) DEFERRABLE INITIALLY DEFERRED, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX erp_service_acceptance_reference ON erp_service_acceptances(order_id,lower(btrim(reference)));
CREATE TABLE erp_service_acceptance_lines (
 id UUID PRIMARY KEY, acceptance_id UUID NOT NULL REFERENCES erp_service_acceptances(id),
 order_line_id UUID NOT NULL REFERENCES erp_order_lines(id), quantity NUMERIC(24,6) NOT NULL CHECK(quantity>0),
 value NUMERIC(24,2) NOT NULL CHECK(value>0), expense_account_id UUID NOT NULL REFERENCES erp_accounts(id),
 UNIQUE(acceptance_id,order_line_id)
);
CREATE TRIGGER erp_service_acceptances_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_service_acceptances FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_service_acceptance_lines_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_service_acceptance_lines FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
ALTER TABLE erp_trade_invoice_lines ADD COLUMN service_acceptance_line_id UUID REFERENCES erp_service_acceptance_lines(id);
ALTER TABLE erp_trade_invoice_lines ADD CONSTRAINT erp_invoice_single_acceptance_source CHECK (receipt_line_id IS NULL OR service_acceptance_line_id IS NULL);
CREATE OR REPLACE FUNCTION erp_trade_reconciliation(cutoff DATE) RETURNS TABLE(control TEXT,subledger NUMERIC,ledger NUMERIC,difference NUMERIC) LANGUAGE SQL STABLE AS $$
 WITH source AS (
 SELECT 'AP' AS control,coalesce((SELECT sum(gross) FROM erp_trade_invoices WHERE kind='AP' AND status='POSTED' AND date<=cutoff),0)-coalesce((SELECT sum(a.amount) FROM erp_payment_allocations a JOIN erp_payments p ON p.id=a.payment_id WHERE p.status='EXECUTED' AND p.execution_date<=cutoff),0) AS value
 UNION ALL SELECT 'AR',coalesce((SELECT sum(gross) FROM erp_trade_invoices WHERE kind='AR' AND status='POSTED' AND date<=cutoff),0)-coalesce((SELECT sum(a.amount) FROM erp_collection_allocations a JOIN erp_collections c ON c.id=a.collection_id WHERE c.date<=cutoff),0)
 UNION ALL SELECT 'GRNI',coalesce((SELECT sum(l.value) FROM erp_receipt_lines l JOIN erp_goods_receipts r ON r.id=l.receipt_id WHERE r.date<=cutoff),0)+coalesce((SELECT sum(l.value) FROM erp_service_acceptance_lines l JOIN erp_service_acceptances a ON a.id=l.acceptance_id WHERE a.date<=cutoff),0)-coalesce((SELECT sum(l.grni_value) FROM erp_trade_invoice_lines l JOIN erp_trade_invoices i ON i.id=l.invoice_id WHERE i.status='POSTED' AND i.kind='AP' AND i.date<=cutoff),0)
 ),gl AS (SELECT a.control,coalesce(sum(CASE WHEN a.control='AR' THEN l.debit-l.credit ELSE l.credit-l.debit END) FILTER(WHERE j.status='POSTED' AND j.date<=cutoff),0) AS value FROM erp_accounts a LEFT JOIN erp_journal_lines l ON l.account_id=a.id LEFT JOIN erp_journals j ON j.id=l.journal_id WHERE a.control IN ('AP','AR','GRNI') GROUP BY a.control)
 SELECT s.control,s.value,coalesce(g.value,0),s.value-coalesce(g.value,0) FROM source s LEFT JOIN gl g ON g.control=s.control;
$$;
`};
