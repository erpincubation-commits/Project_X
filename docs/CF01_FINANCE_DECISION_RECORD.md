# CF-01: Finance release scope and policy decision record

**Prepared:** 17 November 2026  
**Status:** Draft for decision; not approved or accountant-reviewed. CF-01 remains open.  
**Baseline:** Source package 0.2.0 / schema 7; installed candidate and database not verified.  
**Trace:** [CF-01](CORE_FINANCE_EPIC_AND_STORIES.md#cf-01--approve-core-release-scope-and-financial-rules), FUP-07, MOD-FIN-01/02, FR-FIN-01–09.

This is a decision and evidence register, not authority to post, migrate, deploy or claim legal compliance. The examples below are synthetic proposals, independently calculated from stated assumptions; they are not accountant-approved or test results. Finance must resolve the decisions and record qualified review before using them as acceptance evidence.

## Decisions and review

| Decision | Current evidence or proposal | Decision / evidence needed |
| --- | --- | --- |
| Jurisdiction and entity | INR is the current currency, not a jurisdiction. One company per deployment. | Finance owner: select jurisdiction, entity and applicable accounting framework; qualified accountant: identify accounting and tax requirements and statutory reports, filing obligations and due dates. None selected. |
| Currency and precision | INR, two decimal money places; quantity and incoming unit cost up to six decimals. | Finance/accountant: confirm retained INR policy, any exchange or rounding requirements and gaps; foreign-currency conversion is not implemented. |
| Periods and timezone | Inclusive non-overlapping periods; posting needs an open period and a date no later than PostgreSQL's current date. | Finance/IT: select fiscal and period dates, business timezone and database/server timezone; verify date boundaries and clock synchronisation in the target environment. No timezone selected. |
| Eligible sources | Current sources are listed below. Manual control-account journals are blocked. | Finance/accountant: approve eligibility, cutover and treatment of each source, including taxable events and unsupported corrections/openings. |
| Correction and valuation | Manual journals have linked reversal; stock adjustments use current moving average, not historical cost replay. Returns, credits and refunds are not implemented. | Accountant: decide original/current cost, variance, tax, period and allocation treatment for each correction, including prior settlement; CF-05 must specify and review it. |
| Reports and exports | Existing trial balance, stock/AP/AR/GRNI reconciliation, financial statements and manual bank reconciliation are described in the user guide. | Finance: select reports, periods, filters, calculations, access and export formats; accountant: identify statutory outputs and gaps. No report/export selection or filing capability is implied. |
| Bank and budgets | Manual statement entry and exact matching exist; bank connection, bank-file matching and budgets are not implemented. | Finance/release owner: select or defer CF-19/20, bank formats and budget model. No bank format or budget selected. |
| Retention and privacy | Current privacy and backup limits are documented in [imports/privacy](IMPORTS_AND_PRIVACY.md) and [recovery](BACKUP_RESTORE.md). | Privacy, Finance and IT: decide retention by data/copy class, legal holds, backup/export lifecycle and restore replay; document authority, owners and evidence. No schedule approved. |

## Current chart and source effects

The fixed system mappings are 1100 Inventory, 1110 Bank, 1120 recoverable input tax, 1130 AR, 2100 GRNI, 2110 AP, 2120 output tax, 3100 opening equity, 4000 sales, 5100 inventory adjustment, 5110 consumption and 5120 purchase price variance/nonrecoverable purchase tax. Inventory, GRNI, AP, AR and input/output-tax controls are protected from manual journals. See [accounts and periods](ACCOUNTING_INVENTORY.md#accounts-and-periods) for types and [posting contract](ACCOUNTING_POSTINGS.md) for invariants.

| Current source / event | Debit | Credit |
| --- | --- | --- |
| Request, approval or PO | — | — |
| Stock opening | Inventory | Opening equity |
| Stock increase / decrease | Inventory / adjustment expense | Adjustment expense / Inventory, respectively |
| Consumption; transfer | Consumption expense; destination Inventory | Inventory; source Inventory, respectively |
| Accepted receipt | Inventory | GRNI |
| Matched supplier invoice | GRNI at allocated carrying value, recoverable input tax and applicable price variance/nonrecoverable tax | AP gross |
| Confirmed supplier payment | AP | Bank |
| Service/non-stock customer invoice | AR | Sales and configured output tax |
| Confirmed collection | Bank | AR |
| Manual journal reversal | Original credits | Original debits |

The invoice variance can be debit or credit depending on price difference; the table is a summary, not a complete posting specification. Configured tax is generic and does not establish statutory treatment. Receipt allocations use remaining carrying value and the final allocation takes remaining paise. Movement value rounds to nearest paise, halves away from zero; outgoing stock uses current carrying value divided by quantity, with full depletion taking the remainder. See [trade posting rules](TRADE_POSTING_RULES.md) for source limits and [posting contract](ACCOUNTING_POSTINGS.md#invariants) for exact controls.

Production gaps include jurisdiction-specific tax/filing, supplier and customer credits/refunds, returns and historical valuation replay, controlled opening migration, retention enforcement, selected exports, budgets and bank-file matching. Current stock opening alone is not a complete financial migration. Confirm further gaps against the selected policy and [CF-01–21](CORE_FINANCE_EPIC_AND_STORIES.md).

## Owners, pilot and environment

| Responsibility | Named person / review evidence |
| --- | --- |
| Finance decision owner | **Not assigned** — select policy and scope. |
| Qualified accountant | **Not assigned** — record qualifications, review date, decision and links to reviewed posting matrix and fixtures. |
| Business / release owner | **Not assigned** — accept scope, release gates and residual risks. |
| Privacy / security reviewer | **Not assigned** — review data, retention, access and recovery. |
| Customer IT / operations | **Not assigned** — confirm installation, timezones, backup, restore and support. |
| Pilot findings | **Not supplied** — attach dated financial, privacy, accessibility, recovery and workload findings, decisions and unresolved defects. The [pilot plan](NEXT_SPRINT_PLAN.md) is a proposal, not pilot evidence. |
| Target environment | **Not selected** — record candidate revision, client/server/schema versions, operating systems, PostgreSQL, network/TLS, timezone and isolated or production status; verify installed values. |

## Proposed synthetic expected results for review

All amounts are INR. These examples are hand-calculated from the assumptions here, not copied from an application run. They do not determine tax law, select a correction policy or authorize an unsupported workflow. Use unique synthetic identities, reconcile each source to controls and have the accountant review assumptions, arithmetic and expected results before using these as an oracle.

### Partial settlement — current source pattern

Assume a service invoice with net 1,000.00 and a hypothetical configured exclusive output tax of 10% (100.00). Invoice: Dr AR 1,100.00; Cr sales 1,000.00 and output tax 100.00. A confirmed collection of 400.00 gives Dr Bank 400.00 / Cr AR 400.00. The invoice and AR control remain 700.00 debit; sales and output tax remain 1,000.00 and 100.00 credit. A subsequent 701.00 allocation must be rejected as over-allocation; no posting or allocation should result. This does not assert that 10% is legally applicable.

### Correction after partial settlement — proposed, unimplemented

Using the preceding invoice and collection, assume Finance selects a 200.00 net service credit with proportional 20.00 tax reversal, applied to outstanding AR with no cash refund. Proposed linked credit: Dr sales 200.00 and output tax 20.00 / Cr AR 220.00. Expected AR is 480.00 debit (1,100.00 − 400.00 − 220.00); net sales 800.00 credit, output tax 80.00 credit, Bank 400.00 debit. Debits and credits each total 1,720.00 across all three events. The original invoice and collection remain unchanged. Accountant must decide eligibility, tax, closed-period and prior-settlement treatment; customer credits are not implemented and manual journals cannot post AR or tax controls.

### Opening — proposed coherent migration

Assume cutover opening values: stock 500.00, customer open item 300.00, bank 200.00 and supplier open item 250.00, with balancing opening equity 750.00. Expected aggregate: Dr Inventory 500.00, AR 300.00 and Bank 200.00 / Cr AP 250.00 and opening equity 750.00; each side totals 1,000.00. Stock valuation and inventory control each equal 500.00, customer detail and AR control 300.00, supplier detail and AP control 250.00, and bank and its GL balance 200.00. Opening detail must feed these totals once, not add duplicate control balances. This assumes no other assets, liabilities or tax and requires approved source detail, cutover, valuation and reconciliation policy. The current stock-opening feature alone does not implement this batch; CF-10/11 remain required.

## Scope and release decisions

No CF story is selected or deferred for a production release yet. The classifications in the [backlog](CORE_FINANCE_EPIC_AND_STORIES.md#story-map-and-traceability) are proposals, not selections. Release owner must record a decision and rationale for each of CF-01–21, including dependencies; in particular decide CF-19 budgets and CF-20 bank-file matching. Link the versioned decision here and identify any additional jurisdiction-specific work.

Before recommending release, obtain: completed decision and accountant-reviewed posting/fixture references; pilot findings and disposition; selected story and dependency evidence; reconciled source/control and independent fixture results; privacy/retention and security review; target-environment compatibility, migration, backup and isolated restore evidence; accessibility, performance and release/signing evidence; and named Finance, privacy/security, IT and business/release decisions. Use [CF-21](CORE_FINANCE_EPIC_AND_STORIES.md#cf-21--accept-the-core-release-and-recovery) and the [pilot gates](NEXT_SPRINT_PLAN.md#6-pilot-entry-and-completion) for details. Missing or rejected required evidence holds acceptance. No approval is recorded here.
