export const exceptionOwnershipMigration={version:16,sql:`
ALTER TABLE erp_trade_invoices ADD COLUMN exception_owner_id UUID REFERENCES erp_users(id);
ALTER TABLE erp_trade_invoices ADD COLUMN exception_assigned_at TIMESTAMPTZ;
ALTER TABLE erp_trade_invoices ADD COLUMN exception_opened_at TIMESTAMPTZ;
ALTER TABLE erp_trade_invoices ADD CONSTRAINT erp_invoice_exception_owner_pair CHECK ((exception_owner_id IS NULL)=(exception_assigned_at IS NULL));
CREATE INDEX erp_invoice_exception_queue ON erp_trade_invoices(exception_owner_id,exception_opened_at) WHERE kind='AP' AND status='DRAFT' AND match_status='EXCEPTION';
`};
