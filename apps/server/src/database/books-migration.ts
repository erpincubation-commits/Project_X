export const booksMigration = { version: 5, sql: `
ALTER TABLE erp_users DROP CONSTRAINT erp_users_role_check;
ALTER TABLE erp_users ADD CONSTRAINT erp_users_role_check CHECK(role IN ('admin','reader','identity_admin','auditor','requester','business_approver','purchasing','accountant','inventory_manager'));
ALTER TABLE erp_record_history DROP CONSTRAINT erp_record_history_entity_type_check;
ALTER TABLE erp_record_history ADD CONSTRAINT erp_record_history_entity_type_check CHECK(entity_type IN ('supplier','item','purchase_request','account','period','journal','warehouse','stock_movement','bank_reconciliation','books'));
CREATE TABLE erp_accounts (
 id UUID PRIMARY KEY, code VARCHAR(32) UNIQUE NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'), name VARCHAR(160) NOT NULL CHECK(length(btrim(name))>0),
 type TEXT NOT NULL CHECK(type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
 control TEXT UNIQUE CHECK(control IN ('INVENTORY','GRNI','AP','BANK','TAX','OPENING','ADJUSTMENT','CONSUMPTION','VARIANCE')),
 active BOOLEAN NOT NULL DEFAULT true, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE erp_books (
 singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton), currency TEXT NOT NULL CHECK(currency='INR'),
 valuation TEXT NOT NULL CHECK(valuation='MOVING_AVERAGE'), created_by UUID NOT NULL REFERENCES erp_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER erp_books_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_books FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TABLE erp_periods (
 id UUID PRIMARY KEY, name VARCHAR(160) NOT NULL, starts_on DATE NOT NULL, ends_on DATE NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), CHECK(starts_on<=ends_on), EXCLUDE USING gist (daterange(starts_on,ends_on,'[]') WITH &&)
);
CREATE SEQUENCE erp_journal_numbers;
CREATE TABLE erp_journals (
 id UUID PRIMARY KEY, number TEXT UNIQUE NOT NULL DEFAULT ('J-'||nextval('erp_journal_numbers')::text), date DATE NOT NULL, description VARCHAR(1000) NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED')), source TEXT NOT NULL CHECK(source IN ('MANUAL','STOCK','REVERSAL')),
 source_id UUID, reversed_of UUID UNIQUE REFERENCES erp_journals(id), created_by UUID NOT NULL REFERENCES erp_users(id), posted_by UUID REFERENCES erp_users(id), posted_at TIMESTAMPTZ,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(source,source_id), CHECK((status='DRAFT' AND posted_at IS NULL AND posted_by IS NULL) OR (status='POSTED' AND posted_at IS NOT NULL AND posted_by IS NOT NULL)),
 CHECK((source='REVERSAL')=(reversed_of IS NOT NULL))
);
CREATE TABLE erp_journal_lines (
 id UUID PRIMARY KEY, journal_id UUID NOT NULL REFERENCES erp_journals(id), line_no INTEGER NOT NULL CHECK(line_no BETWEEN 1 AND 100), account_id UUID NOT NULL REFERENCES erp_accounts(id),
 debit NUMERIC(24,2) NOT NULL DEFAULT 0, credit NUMERIC(24,2) NOT NULL DEFAULT 0, memo VARCHAR(200) NOT NULL DEFAULT '',
 CHECK((debit>0 AND credit=0) OR (credit>0 AND debit=0)), UNIQUE(journal_id,line_no)
);
CREATE INDEX erp_journal_dates ON erp_journals(date,status);
CREATE INDEX erp_journal_account ON erp_journal_lines(account_id,journal_id);
CREATE FUNCTION erp_guard_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='POSTED' THEN RAISE EXCEPTION 'Posted journals are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER erp_journal_immutable BEFORE UPDATE OR DELETE ON erp_journals FOR EACH ROW EXECUTE FUNCTION erp_guard_journal();
CREATE FUNCTION erp_guard_journal_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM erp_journals WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.journal_id ELSE NEW.journal_id END AND status='POSTED')
 OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM erp_journals WHERE id=OLD.journal_id AND status='POSTED')) THEN RAISE EXCEPTION 'Posted journal lines are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER erp_journal_line_immutable BEFORE INSERT OR UPDATE OR DELETE ON erp_journal_lines FOR EACH ROW EXECUTE FUNCTION erp_guard_journal_line();
CREATE TRIGGER erp_journal_no_truncate BEFORE TRUNCATE ON erp_journals FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_journal_lines_no_truncate BEFORE TRUNCATE ON erp_journal_lines FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE FUNCTION erp_check_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE jid UUID; n BIGINT; d NUMERIC; c NUMERIC;
BEGIN
 jid:=NEW.id;
 IF EXISTS(SELECT 1 FROM erp_journals WHERE id=jid AND status='POSTED') THEN
  SELECT count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) INTO n,d,c FROM erp_journal_lines WHERE journal_id=jid;
  IF n<2 OR d<=0 OR d<>c THEN RAISE EXCEPTION 'Journal must have balanced nonzero debit and credit lines'; END IF;
  IF NOT EXISTS(SELECT 1 FROM erp_periods p JOIN erp_journals j ON j.id=jid AND j.date BETWEEN p.starts_on AND p.ends_on WHERE p.status='OPEN') THEN RAISE EXCEPTION 'Posting period must be open'; END IF;
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER erp_journal_balance AFTER INSERT OR UPDATE ON erp_journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_check_balanced_journal();
CREATE TABLE erp_warehouses (
 id UUID PRIMARY KEY, code VARCHAR(32) UNIQUE NOT NULL CHECK(code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'), name VARCHAR(160) NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE erp_stock_balances (
 item_id UUID NOT NULL REFERENCES erp_items(id), warehouse_id UUID NOT NULL REFERENCES erp_warehouses(id), quantity NUMERIC(24,6) NOT NULL DEFAULT 0 CHECK(quantity>=0),
 value NUMERIC(24,2) NOT NULL DEFAULT 0 CHECK(value>=0), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), PRIMARY KEY(item_id,warehouse_id), CHECK(quantity<>0 OR value=0)
);
CREATE SEQUENCE erp_stock_numbers;
CREATE TABLE erp_stock_movements (
 id UUID PRIMARY KEY, sequence BIGINT UNIQUE NOT NULL DEFAULT nextval('erp_stock_numbers'), kind TEXT NOT NULL CHECK(kind IN ('OPENING','INCREASE','DECREASE','CONSUME','TRANSFER','COUNT')),
 date DATE NOT NULL, reason VARCHAR(1000) NOT NULL CHECK(length(btrim(reason))>=3), item_id UUID NOT NULL REFERENCES erp_items(id),
 quantity NUMERIC(24,6) NOT NULL CHECK(quantity>0), value NUMERIC(24,2) NOT NULL CHECK(value>=0),
 warehouse_id UUID NOT NULL REFERENCES erp_warehouses(id), destination_id UUID REFERENCES erp_warehouses(id), journal_id UUID UNIQUE REFERENCES erp_journals(id),
 actor_id UUID NOT NULL REFERENCES erp_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK((kind='TRANSFER')=(destination_id IS NOT NULL)), CHECK(destination_id IS NULL OR destination_id<>warehouse_id)
);
CREATE TABLE erp_stock_entries (
 movement_id UUID NOT NULL REFERENCES erp_stock_movements(id), warehouse_id UUID NOT NULL REFERENCES erp_warehouses(id), item_id UUID NOT NULL REFERENCES erp_items(id),
 quantity NUMERIC(24,6) NOT NULL CHECK(quantity<>0), value NUMERIC(24,2) NOT NULL, PRIMARY KEY(movement_id,warehouse_id)
);
CREATE INDEX erp_stock_valuation ON erp_stock_entries(item_id,warehouse_id);
CREATE TRIGGER erp_stock_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_stock_movements FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_stock_entry_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON erp_stock_entries FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TABLE erp_bank_reconciliations (
 id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES erp_accounts(id), starts_on DATE NOT NULL, ends_on DATE NOT NULL CHECK(ends_on>=starts_on),
 opening NUMERIC(24,2) NOT NULL, closing NUMERIC(24,2) NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINALISED')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_by UUID NOT NULL REFERENCES erp_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE erp_bank_statement_lines (
 id UUID PRIMARY KEY, reconciliation_id UUID NOT NULL REFERENCES erp_bank_reconciliations(id), date DATE NOT NULL, reference VARCHAR(160) NOT NULL,
 amount NUMERIC(24,2) NOT NULL CHECK(amount<>0), journal_line_id UUID UNIQUE REFERENCES erp_journal_lines(id)
);
CREATE FUNCTION erp_guard_bank_reconciliation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='erp_bank_reconciliations' THEN
  IF OLD.status='FINALISED' THEN RAISE EXCEPTION 'Finalised reconciliations are immutable'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM erp_bank_reconciliations WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.reconciliation_id ELSE NEW.reconciliation_id END AND status='FINALISED')
  OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM erp_bank_reconciliations WHERE id=OLD.reconciliation_id AND status='FINALISED')) THEN RAISE EXCEPTION 'Finalised statement lines are immutable'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER erp_bank_immutable BEFORE UPDATE OR DELETE ON erp_bank_reconciliations FOR EACH ROW EXECUTE FUNCTION erp_guard_bank_reconciliation();
CREATE TRIGGER erp_bank_lines_immutable BEFORE INSERT OR UPDATE OR DELETE ON erp_bank_statement_lines FOR EACH ROW EXECUTE FUNCTION erp_guard_bank_reconciliation();
CREATE TRIGGER erp_bank_no_truncate BEFORE TRUNCATE ON erp_bank_reconciliations FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
CREATE TRIGGER erp_bank_lines_no_truncate BEFORE TRUNCATE ON erp_bank_statement_lines FOR EACH STATEMENT EXECUTE FUNCTION erp_reject_audit_change();
` };
