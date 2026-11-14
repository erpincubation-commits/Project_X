# Changelog

## 0.3 — Test Workbench

- Reworked the desktop experience: sidebar navigation, business overview, searchable purchase register, status filters, CSV export and commercial feature map.
- Replaced the password prompt with an isolated, clearly labelled passwordless testing workspace. It refuses existing protected databases.
- Added Finance: seeded chart of accounts, balanced two-line journal vouchers, ledger and trial balance.
- Added Inventory: seeded items/warehouses, stock receipts/issues, on-hand balances and negative-stock protection.
- Added a 128-capability commercial map spanning 15 modules. Each item states Available, Partial or Planned.

## Boundaries

Finance and Inventory are local test transactions. They do not yet integrate to purchase approvals, valuation, sales or compliance. No real company records should be entered while test mode has passwordless role switching.
