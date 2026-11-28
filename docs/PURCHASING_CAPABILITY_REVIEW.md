# Purchasing capability review

**Reviewed:** 27 November 2026  
**Scope:** Source baseline 0.2.0 / schema 10, plus the current working-tree request overview, withdrawal, reassignment and approval queue. This is a gap assessment, not deployment or production acceptance. Capabilities depend on company size, jurisdiction and business policy; a competitor's feature list is not a universal requirement.

## Public reference points

Microsoft describes procurement from demand and requisitions through sourcing, purchase orders, receipt, invoice, payment and vendor performance, including policies, catalogs and agreements: [procurement and sourcing overview](https://learn.microsoft.com/dynamics365/supply-chain/procurement/procurement-sourcing-overview). Its [procure-to-pay overview](https://learn.microsoft.com/en-us/dynamics365/guidance/techtalks/supply-chain-procure-to-pay-overview) describes supplier quote comparison and matching, while its [invoice matching guide](https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/accounts-payable-invoice-matching) describes configurable matching policies and tolerances. These references provide comparison points, not proof that every feature is mandatory for this product.

## Capability and gap assessment

| Area | Current source | Gap and candidate acceptance |
| --- | --- | --- |
| Supplier and item data | Supplier/item records, active state, history and restricted supplier contact access. | Supplier onboarding/qualification, addresses, controlled bank details, duplicate review and supplier risk evidence need defined ownership, permissions, verification and audit. |
| Demand and requisitions | Draft, submission, independent approval, rejection, revisions and history; working-tree withdrawal/reassignment and assigned queue. | Configurable policy, thresholds, budget/cost-centre checks, delegation and notifications; prove policy snapshots, separation of duties and concurrent decisions. |
| Sourcing | Manual quotation capture, comparison and reasoned withdrawal against approved requests. No RFQ workflow or order linkage. | Request comparable supplier quotations, record submissions and select a supplier with traceability, permissions and no ledger posting. Future award must recheck the selected quote's withdrawal and validity under concurrency; agree any exception policy before implementation. Do not send external messages without a separately approved delivery design. |
| Agreements and catalogues | Basic supplier/item records only. | Approved prices, terms, validity and change control; decide whether catalogues, contract attachments and supplier self-service are in scope. |
| Orders | One order per approved request, cancellation of remaining quantities and history. | Controlled order changes and reviewed demand allocation for split/consolidated sourcing; prevent duplicated demand and preserve receipt/invoice links. |
| Receiving and quality | Partial accepted/damaged receipts; stock and GRNI for accepted stock. | Quarantine, inspection/release, disposal and supplier returns. Reconcile quantities and accounting for invoiced and uninvoiced stock. |
| Supplier invoices | Three-way match, zero price tolerance, independently accepted price variance and AP posting. | Policy-based tolerances, service/non-stock invoices, controlled corrections and linked credits/refunds; agree tax, valuation, allocation and period rules first. |
| Payment | Two independent approvals, reservations and recording of confirmed external transfers. | Bank-detail verification and change controls; any bank integration, payment files or automated transmission need separate security, financial and provider decisions. |
| Insights | Request status counts and scoped assigned queue in working tree; AP ageing and accounting controls. | Approved definitions and permission-scoped spend, supplier performance, lead time and exception reports; verify totals against source documents and ledger. |
| Operations and security | Roles, MFA, audit, backup/restore tooling and deployment guidance. | Validate least-privilege deployment, operational recovery and backup drills, access and abuse controls, accessibility, performance, signed builds and business acceptance in the actual environment. |

## Suggested delivery dependencies

1. Verify the current P2P flow and approval queue against a disposable database, including permission and concurrency tests. The local API integration suite passed on 27 November 2026 using a separate PostgreSQL 18 cluster and disposable database; this is not desktop, deployment or business acceptance. Agree pilot actors and finance reconciliation examples.
2. Specify and implement controlled supplier credits and corrections before financial return postings; independently review tax, settlement and inventory valuation rules.
3. Build on the implemented manual quotation capture/comparison with RFQs, quote award and explicit purchase-order allocation rules.
4. Add policy-driven approval, budgets and supplier payment-detail controls after business owners define limits, authority and secure change procedures.
5. Add supplier returns and quality control, then expand reporting and integrations as required by the selected deployment.

Production readiness additionally requires evidence from a staged deployment, real role/access review, recovery rehearsal, financial reconciliation and business acceptance. No present document, test fixture or source change establishes those outcomes.
