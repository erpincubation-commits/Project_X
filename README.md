# ERP Incubation Desktop

**MVP transition:** The existing application described below is still a testing
pilot, not a production MVP. The new `src/erp/features/` package and
[PostgreSQL development setup](docs/POSTGRES_SETUP.md) are an initial foundation;
they do not yet replace or migrate the existing SQLite workflows. A PostgreSQL
customer-master development CLI is available in the setup guide; it is not yet
connected to the desktop interface and is not ready for real business data.

A native Windows desktop ERP workbench for testing. It opens in its own application window, uses a local SQLite database and does not start a web server or browser. It is not a website, a browser wrapper or a Tally clone.

## Start

1. Extract the entire ZIP into a folder.
2. Double-click **scripts\Start_Desktop.cmd**.
3. It opens immediately in a clearly marked **TEST MODE · NO PASSWORD** workspace with synthetic purchase and stock examples.
4. Use the role selector to switch between Requester, Approver and Auditor. Requester creates/submits, Approver approves/rejects, Auditor reviews audit history and saves backups.
5. Finance supports balanced two-line test journal vouchers, a general ledger and a trial balance. Inventory supports seeded item/warehouse masters and positive/negative stock adjustments, blocking negative on-hand stock.

Python 3.12+ with Tkinter is required. No pip packages or internet are needed for operation. This is a source distribution with a launcher, not yet a self-contained executable or signed installer. Close the old browser-version server; it is not used by this application.

Keyboard: **F5** refresh, **Ctrl+N** new request (requester), **Ctrl+L** sign out. Selecting a row is required for submitting, approving or rejecting. Confirmation appears before a status change.

## Local data

Default test database on Windows: `%LOCALAPPDATA%\ERPIncubation\testing-v03.db`. This database is deliberately marked as test-only and contains no password prompt. It is independent of the extracted source folder, so replacing application files does not reset the workspace. Different Windows user profiles have separate default databases.

The passwordless workbench refuses to open an existing protected database. This prevents test mode from weakening old data. `scripts\Start_Protected.cmd` retains the earlier password-based pilot for isolated review only. Do not put any SQLite file on a network share or use separate copies as a synchronized multi-user ERP.

An auditor can select **Backup database**. Backups refuse to overwrite existing files and are checked for SQLite integrity. For restoration, keep the original backup unchanged, make a copy, and launch the application with `--db` pointing to the copy. Backups contain account password hashes and sessions; protect them with OS permissions and disk/media encryption. Native role controls do not prevent an OS administrator from editing the local database.

## Included

- Passwordless test role switching, with separate requester, approver and auditor permissions.
- Purchase drafts, submission, independent approval/rejection, search, filtering and CSV export.
- Finance: chart of accounts, balanced two-line journals, general ledger and trial balance.
- Inventory: item and warehouse master data, stock receipts/issues and negative-stock blocking.
- Inventory: atomic stock transfers between active warehouses, with audit history and source balance checks.
- Requester, approver and auditor permissions.
- Exact integer minor-unit amounts, record revision checks, transactional changes and idempotency keys.
- Status filtering, keyboard shortcuts and audit viewing.
- Backup creation and compatible restoration.

## Not included

Multi-line vouchers, invoice posting, GST, payroll, stock valuation, purchase orders, customer/supplier master management, sales invoicing, ERPNext integration, multi-company isolation, LAN client/server sharing, synchronization, SSO/MFA, signed installer and automatic updates. The passwordless build is explicitly for testing and is not appropriate for real financial data. This remains a development pilot, not an enterprise-ready ERP or a substitute for Tally.

## Validation

The pilot's automated test files were removed as requested. New MVP unit tests
can be run with `python -m unittest discover -s tests` after installing the
project. They do not replace PostgreSQL integration tests or validation of
authorization, concurrency, financial integrity and recovery.

## Product direction

The [ERPNext module crosswalk](docs/ERPNEXT_MODULE_CROSSWALK.md) maps the repository's
21 declared modules to our feature-map areas, including planned areas. Mapping
does not mean those modules have been implemented or that ERPNext is integrated.

### Qt migration preview

`erp.legacy.qt_preview` is an optional, read-only PySide6 capability browser. It does not
open a database or implement the ERP workflows; status labels describe the
existing Tk workbench. To try it in a virtual environment, install
`python -m pip install -e . -r requirements/qt.txt` and run `python -m erp.legacy.qt_preview`.
The existing launchers and their standard-library-only requirements are unchanged.
PySide6 has open-source and commercial licensing options; review the applicable
Qt license and distribution obligations before shipping.

The proposed migration keeps Python business rules and SQLite initially, moves
screens to Qt one workflow at a time, and adds a separately designed server and
PostgreSQL only if multi-user deployment becomes a requirement. A database
abstraction alone does not make the existing SQLite-specific SQL portable.

Desktop-first ERP, with optional customer-owned server mode later. Preserve a proper business-logic boundary so accounting, inventory, sales and purchasing can be added and tested independently of the window toolkit. For multi-user deployment, design an authenticated server/database topology rather than sharing a SQLite file. If ERPNext is retained as the eventual core, the desktop client will require an explicitly implemented connector; the present code has none.
