export const tradeMigration={version:6,sql:`
ALTER TABLE erp_accounts DROP CONSTRAINT erp_accounts_control_check;
ALTER TABLE erp_accounts ADD CONSTRAINT erp_accounts_control_check CHECK(control IN ('INVENTORY','GRNI','AP','BANK','TAX','OPENING','ADJUSTMENT','CONSUMPTION','VARIANCE','AR','SALES','OUTPUT_TAX'));
INSERT INTO erp_accounts(id,code,name,type,control)
 SELECT id::uuid,CASE WHEN EXISTS(SELECT 1 FROM erp_accounts a WHERE a.code=v.code) THEN 'SYS_'||v.control||'_6' ELSE v.code END,name,type,control FROM (VALUES
 ('00000000-0000-4000-8000-000000001130','1130','Accounts receivable','ASSET','AR'),
 ('00000000-0000-4000-8000-000000002120','2120','Output tax','LIABILITY','OUTPUT_TAX'),
 ('00000000-0000-4000-8000-000000004000','4000','Sales revenue','INCOME','SALES'))v(id,code,name,type,control) WHERE EXISTS(SELECT 1 FROM erp_books);
ALTER TABLE erp_journals DROP CONSTRAINT erp_journals_source_check;
ALTER TABLE erp_journals ADD CONSTRAINT erp_journals_source_check CHECK(source IN ('MANUAL','STOCK','REVERSAL','AP_INVOICE','AR_INVOICE','AP_PAYMENT','AR_COLLECTION'));
ALTER TABLE erp_journals ADD COLUMN cash_flow_category TEXT NOT NULL DEFAULT 'UNCLASSIFIED' CHECK(cash_flow_category IN ('OPERATING','INVESTING','FINANCING','UNCLASSIFIED'));
ALTER TABLE erp_stock_movements DROP CONSTRAINT erp_stock_movements_kind_check;
ALTER TABLE erp_stock_movements ADD CONSTRAINT erp_stock_movements_kind_check CHECK(kind IN ('OPENING','INCREASE','DECREASE','CONSUME','TRANSFER','COUNT','RECEIPT'));
ALTER TABLE erp_record_history DROP CONSTRAINT erp_record_history_entity_type_check;
ALTER TABLE erp_record_history ADD CONSTRAINT erp_record_history_entity_type_check CHECK(entity_type IN ('supplier','item','purchase_request','account','period','journal','warehouse','stock_movement','bank_reconciliation','books','tax','purchase_order','goods_receipt','supplier_invoice','customer_invoice','payment','collection'));
CREATE TABLE erp_tax_codes (
 id UUID PRIMARY KEY,code VARCHAR(32) UNIQUE NOT NULL,name VARCHAR(160) NOT NULL,rate NUMERIC(7,4) NOT NULL CHECK(rate BETWEEN 0 AND 100),
 recoverable BOOLEAN NOT NULL,starts_on DATE NOT NULL,ends_on DATE,active BOOLEAN NOT NULL DEFAULT true,version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),CHECK(ends_on IS NULL OR ends_on>=starts_on)
);
INSERT INTO erp_tax_codes VALUES('00000000-0000-4000-8000-000000000006','NONE','No tax',0,false,'1900-01-01',NULL,true,1);
CREATE SEQUENCE erp_order_numbers;
CREATE TABLE erp_purchase_orders (
 id UUID PRIMARY KEY,number TEXT UNIQUE NOT NULL DEFAULT('PO-'||nextval('erp_order_numbers')),request_id UUID UNIQUE NOT NULL REFERENCES erp_purchase_requests(id),
 supplier_id UUID NOT NULL REFERENCES erp_suppliers(id),supplier_code TEXT NOT NULL,supplier_name TEXT NOT NULL,date DATE NOT NULL,description VARCHAR(1000) NOT NULL,
 status TEXT NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED','CANCELLED')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_by UUID NOT NULL REFERENCES erp_users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE erp_order_lines (
 id UUID PRIMARY KEY,order_id UUID NOT NULL REFERENCES erp_purchase_orders(id),line_no INTEGER NOT NULL,item_id UUID NOT NULL REFERENCES erp_items(id),
 item_code TEXT NOT NULL,item_name TEXT NOT NULL,unit TEXT NOT NULL,quantity NUMERIC(24,6) NOT NULL CHECK(quantity>0),unit_price NUMERIC(16,6) NOT NULL CHECK(unit_price>0),UNIQUE(order_id,line_no),UNIQUE(order_id,item_id)
);
CREATE TRIGGER erp_order_lines_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_order_lines FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE SEQUENCE erp_receipt_numbers;
CREATE TABLE erp_goods_receipts (
 id UUID PRIMARY KEY,number TEXT UNIQUE NOT NULL DEFAULT('GR-'||nextval('erp_receipt_numbers')),order_id UUID NOT NULL REFERENCES erp_purchase_orders(id),
 date DATE NOT NULL,reference VARCHAR(160) NOT NULL,warehouse_id UUID NOT NULL REFERENCES erp_warehouses(id),created_by UUID NOT NULL REFERENCES erp_users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX erp_receipt_reference ON erp_goods_receipts(order_id,lower(btrim(reference)));
CREATE TABLE erp_receipt_lines (
 id UUID PRIMARY KEY,receipt_id UUID NOT NULL REFERENCES erp_goods_receipts(id),order_line_id UUID NOT NULL REFERENCES erp_order_lines(id),
 accepted NUMERIC(24,6) NOT NULL CHECK(accepted>=0),damaged NUMERIC(24,6) NOT NULL CHECK(damaged>=0),damage_reason VARCHAR(1000) NOT NULL,
 value NUMERIC(24,2) NOT NULL CHECK(value>=0),movement_id UUID UNIQUE REFERENCES erp_stock_movements(id) DEFERRABLE INITIALLY DEFERRED,
 UNIQUE(receipt_id,order_line_id),CHECK(accepted+damaged>0),CHECK(damaged=0 OR length(btrim(damage_reason))>=3),CHECK((accepted>0)=(movement_id IS NOT NULL))
);
ALTER TABLE erp_stock_movements ADD COLUMN receipt_line_id UUID UNIQUE REFERENCES erp_receipt_lines(id);
CREATE TRIGGER erp_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_goods_receipts FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_receipt_line_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_receipt_lines FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE SEQUENCE erp_invoice_numbers;
CREATE TABLE erp_trade_invoices (
 id UUID PRIMARY KEY,number TEXT UNIQUE NOT NULL DEFAULT('INV-'||nextval('erp_invoice_numbers')),kind TEXT NOT NULL CHECK(kind IN ('AP','AR')),reference VARCHAR(160) NOT NULL,
 supplier_id UUID REFERENCES erp_suppliers(id),customer_code VARCHAR(32) REFERENCES erp_customers(code),order_id UUID REFERENCES erp_purchase_orders(id),party_name TEXT NOT NULL,
 date DATE NOT NULL,due_date DATE NOT NULL CHECK(due_date>=date),description VARCHAR(1000) NOT NULL,status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','VOID')),
 match_status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK(match_status IN ('UNMATCHED','MATCHED','EXCEPTION')),match_result JSONB NOT NULL DEFAULT '[]',variance_approved_by UUID REFERENCES erp_users(id),
 net NUMERIC(24,2) NOT NULL DEFAULT 0 CHECK(net>=0),tax NUMERIC(24,2) NOT NULL DEFAULT 0 CHECK(tax>=0),gross NUMERIC(24,2) NOT NULL DEFAULT 0 CHECK(gross=net+tax AND gross>=0),
 created_by UUID NOT NULL REFERENCES erp_users(id),journal_id UUID UNIQUE REFERENCES erp_journals(id),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((kind='AP' AND supplier_id IS NOT NULL AND order_id IS NOT NULL AND customer_code IS NULL) OR (kind='AR' AND customer_code IS NOT NULL AND supplier_id IS NULL AND order_id IS NULL)),
 CHECK((status='POSTED')=(journal_id IS NOT NULL)),CHECK(variance_approved_by IS NULL OR variance_approved_by<>created_by)
);
CREATE UNIQUE INDEX erp_ap_invoice_reference ON erp_trade_invoices(supplier_id,lower(btrim(reference))) WHERE kind='AP';
CREATE UNIQUE INDEX erp_ar_invoice_reference ON erp_trade_invoices(customer_code,lower(btrim(reference))) WHERE kind='AR';
CREATE TABLE erp_trade_invoice_lines (
 id UUID PRIMARY KEY,invoice_id UUID NOT NULL REFERENCES erp_trade_invoices(id),line_no INTEGER NOT NULL,description VARCHAR(160) NOT NULL,
 order_line_id UUID REFERENCES erp_order_lines(id),receipt_line_id UUID REFERENCES erp_receipt_lines(id),quantity NUMERIC(24,6) NOT NULL CHECK(quantity>0),unit_price NUMERIC(16,6) NOT NULL CHECK(unit_price>=0),
 tax_id UUID NOT NULL REFERENCES erp_tax_codes(id),tax_version INTEGER NOT NULL,tax_code TEXT NOT NULL,tax_rate NUMERIC(7,4) NOT NULL CHECK(tax_rate BETWEEN 0 AND 100),recoverable BOOLEAN NOT NULL,
 net NUMERIC(24,2) NOT NULL CHECK(net>=0),tax NUMERIC(24,2) NOT NULL CHECK(tax>=0),grni_value NUMERIC(24,2) CHECK(grni_value>=0),UNIQUE(invoice_id,line_no),UNIQUE(invoice_id,receipt_line_id)
);
CREATE INDEX erp_invoice_receipt ON erp_trade_invoice_lines(receipt_line_id);
CREATE FUNCTION erp_guard_invoice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='erp_trade_invoices' THEN IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'Posted and void invoices are immutable'; END IF;
 ELSE IF EXISTS(SELECT 1 FROM erp_trade_invoices WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END AND status<>'DRAFT') OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM erp_trade_invoices WHERE id=OLD.invoice_id AND status<>'DRAFT')) THEN RAISE EXCEPTION 'Posted and void invoice lines are immutable'; END IF;
 END IF;IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END; $$;
CREATE TRIGGER erp_invoice_immutable BEFORE UPDATE OR DELETE ON erp_trade_invoices FOR EACH ROW EXECUTE FUNCTION erp_guard_invoice();
CREATE TRIGGER erp_invoice_lines_immutable BEFORE INSERT OR UPDATE OR DELETE ON erp_trade_invoice_lines FOR EACH ROW EXECUTE FUNCTION erp_guard_invoice();
CREATE SEQUENCE erp_payment_numbers;
CREATE TABLE erp_payments (
 id UUID PRIMARY KEY,number TEXT UNIQUE NOT NULL DEFAULT('PAY-'||nextval('erp_payment_numbers')),supplier_id UUID NOT NULL REFERENCES erp_suppliers(id),date DATE NOT NULL,description VARCHAR(1000) NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','EXECUTED','CANCELLED')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),round INTEGER NOT NULL DEFAULT 1,
 created_by UUID NOT NULL REFERENCES erp_users(id),approver_one UUID NOT NULL REFERENCES erp_users(id),approver_two UUID NOT NULL REFERENCES erp_users(id),
 total NUMERIC(24,2) NOT NULL CHECK(total>0),reference VARCHAR(160),execution_date DATE,journal_id UUID UNIQUE REFERENCES erp_journals(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(approver_one<>approver_two AND approver_one<>created_by AND approver_two<>created_by),
 CHECK((status='EXECUTED')=(journal_id IS NOT NULL AND reference IS NOT NULL AND execution_date IS NOT NULL))
);
CREATE TABLE erp_payment_allocations(payment_id UUID NOT NULL REFERENCES erp_payments(id),invoice_id UUID NOT NULL REFERENCES erp_trade_invoices(id),amount NUMERIC(24,2) NOT NULL CHECK(amount>0),PRIMARY KEY(payment_id,invoice_id));
CREATE INDEX erp_payment_invoice ON erp_payment_allocations(invoice_id);
CREATE TABLE erp_payment_decisions(payment_id UUID NOT NULL REFERENCES erp_payments(id),round INTEGER NOT NULL,actor_id UUID NOT NULL REFERENCES erp_users(id),decision TEXT NOT NULL CHECK(decision IN ('APPROVED','REJECTED')),reason VARCHAR(1000) NOT NULL,occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(payment_id,round,actor_id));
CREATE TRIGGER erp_payment_decisions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_payment_decisions FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE FUNCTION erp_guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='erp_payments' THEN IF OLD.status IN ('EXECUTED','CANCELLED') THEN RAISE EXCEPTION 'Executed and cancelled payments are immutable'; END IF;
 ELSE IF EXISTS(SELECT 1 FROM erp_payments WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.payment_id ELSE NEW.payment_id END AND status NOT IN ('DRAFT','REJECTED')) OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM erp_payments WHERE id=OLD.payment_id AND status NOT IN ('DRAFT','REJECTED'))) THEN RAISE EXCEPTION 'Submitted payment allocations are immutable'; END IF;
 END IF;IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END; $$;
CREATE TRIGGER erp_payment_immutable BEFORE UPDATE OR DELETE ON erp_payments FOR EACH ROW EXECUTE FUNCTION erp_guard_payment();
CREATE TRIGGER erp_payment_allocation_immutable BEFORE INSERT OR UPDATE OR DELETE ON erp_payment_allocations FOR EACH ROW EXECUTE FUNCTION erp_guard_payment();
CREATE SEQUENCE erp_collection_numbers;
CREATE TABLE erp_collections(id UUID PRIMARY KEY,number TEXT UNIQUE NOT NULL DEFAULT('COL-'||nextval('erp_collection_numbers')),customer_code VARCHAR(32) NOT NULL REFERENCES erp_customers(code),date DATE NOT NULL,reference VARCHAR(160) NOT NULL,description VARCHAR(1000) NOT NULL,total NUMERIC(24,2) NOT NULL CHECK(total>0),journal_id UUID UNIQUE NOT NULL REFERENCES erp_journals(id),created_by UUID NOT NULL REFERENCES erp_users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE erp_collection_allocations(collection_id UUID NOT NULL REFERENCES erp_collections(id),invoice_id UUID NOT NULL REFERENCES erp_trade_invoices(id),amount NUMERIC(24,2) NOT NULL CHECK(amount>0),PRIMARY KEY(collection_id,invoice_id));
CREATE TABLE erp_bank_execution_refs(reference TEXT PRIMARY KEY,journal_id UUID UNIQUE NOT NULL REFERENCES erp_journals(id));
CREATE TRIGGER erp_collection_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_collections FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_collection_allocations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_collection_allocations FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_bank_refs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_bank_execution_refs FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_invoice_no_truncate BEFORE TRUNCATE ON erp_trade_invoices FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_invoice_lines_no_truncate BEFORE TRUNCATE ON erp_trade_invoice_lines FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_payments_no_truncate BEFORE TRUNCATE ON erp_payments FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_payment_allocations_no_truncate BEFORE TRUNCATE ON erp_payment_allocations FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE FUNCTION erp_trade_reconciliation(cutoff DATE) RETURNS TABLE(control TEXT,subledger NUMERIC,ledger NUMERIC,difference NUMERIC) LANGUAGE SQL STABLE AS $$
 WITH source AS (
 SELECT 'AP' AS control,coalesce((SELECT sum(gross) FROM erp_trade_invoices WHERE kind='AP' AND status='POSTED' AND date<=cutoff),0)-coalesce((SELECT sum(a.amount) FROM erp_payment_allocations a JOIN erp_payments p ON p.id=a.payment_id WHERE p.status='EXECUTED' AND p.execution_date<=cutoff),0) AS value
 UNION ALL SELECT 'AR',coalesce((SELECT sum(gross) FROM erp_trade_invoices WHERE kind='AR' AND status='POSTED' AND date<=cutoff),0)-coalesce((SELECT sum(a.amount) FROM erp_collection_allocations a JOIN erp_collections c ON c.id=a.collection_id WHERE c.date<=cutoff),0)
 UNION ALL SELECT 'GRNI',coalesce((SELECT sum(l.value) FROM erp_receipt_lines l JOIN erp_goods_receipts r ON r.id=l.receipt_id WHERE r.date<=cutoff),0)-coalesce((SELECT sum(l.grni_value) FROM erp_trade_invoice_lines l JOIN erp_trade_invoices i ON i.id=l.invoice_id WHERE i.status='POSTED' AND i.kind='AP' AND i.date<=cutoff),0)
 ),gl AS (SELECT a.control,coalesce(sum(CASE WHEN a.control='AR' THEN l.debit-l.credit ELSE l.credit-l.debit END) FILTER(WHERE j.status='POSTED' AND j.date<=cutoff),0) AS value FROM erp_accounts a LEFT JOIN erp_journal_lines l ON l.account_id=a.id LEFT JOIN erp_journals j ON j.id=l.journal_id WHERE a.control IN ('AP','AR','GRNI') GROUP BY a.control)
 SELECT s.control,s.value,coalesce(g.value,0),s.value-coalesce(g.value,0) FROM source s LEFT JOIN gl g ON g.control=s.control;
$$;
`};
