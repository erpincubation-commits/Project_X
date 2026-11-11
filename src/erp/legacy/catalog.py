"""Commercial capability map. Status is this application's implementation status."""
MODULES = [
    ("Finance", "Accounts, controls and financial statements", "Chart of accounts;Journal vouchers;Receipts and payments;General ledger;Trial balance;Profit and loss;Balance sheet;Period closing;Cost centres and budgets;Foreign currency and exchange gains"),
    ("Sales & CRM", "Lead to collection", "Customer master;Leads and opportunities;Quotations;Sales orders;Delivery notes;Sales invoices;Credit notes and returns;Receivables ageing;Credit limits;Pricing and discounts"),
    ("Purchasing", "Request to supplier payment", "Supplier master;Purchase requisition lines;RFQs and supplier quotations;Purchase orders;Goods receipt;Three-way matching;Supplier invoices;Purchase returns;Payables ageing"),
    ("Inventory", "Stock control and traceability", "Item master and units;Warehouses and bins;Opening stock;Stock transfers;Stock adjustments;Reorder planning;Serial and batch tracking;Expiry tracking;FIFO and weighted-average valuation;Stock reconciliation"),
    ("Banking", "Cash visibility and reconciliation", "Bank accounts;Statement import;Bank reconciliation;Cheque management;Payment advice;Connected banking"),
    ("Tax & Compliance", "Jurisdiction-specific compliance", "Tax registration and rates;GST invoice rules;Input tax credit reconciliation;GST return preparation;E-invoice connector;E-way bill connector;TDS and TCS;Tax audit exports"),
    ("Manufacturing", "Plan and execute production", "Bills of materials;Routings and workstations;Material requirements planning;Work orders;Job cards;Work in progress;Subcontracting;Production costing"),
    ("Projects", "Delivery and project economics", "Project master;Tasks and milestones;Timesheets;Project budgets;Project billing;Project profitability"),
    ("HR & Payroll", "People, attendance and payroll", "Employee master;Attendance;Leave management;Salary structures;Payroll processing;Expense claims;Payroll statutory reports"),
    ("Assets", "Acquire, depreciate and retire assets", "Asset register;Capitalisation;Depreciation schedules;Asset transfers;Maintenance schedules;Asset disposal"),
    ("Quality & Service", "Inspections and customer service", "Inspection templates;Incoming and outgoing inspection;Nonconformance;Corrective action;Support tickets;Warranty and service contracts"),
    ("Retail / POS", "Counter sales and shift operations", "Billing counter;Barcode scanning;Cash shifts;Retail returns;Receipt printing;Store stock integration"),
    ("Reports", "Operational and management reporting", "Financial statements;Cash-flow reports;Stock ageing;Sales and margin analysis;Report designer;Scheduled reports"),
    ("Administration", "Company, access and business controls", "Company master;Multi-company isolation;Fiscal years;Approval limits;User lifecycle management;Password reset;SSO and MFA;Document attachments;Import validation"),
    ("Deployment", "Packaging, recovery and operations", "Signed Windows installer;Automatic upgrades and rollback;Customer LAN server;Multi-user concurrency sizing;Disconnected endpoint synchronisation;Encrypted backups;Scheduled backup and restore drills;Monitoring and diagnostics;API and ERPNext integration;License and update lifecycle"),
    ("Portal", "Customer and supplier self-service", "Customer portal;Supplier portal;Portal identity and access;Document visibility and requests"),
    ("Maintenance", "Equipment maintenance and service", "Maintenance schedules;Maintenance visits;Equipment service history;Maintenance requests"),
    ("Utilities", "Operational tools and bulk data", "Data import and validation;Data export;Bulk document processing;Bulk status updates"),
    ("Communications", "Business communications and telephony", "Communication history;Email integration;Notifications and templates;Telephony integration;Call logs"),
    ("Integrations & EDI", "External systems and electronic documents", "Integration settings and credentials;External service connectors;EDI document exchange;EDI validation and acknowledgements"),
    ("Subcontracting", "Outsourced production lifecycle", "Subcontracting orders;Materials supplied to subcontractor;Subcontracting receipts;Subcontracting reconciliation")
]

AVAILABLE = [
    ("Inventory", "Stock transfers", "Atomic transfers between active warehouses, with negative-stock checks and audit history; no valuation."),
    ("Finance", "Journal vouchers", "Balanced two-line test vouchers with immutable posted rows and local audit events."),
    ("Finance", "Trial balance", "Calculated debit and credit balances from locally posted vouchers."),
    ("Finance", "General ledger", "Read-only local ledger of posted voucher lines."),
    ("Inventory", "Item master and units", "Read-only seeded test item register; creation and lifecycle controls remain planned."),
    ("Inventory", "Warehouses and bins", "Read-only seeded test warehouse register; bin-level controls remain planned."),
    ("Inventory", "Stock adjustments", "Receipt and issue adjustments block negative quantity; valuation is not included."),
    ("Purchasing", "Purchase request capture", "Draft request with title, supplier text and one estimated total; not a line-based PO."),
    ("Purchasing", "Submit, approve and reject", "Independent role-based approval with state and revision checks."),
    ("Purchasing", "Search and status filter", "Search visible requests by reference, title, supplier or owner and filter status."),
    ("Reports", "Purchase register CSV", "Export currently visible purchase requests, with spreadsheet formula escaping."),
    ("Reports", "Procurement overview", "Role-scoped live counts and a recent-requests table; no financial reports."),
    ("Administration", "Requester, approver and auditor roles", "Server-independent local role checks; test mode permits deliberate role switching."),
    ("Administration", "Audit history verification", "Hash-linked retained events, not externally anchored or administrator-proof."),
    ("Administration", "Passwordless test workspace", "Isolated marked test database with synthetic examples and role switching."),
    ("Deployment", "Native offline desktop", "Native Tk window and local SQLite storage; no browser or network dependency."),
    ("Deployment", "Manual backup and recovery", "Auditor can save a consistent backup; recovery uses a copy via --db in the protected launcher.")
]

def features():
    result=[]
    available_by_key={(module,title):(scope) for module,title,scope in AVAILABLE}
    for module,summary,items in MODULES:
        for index,title in enumerate(items.split(";"),1):
            online=any(word in title.lower() for word in ("connector","connected banking","sso","automatic upgrades"))
            key=(module,title)
            connected = online or module in ("Portal", "Communications", "Integrations & EDI")
            result.append({"module":module,"feature":title,"status":"Available" if key in available_by_key else "Planned","screen":module,"priority":"Current" if key in available_by_key else "P1" if module in ("Finance","Sales & CRM","Purchasing","Inventory","Administration") else "P2","connectivity":"Offline on this computer" if key in available_by_key else "Network or external service may be required; not implemented" if connected else "Local operation intended; not implemented","acceptance":"Covered by workflow tests; see validation limitations in README." if key in available_by_key else acceptance(module),"scope":available_by_key.get(key,summary)})
    for module,title,scope in AVAILABLE:
        if (module,title) in available_by_key and any(r["module"]==module and r["feature"]==title for r in result): continue
        result.append({"module":module,"feature":title,"status":"Available","screen":"Purchase requests" if module=="Purchasing" else "Overview" if title=="Procurement overview" else module,"priority":"Current","connectivity":"Offline on this computer","acceptance":"Covered by workflow tests; see validation limitations in README.","scope":scope})
    result.append({"module":"Administration","feature":"Production authentication and access lifecycle","status":"Partial","screen":"Protected workspace","priority":"P1","connectivity":"Local","acceptance":"Require user disable/reset, permission administration and security review before production.","scope":"Existing password login retained outside test mode; no enterprise identity lifecycle."})
    return result

def acceptance(module):
    return {
        "Finance":"Balanced postings, reversals, rounding, closed-period protection and reconciled financial statements.",
        "Sales & CRM":"Order-to-invoice-to-receipt reconciliation with returns, credit controls and permissions.",
        "Purchasing":"Item-based requisition-to-PO-to-receipt-to-invoice reconciliation and duplicate prevention.",
        "Inventory":"Concurrent stock movements reconcile with valuation, serial/batch history and general ledger.",
        "Tax & Compliance":"Jurisdiction and release-specific review, validated test cases and certified connectors where required.",
        "Banking":"Statement reconciliation, duplicate detection and independently authorized payments.",
        "Deployment":"Clean-machine install, offline execution, measured recovery, load tests and signed update rollback."
    }.get(module,"Validated master data, permission-negative tests, audit trail and business-owner acceptance.")

SOURCES = [
    ("TallyPrime commercial scope", "https://help.tallysolutions.com/tallyprime-get-started/"),
    ("ERPNext module scope", "https://frappe.io/erpnext/modules"),
    ("ERPNext repository module list (develop)", "https://github.com/frappe/erpnext/blob/develop/erpnext/modules.txt"),
    ("ERPNext manufacturing", "https://docs.frappe.io/erpnext/manufacturing")
]
