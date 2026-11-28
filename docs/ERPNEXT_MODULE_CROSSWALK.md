# ERPNext inspiration and current module crosswalk

**References checked:** 17 November 2026  
**Review baseline:** 0.2.0 / schema 8 in source; see USER_GUIDE.md for the current baseline<br>
**Status:** Workflow research and proposed scope; no compatibility or feature-parity claim

ERPNext informs the integrated-document approach to the [module roadmap](ERP_MODULE_ROADMAP.md). The proposed phases, priorities and acceptance rules are our design decisions. The product retains its Electron/NestJS/PostgreSQL architecture; this crosswalk is not an installation or migration guide for ERPNext.

| Our area | Official reference | Inspiration and adaptation |
| --- | --- | --- |
| Finance | [ERPNext accounting](https://docs.frappe.io/erpnext/accounting) | Source-linked accounting and reconciliation. Extend the current INR ledger; additional budgets, dimensions and localisations require their own specifications. |
| Sales | [Selling](https://docs.frappe.io/erpnext/selling), [Sales Order](https://docs.frappe.io/erpnext/sales-order), [Delivery Note](https://docs.frappe.io/erpnext/delivery-note) | Separate commercial commitment, physical delivery, invoicing and settlement. Specify partial fulfilment while retaining current service AR. Do not assume every ERPNext sales variant will be supported. |
| CRM | [Lead](https://docs.frappe.io/erpnext/lead), [Opportunity](https://docs.frappe.io/erpnext/opportunity) | Qualification, opportunity tracking and customer handoff. CRM remains a distinct responsibility from order fulfilment; only the customer register exists here today. |
| Supply Chain | [Buying](https://docs.frappe.io/erpnext/buying), [Material Request](https://docs.frappe.io/erpnext/material-request) | Demand, sourcing and linked procurement. Our broader Supply Chain area combines purchasing, warehouse/stock and sales fulfilment; it is not a promise to reproduce one upstream module. |
| Marketing | [Campaign](https://docs.frappe.io/erpnext/campaign), [Email Campaign](https://docs.frappe.io/erpnext/email-campaign) | Campaign/source links to prospects and commercial records. Plan campaigns and eligibility first; any outbound channel is a separately specified integration. |
| HR | [Frappe HR introduction](https://docs.frappe.io/hr/introduction) | Employee, leave, attendance and expense workflows. Frappe HR has its own documentation/product scope; HR/payroll should not be inferred from an ERPNext repository module list. Our payroll is deferred pending a reviewed jurisdiction. |

[Frappe's product catalogue](https://frappe.io/products) distinguishes ERPNext, Frappe HR and Frappe CRM. This plan uses their documented workflows as references; it does not select those products as dependencies or assert identical APIs, schemas or roles. Documentation is mutable; recheck applicable upstream versions before any integration decision.

The [archived crosswalk](archive/ERPNEXT_MODULE_CROSSWALK.md) describes the retired pilot and remains historical. Its capability labels do not describe the current source. Before incorporating upstream code, inspect the applicable repository/version licences and record the reuse decision; documentation inspiration alone does not introduce an upstream runtime dependency.
