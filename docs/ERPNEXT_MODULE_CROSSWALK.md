# ERPNext module crosswalk

Reference: [ERPNext repository module list, develop branch](https://github.com/frappe/erpnext/blob/develop/erpnext/modules.txt), checked 10 November 2026. The branch can change; this is a module-level snapshot, not an exhaustive inventory of every DocType, report, integration or version-specific feature. The destination is a planning category in this application's feature map, not a claim of ERPNext compatibility or feature parity.

| ERPNext module | Our feature-map area | Current scope |
|---|---|---|
| Accounts | Finance; Banking; Reports | Partial test journals, ledger and trial balance; wider accounting planned |
| CRM | Sales & CRM | Planned |
| Buying | Purchasing | Partial test purchase requests and approvals; full procurement planned |
| Projects | Projects | Planned |
| Selling | Sales & CRM; Retail / POS | Planned |
| Setup | Administration | Test role switching and audit; company setup and production access planned |
| Manufacturing | Manufacturing | Planned |
| Stock | Inventory | Test balances, adjustments and transfers; broader stock lifecycle planned |
| Support | Quality & Service | Planned |
| Utilities | Utilities | Planned |
| Assets | Assets | Planned |
| Portal | Portal | Planned; requires an appropriate network and identity design |
| Maintenance | Maintenance; Assets | Planned |
| Regional | Tax & Compliance | Planned; jurisdiction-specific rules require validation |
| ERPNext Integrations | Integrations & EDI; Deployment | Planned; no ERPNext connector exists |
| Quality Management | Quality & Service | Planned |
| Communication | Communications | Planned |
| Telephony | Communications | Planned; provider integration required |
| Bulk Transaction | Utilities | Planned |
| Subcontracting | Subcontracting; Manufacturing | Planned |
| EDI | Integrations & EDI | Planned; trading-partner integration required |

Our map also includes HR & Payroll as a product goal. It is not in the referenced ERPNext `modules.txt` snapshot; its presence in our map does not imply it is part of that repository's module list.

The application currently remains a local, passwordless testing pilot. The module list provides planning coverage only: linked workflows, on-premises multi-user architecture, access controls, integrations, and production validation still need to be designed and implemented. ERPNext is GPL-licensed; review its [license](https://github.com/frappe/erpnext/blob/develop/license.txt) before copying or incorporating its code.
