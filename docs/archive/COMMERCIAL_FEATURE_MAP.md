# Commercial ERP capability map

Research baseline: 10 November 2026. A proposed product scope informed by official TallyPrime and ERPNext module descriptions. This is not a claim of feature parity or an exhaustive list of every commercial product feature.

Status describes this application, not the reference products. Available = implemented in this build; Partial = a limited existing control; Planned = mapped but not implemented. Priorities are proposed delivery order, not committed release dates.

| Business area | Available | Partial | Planned |
|---|---:|---:|---:|
| Finance | 3 | 0 | 7 |
| Sales & CRM | 0 | 0 | 10 |
| Purchasing | 3 | 0 | 9 |
| Inventory | 4 | 0 | 6 |
| Banking | 0 | 0 | 6 |
| Tax & Compliance | 0 | 0 | 8 |
| Manufacturing | 0 | 0 | 8 |
| Projects | 0 | 0 | 6 |
| HR & Payroll | 0 | 0 | 7 |
| Assets | 0 | 0 | 6 |
| Quality & Service | 0 | 0 | 6 |
| Retail / POS | 0 | 0 | 6 |
| Reports | 2 | 0 | 6 |
| Administration | 3 | 1 | 9 |
| Deployment | 2 | 0 | 10 |
| Portal | 0 | 0 | 4 |
| Maintenance | 0 | 0 | 4 |
| Utilities | 0 | 0 | 4 |
| Communications | 0 | 0 | 5 |
| Integrations & EDI | 0 | 0 | 4 |
| Subcontracting | 0 | 0 | 4 |

The application includes the full map with status filters, capability details and CSV export. COMMERCIAL_FEATURE_MAP.csv includes each capability, intended screen, priority, connectivity expectations, scope and acceptance gate.

See [ERPNext module crosswalk](ERPNEXT_MODULE_CROSSWALK.md) for the repository module mapping.

## Primary sources

- [TallyPrime commercial scope](https://help.tallysolutions.com/tallyprime-get-started/)
- [ERPNext module scope](https://frappe.io/erpnext/modules)
- [ERPNext manufacturing](https://docs.frappe.io/erpnext/manufacturing)

## Commercial release gates

Financial posting, tax compliance, stock valuation, enterprise identity, signed installation, LAN/server deployment and recovery guarantees remain unfinished. No country-specific compliance or enterprise readiness claim is made. Banking, e-invoicing and other external connectors will require connectivity for those connected operations; local record work is intended to remain offline.

## Delivery order

1. Company and item/customer/supplier masters, chart of accounts and controlled double-entry posting.
2. Sales invoicing, purchase orders/receipts, stock ledger and settlement reconciliation.
3. Jurisdiction-specific compliance, reporting, permissions and operational recovery.
4. Vertical modules and measured enterprise deployment.

The current passwordless test environment must never be treated as production authentication.
