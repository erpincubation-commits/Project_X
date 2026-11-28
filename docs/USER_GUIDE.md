# Project X ERP desktop user guide

**Last reviewed:** 28 November 2026

**Application baseline:** package version 0.2.0, implemented workflows through database schema 16<br>
**Audience:** Windows desktop users, administrators, purchasing, inventory and finance teams

This guide describes the current Electron application connected to a shared on-premises server. Your administrator must confirm the installed client, server and database match this baseline. The version in the source tree does not establish which version is running at your company. Use synthetic data during the [controlled pilot](NEXT_SPRINT_PLAN.md); production acceptance is a separate decision.

Internal teams can use the [P2P team test guide](P2P_TEAM_TEST_GUIDE.md) to record workflow acceptance and the remaining Phase Two gaps. It contains no demo credentials.

## Contents

1. [Start and connect](#start-and-connect)
2. [Sign in and set up MFA](#sign-in-and-set-up-mfa)
3. [Roles and navigation](#roles-and-navigation)
4. [Administrator setup](#administrator-setup)
5. [Customers, suppliers and items](#customers-suppliers-and-items)
6. [Procure to pay](#procure-to-pay)
7. [Accounting and period management](#accounting-and-period-management)
8. [Warehouses and stock](#warehouses-and-stock)
9. [Customer invoicing and collections](#customer-invoicing-and-collections)
10. [Tax, reports and reconciliation](#tax-reports-and-reconciliation)
11. [Master imports](#master-imports)
12. [Privacy requests](#privacy-requests)
13. [History, conflicts and uncertain saves](#history-conflicts-and-uncertain-saves)
14. [Troubleshooting and support](#troubleshooting-and-support)
15. [Daily checks and current limits](#daily-checks-and-current-limits)
16. [Planned modules and availability](#planned-modules-and-availability)
17. [Guide maintenance and revision history](#guide-maintenance-and-revision-history)

## Start and connect

Ask your administrator for the approved Windows installer, server address and your individual account credentials. The desktop window is labelled **Project X ERP**. Existing installers and shortcuts may still be labelled **SMB ERP**; use the approved shortcut supplied by your administrator. The installer supplies the desktop client; the shared API and PostgreSQL must already be running on the company server.

1. In **Connect to the server**, enter the **Server address** supplied by IT, such as `https://erp.company.internal`.
2. Select **Connect** and wait for **Server ready**.
3. Continue to **Sign in**. If the application instead shows **Create initial administrator**, only the authorised initial administrator should continue.

Enter the server origin, without `/api/v1`. Remote servers require HTTPS and a certificate trusted by Windows. `http://127.0.0.1:3001` is for a server running on the same computer; on a second workstation it refers to that second workstation. All users of the same company enter the same shared HTTPS origin. PostgreSQL port 5432 is a database connection and is not the desktop server address. Desktop users do not need pgAdmin or database passwords.

The server address is saved locally. Sign-in is required after restarting the desktop. Shared records need an active server connection; there is no offline editing or later synchronization.

For developers running a configured checkout, start from the repository root:

```powershell
npm ci
npm start
```

First-time database/configuration setup belongs to the operator: see [PostgreSQL setup](POSTGRES_SETUP.md), [development commands](DEVELOPMENT.md) and [deployment](DEPLOYMENT.md). Running the desktop does not migrate an existing company database.

### Fictional factory demonstration

This development workspace can contain a separate fictional factory demonstration database, `erp_factory_demo`, on the isolated local test PostgreSQL cluster at port 55439. Its local API uses **http://127.0.0.1:3314**. It is separate from the configured business database and is not a production installation. On the desktop connection screen, enter that server origin and select **Connect**. Use the demo administrator name and password stored locally in `.local/factory-demo-private/access.txt`; never paste the password or authenticator details into chat. Complete first-time MFA enrolment as described below. To return to your business data, sign out and reconnect to your original server address.

The demonstration includes fictional suppliers and factory parts, an approved bearing order, a partial delivery with damage, a posted invoice and a payment awaiting approval, plus a second request awaiting approval. The records are synthetic and must not be used for actual orders or payments. The demo database persists in the isolated test cluster. The demo API and test cluster must both be running; if they are stopped, run `powershell -ExecutionPolicy Bypass -File tools/factory-demo-start.ps1` from the project root to start them. The launcher requires the existing isolated PostgreSQL 18 demo cluster and refuses to reuse an occupied API port. The demo server uses its own local port and MFA key and does not reuse the business server. Demo account passwords can be changed using `tools/factory-demo-password.cjs` with a privately supplied `FACTORY_DEMO_PASSWORD`; it updates demo accounts only and revokes their sessions.

## Sign in and set up MFA

### First sign-in or initial administrator enrolment

1. Connect, then enter your email and password and select **Sign in**. The initial administrator also enters the private **Administrator setup code** and confirms their new password.
2. If **Set up your authenticator** appears, add an account to your authenticator app using the displayed **Authenticator setup key**. Choose a time-based account with six-digit codes.
3. Enter the current six-digit code in **Verification code**, then select **Verify code**. Complete this within five minutes.
4. Save all eight single-use recovery codes in your approved private password manager or recovery storage outside this computer. They appear once. Select **I have saved my recovery codes** to continue.

If you return to sign-in before completing enrolment, the next attempt supplies a new key. Add that new key and remove the old unfinished authenticator entry. Keep the setup key and recovery codes private.

### Later sign-ins

Enter your email/password, then a current authenticator code. Alternatively, enter one unused recovery code in **Verification code**; your password is still required. An accepted authenticator time step cannot be reused, including when opening another session immediately. Wait for the next code.

If a code fails, check the correct account and latest setup key, enable automatic time on the authenticator device, and ask IT to check the server clock. A challenge expires after five minutes and permits five attempts. Repeated attempts are also limited across challenges; stop retrying and wait for the 15-minute limit window when throttled. Use an unused recovery code if appropriate.

If you lose both the authenticator and recovery codes, contact your administrator through your established company channel. Two different signed-in administrators must independently verify your identity and approve recovery. The administrator privately supplies a token that expires after 15 minutes. Select **Recover access** on the sign-in screen, enter the token and a new password, then sign in and enrol a new authenticator. Save the new recovery codes privately. Recovery ends your other sessions and pending sign-in challenges and invalidates your previous authenticator and recovery codes. Disabled or privacy-restricted accounts cannot use this process.

If the token is lost or may be exposed, contact an administrator immediately to cancel the request; do not share it in tickets or logs. If the completion response is lost, try signing in with the new password. If it fails, contact the administrator rather than repeatedly retrying. There is no self-service reset without an operator-issued token. Last-administrator emergency recovery needs a separate approved procedure and is not provided by this workflow.

### Change your password

While signed in, open **Account security and access**, enter your **Current password**, **New password** and **Confirm new password**, then select **Change password**. Use at least 12 characters and at most 72 UTF-8 bytes. All sessions, including this one, and pending sign-in challenges end on success. Sign in again with the new password and your authenticator or unused recovery code. Save other unsaved work first.

If the response is lost, the change may have succeeded. Sign in with the new password; if it does not work, try the previous password. Do not repeatedly retry: password-change attempts are limited to ten in 15 minutes. If neither works, contact an administrator; self-service password reset is not available. MFA is required at sign-in; there is no additional password-change MFA prompt.

### Sign out and session expiry

Select **Sign out** when finished. **Account security and access → Sign out all my sessions** ends all your sessions and pending sign-in challenges. The server enforces 30-minute idle and eight-hour absolute expiry; the desktop also signs out after 30 minutes without interaction. Sign in again when asked. Unsaved forms may need re-entry.

Changing access or disabling an account revokes its sessions. If sign-out happens while offline, it clears this device immediately; the unreachable server session remains subject to server expiry. See [authentication details](AUTHENTICATION.md).

## Roles and navigation

Use the left sidebar to select a workspace. The top bar shows the current location, **Account security and access**, and **Sign out**. Tabs and actions depend on your role; the server checks permission again for every protected operation. Missing actions should be reviewed with your administrator.

Within a workspace, use the section navigation to move between tasks. **Orders & billing** groups its permitted sections into Purchasing, Supplier finance, Customer finance, and Insights & setup. Registers, selected records and transaction forms have separate sections; its guidance does not replace checking the underlying records. **Accounting & stock** shows the books setup state and counts available to your permissions, with grouped stock and bank forms and a bank-matching summary. The overview is not a live alert: after saving your work, leave and reopen **Accounting & stock** to reload it. Refresh the relevant records before acting. **Account security and access** provides shortcuts to permitted sections of the security page. Privacy requests use a separate register and selected-case area.

| Workspace | Main tasks |
| --- | --- |
| **Customers** | Shared customer register and administrator customer creation. |
| **Purchasing** | Purchase requests, suppliers and items. |
| **Accounting & stock** | Chart & periods, Journals, Warehouses & stock, Reconciliation, Bank statements. |
| **Orders & billing** | Orders, Receipts, Supplier invoices, Payments, Customer invoices, Collections, Taxes, Statements. |
| **Operations & privacy** | Master imports and administrator Privacy requests. |
| **Account security and access** | Password change, own-session revocation, authorised identity recovery, user management and audit viewing. |

| Assigned role | Principal responsibilities and limits |
| --- | --- |
| `admin` | Create customers; maintain suppliers/items; create/read requests; initialise books; manage other users; imports/privacy; read books, trade records and audit. Has no request/payment approval, journal/stock posting or payment execution grant. |
| `reader` | Read the customer register. |
| `identity_admin` | List users and create/enable/disable reader accounts. Cannot assign privileged roles or change privileged users. |
| `auditor` | Read customers, masters, requests, books, inventory, trade records and audit; no business mutations. |
| `requester` | Read master selections; create, revise, submit and read own requests. |
| `business_approver` | Create own requests; decide other users' assigned requests; review supplier invoice price exceptions; decide assigned payment batches. Cannot execute payments. |
| `purchasing` | Maintain/import supplier and item masters; create/read requests; issue orders and cancel remaining quantities. Cannot approve requests/payments or post receipts. |
| `accountant` | Maintain accounts/periods/taxes; post/reverse manual journals; prepare/post invoices; prepare/submit payments and record approved transfers; collections, statements and bank reconciliation. Cannot approve payments or accept invoice price exceptions. |
| `inventory_manager` | Maintain warehouses and stock; post goods receipts; read inventory valuation/reconciliation and master/order selections. No manual journal, bank or financial-statement access. |

Request access is limited to own/assigned records unless the role explicitly grants wider reading. Roles are fixed; configurable thresholds and warehouse scopes remain future work. Accounts hold one role. Financial reporting visibility follows the underlying permissions, not the job title chosen by the company.

Use **Tab** and **Shift+Tab** to move between controls, **Enter** to submit an active form, and **Space** to activate focused buttons/checkboxes. **Skip to main content** moves focus beyond the sidebar. Save before switching workspaces. Keyboard and screen-reader pilot acceptance is tracked in the [sprint stories](NEXT_SPRINT_USER_STORIES.md).

## Administrator setup

An operator can require supplier qualification for every new purchase order by setting **REQUIRE_SUPPLIER_QUALIFICATION=true** in the API service environment and restarting the API. The default is false: suppliers without a qualification record remain eligible, while any recorded qualification must still be approved and unexpired. Before enabling, Purchasing should use the **Not recorded** supplier filter to submit required evidence references and arrange independent administrator review. The setting changes new-order eligibility only; existing orders, acceptance, invoices and payments retain their existing workflow. Invalid values stop configuration validation. Keep the chosen policy in the deployment change record. This release adds no migration; source implementation does not establish that this setting is enabled on your installation.

1. On a new database, obtain the private setup code from the server operator and create the first administrator. New passwords must be at least 12 characters and at most 72 UTF-8 bytes; non-ASCII characters can use several bytes each.
2. Open **Account security and access**. Enter **New user email**, **Initial password**, choose **Role**, then select **Create account**. Share credentials through the approved private channel. Every account completes MFA on first sign-in.
3. Provision separate purchasing, inventory and finance accounts and independent business approvers. Payments require two distinct approvers, separate from their preparer. Use individual accounts for attributable history.
4. Review roles and **Enable/Disable** controls. Access changes end the affected user's sessions. You cannot change your own access or demote/disable the last active administrator. A privacy-restricted account needs the authorised privacy process before ordinary reactivation.
5. For identity recovery, open **Account security and access**. Independently verify the person using your organisation's approved procedure, enter **Account email for recovery**, confirm verification and select **Request recovery**. A different signed-in administrator selects **Refresh recovery requests**, independently verifies the person, then selects **Verify and approve**. Privately deliver the token shown once; it expires after 15 minutes. Either administrator can select **Cancel recovery** if the token is compromised or its issuance response is uncertain. Requests pending without approval expire after 24 hours. Account and operator access changes can invalidate a request; start again after review. See the [suggested operator procedure](AUTHENTICATION.md#operator-assisted-identity-recovery), which requires local adoption.
6. Open **Accounting & stock → Chart & periods**. Review [posting rules](ACCOUNTING_POSTINGS.md), check **I have reviewed the INR posting rules and initial account mappings**, then select **Initialise INR books** once.
7. Have the accountant create an open accounting period and review tax configuration. Have the inventory manager create active warehouses and purchasing create active items/suppliers.

Books setup creates twelve system posting accounts and fixes INR, two-place money, moving weighted average and negative-stock blocking. It creates no opening balances or inventory. Existing books must not be initialised again. Opening entries require a reviewed finance plan.

The operator owns server availability, migrations, protected keys, backups, restores and upgrades. See [operations](OPERATIONS_RUNBOOK.md) and [backup/recovery](BACKUP_RESTORE.md); ordinary desktop users should not run database administration commands.

## Customers, suppliers and items

For supplier registration tracking, a purchasing user opens **Purchasing → Suppliers → Qualification** on a supplier row. Enter an internal registration reference, an evidence reference and a validity end date, then select **Submit for independent review**. The form stores references and dates only; use your organisation's approved secure records for actual documents. A different administrator reviews the pending record, enters a note and selects **Approve qualification** or **Reject qualification**. A submission cannot be reviewed by its submitter, and an expired record cannot be approved. A rejected or approved record can be resubmitted with updated references. The supplier register shows qualification state and expiry date to administrators, purchasing users and auditors. Use **Qualification status** and **Apply supplier filters** to find pending, approved, rejected, expired or not-recorded suppliers across the permitted register; the server applies this with search, active-only and contact-completeness filters. The state changes to **Expired** after its end date; refresh the supplier register to see the current server status. Once a supplier has a qualification submission, a new purchase order requires its current qualification to be approved and unexpired. Suppliers with no qualification record remain eligible when the operator setting REQUIRE_SUPPLIER_QUALIFICATION is false (the default); when it is true, every supplier must have approved, unexpired qualification before a new order can be issued. this control does not validate a government registry or verify bank details. Existing orders and downstream receipts or invoices are unchanged by a later expiry. Keep sensitive identifiers out of free-text references and notes. The administrator and purchasing users can open this panel; auditors can view it. Upgrade the client and server and apply schema 15 after backup before using it.

### Customers

As administrator, open **Customers**, enter **Customer code** and **Customer name** under **Add a customer**, then select **Save customer**. Review the **All customers** register; use **Refresh customers**, **Previous** and **Next** to navigate. Codes are unique and normalised to uppercase. Customers are shared across connected users. Customer editing is not currently provided.

### Suppliers and items

For qualification renewals, administrators, purchasing users and auditors can select **Qualification status → Approved — expires within 30 days** and **Apply supplier filters**. This finds approved qualifications with validity ending from today through 30 calendar days after the database server's current date, inclusive. A qualification remains valid through its end date. Expired, pending, rejected and not-recorded qualifications are excluded from this queue; use their separate filters. Search, contact completeness, active-only and pagination still apply. Refresh or reapply the filter for current server-date results, then open **Qualification** to arrange renewal and independent review. Resubmission moves the qualification to pending and can block new orders until review; plan renewal with Purchasing. This is an on-screen queue and sends no automatic reminder. Update client/server together; no migration.

As administrator or purchasing user:

1. Open **Purchasing → Suppliers**, create a unique code/name and optionally contact email, phone and payment terms in days. Save and check the register.
2. Open **Items**, create a unique code/name, unit such as `EA`, and optional description. Save.
3. Use **Edit** to update authorised fields or deactivate a record. Codes stay fixed. Item units become fixed after use by an order or stock movement. Records holding stock cannot be deactivated.
4. Use search, **Active only**, pagination and **History** where available. Supplier contacts are visible only to authorised master-history roles, rather than all requesters.

When saving a supplier, the desktop checks existing records for a matching name, contact email or phone number. Names are compared ignoring case and repeated spaces; emails ignore case; phone comparison ignores non-digits and requires at least seven digits. Inactive records are included. If it finds matches, review their codes, names and active status. Correct the details, or enter a **Duplicate review reference** of 3–100 characters from your organisation's review process and select **Save with review reference**. Editing a checked field clears the reference and runs the check again. The warning shows at most 20 matches. The server repeats the check inside new-supplier saves, identity edits, reactivation and JSON import commits, including competing saves; a matching record without a review reference is refused. An unrelated edit to an existing duplicate does not need a new reference. A contact can legitimately be shared, and different contacts can identify the same entity. This control does not verify legal identity, automatically merge suppliers or prevent a privileged direct database write. Keep bank details and identity documents out of the reference; submitted references also remain in operation retry records.

Codes allow up to 32 letters/numbers/hyphens/underscores; names allow up to 160 characters. Supplier bank details are outside the current master. Select masters instead of repeatedly entering free-text identities. See [procurement details](PROCUREMENT.md).

An administrator can create a service item under **Purchasing → Items** by choosing **Item type → Service** and an active non-control **Service expense account**. Stock items do not have a service expense account. The item type cannot be changed later; create a separate item if needed. Service items cannot be created through the item import. Have Finance review the selected account and posting treatment before production use.

Administrators, purchasing users and auditors can use **Purchasing → Suppliers → Supplier contact completeness** and **Apply supplier filters** to find records missing either contact email or phone, or missing both. The filter combines with search, **Active only** and pagination; inactive records are included unless **Active only** is selected. Missing means the field is blank; the filter does not verify whether a contact is current or valid.

## Procure to pay

The implemented path is **request → independent approval → order → accepted receipt → matched supplier invoice → two payment approvals → recorded confirmed transfer**. An approved request or issued order creates no ledger posting. A payment record documents a transfer completed outside the ERP.

**Purchasing → Overview** shows request counts, a request-to-payment guide and shortcuts to available transactions and master data. Users with order access also see **Delivery attention**: counts of orders past an acknowledged delivery date and orders open for 30 days or more. Select **Refresh** for current server-date counts, then **Review orders** and use the corresponding order-status filter. This is an on-screen cue, not an automatic notification or proof of physical delivery; an order without a supplier promise cannot enter the overdue-promise count. Select **Purchase requests** to open the request register. The guide also appears on the register when no request or draft is open; select **Close request** to return to it. Links open the relevant section of **Orders & billing** but do not select a record or carry draft data. Save work before switching sections. Users without request access start Purchasing on **Suppliers** instead.

Before testing the complete path, ask the administrator to check **Account security and access** for active purchasing, inventory-manager and accountant accounts, plus **two distinct active business approvers**. Each user must complete MFA. One approver can decide a purchase request, but supplier payment requires two. If a later workspace or action is missing, check this account setup before treating the workflow as a server failure. Administrator access does not substitute for these business permissions.

### 1. Create and submit a purchase request

The same authorised users can open **Purchasing → Purchase requests → Approver holding times**. Set **Assignment ended from** and **Assignment ended to**, then select **Run holding time report**. Each row covers one completed assignment from retained history: submission, reassignment or handoff starts the interval; the next reassignment, handoff, approval, rejection or withdrawal ends it. The range includes intervals whose end date falls within the selected inclusive UTC dates, even if they started earlier. Displayed timestamps use local time. Rows identify the assigned approver using the historical email snapshot and show start, end, end event and elapsed hours. Time includes nights/weekends and does not measure active work or compliance with an SLA. An assignment still open is excluded; use **Approval workload** for current pending work. Refresh by rerunning; paging retains the loaded dates. Update desktop and server together; no migration is required.

Administrators, purchasing users and auditors can open **Purchasing → Purchase requests → Historical approval cycles**. Set **Decision from** and **Decision to**, then select **Run approval cycle report**. The inclusive range uses each decision's UTC date; displayed timestamps use this computer's local time. The paged report lists completed approval and rejection events from retained history, including earlier rejected cycles after a request is revised and approved. Each row shows request/version, outcome, final approver, submission and decision timestamps, and elapsed hours. Elapsed time includes weekends and time with previous approvers; it is not per-approver holding time or an SLA score. Withdrawn cycles without a decision and pending cycles are excluded. Paging retains the loaded range; rerun the report to apply edited date fields or refresh results. Snapshot approver emails reflect historical records. No migration is required; update desktop and server together.

**Who:** requester, business approver, purchasing or administrator; only the originating requester can revise/submit their record.

The request register shows counts for all requests visible to your account, independent of its search and status filters. Select a count to filter by status; the current search remains in effect. Approvers can select **Assigned to me** to see submitted requests assigned to them; selecting a status clears that filter. Select **Refresh requests** to refresh both the register and counts; they are not live notifications.

The **Assigned to me** queue lists the oldest submissions first. Reassigning a request does not restart its submission time, so an older request may appear first when reassigned.

Use **Pending for at least** with **Refresh requests** to find submitted requests waiting at least 24 hours, 72 hours or seven days. The server uses elapsed time since submission, not business hours; the filter combines with your permitted scope, search, status and **Assigned to me**. Request counts remain unfiltered. Reassignment does not reset the time, while withdrawal and resubmission do. This filter does not send notifications or perform escalation.

Administrators, purchasing users and auditors can select **Load workload** in **Purchasing → Purchase requests → Approval workload**. The paged table groups current pending requests by their assigned approver, shows those older than 24 and 72 elapsed hours, and shows the oldest submission. It also counts approvals/rejections decided in the rolling past 30 days and their average elapsed hours from the latest submission. **Refresh workload** rereads the server; no live notification is sent. The report includes inactive approvers if they still have relevant requests. It uses each request's current submission cycle: earlier withdrawn or revised cycles are excluded, and reassignment/handoff time is attributed to the final approver. It is an operational view, not an SLA or evidence of the time each individual approver held a request. Requesters and business approvers cannot read the cross-user table.

In **Orders & billing → Supplier invoices**, posted invoices with an outstanding balance show **Overdue** or **Due today** beside their due date when applicable. This is an on-screen cue based on the desktop computer's local date and the loaded records, not a notification or a payment instruction. Refresh supplier invoices and verify the balance before acting; the register is paginated and the cue only covers the visible page.

Use **Search supplier invoices** to find an invoice number, supplier name or reference, and **Invoice status** to select drafts, matching exceptions, posted, void, overdue or due-today invoices. Select **Apply invoice filters** to search the complete permitted register; paging and refresh retain the applied filters. **Matching exception** finds draft invoices currently marked as exceptions. Finance can also select **Unassigned exceptions** or **Exceptions waiting 24 hours**; reviewers can select **Assigned to me**. The 24-hour queue uses elapsed time since assignment, or since the exception was first matched if unassigned. It is a manual follow-up cue, not an automatic escalation. The overdue and due-today filters use the database server's current date and select posted invoices with an outstanding balance, including amounts reserved for an unexecuted payment. The row cue uses the desktop's local date, so it can differ around midnight or if clocks/time zones differ. Refresh and verify balances before paying. Results follow your server-enforced access rights.

On **Orders & billing → Supplier invoices** and **Payments**, the **Payment deadlines** strip shows permission-scoped counts of posted supplier invoices with outstanding balances that are overdue, due today or due in the next seven days. It loads when you open either section; select **Refresh deadlines** for current server-date counts. Reserved but unexecuted amounts are included, so inspect invoice and payment records before preparing a payment. This is an on-screen cue, not a notification or transfer instruction.

For payment planning, choose **Due in next 7 days** and select **Apply invoice filters**. This shows permitted posted invoices with an outstanding balance and a due date from tomorrow through seven days after the database server's current date, inclusive. Due-today and overdue invoices have separate filters. Outstanding includes amounts reserved for payments that have not been executed; inspect the invoice and payment records before preparing another payment. This view does not send reminders or initiate transfers.

For invoiced purchasing totals, users with finance report access can open **Orders & billing → Statements**, enter **Statement from** and **Statement to**, and select **Run financial statements**. **Supplier invoiced spend** shows posted supplier invoice counts and net, tax and gross INR for the inclusive invoice-date range, grouped by supplier and the name captured on each invoice. **Item invoiced spend** groups the same posted invoice lines by the item code, name, type and unit captured on their purchase orders, with invoice count, quantity, net, tax and gross INR. The report warns if item totals do not reconcile to supplier invoice totals. **Supplier exceptions and rework** groups damaged receipts and invoice matching holds by supplier: damaged records use receipt posting dates, while each immutable matching event that placed an invoice on hold counts as rework at its event time. Distinct affected invoices are also shown. This does not assign supplier fault or replace quality, return, tax or Finance review. Renamed suppliers or items may appear on multiple rows. Draft and void invoices are excluded from spend; these reports are not payment totals or a GL reconciliation, and supplier credits are not supported.

For submitted requests, **Pending with** shows the currently assigned approver and **Submitted** shows the submission date and time in this computer's local time. Reassignment keeps the original submission time; withdrawal and resubmission start a new submission. These columns do not calculate an approval deadline or send reminders.

**Pending for** shows elapsed time since submission, calculated using this computer's clock when the register renders. Refresh the register for an updated value. A future or invalid submission timestamp shows **Check clock**; check the desktop and server clocks. This is an elapsed-time cue, not a business-hours SLA, deadline, escalation or notification.

In **Orders & billing → Orders**, use **Search purchase orders** to find an order number, supplier code or supplier name. Choose an **Order status** and select **Apply order filters**; search and status apply to the complete permitted register before pagination. **Awaiting acceptance** finds issued orders with at least one goods or service line whose accepted quantity is less than its ordered quantity; damaged goods do not fulfil it. **Overdue promised delivery** narrows that list to orders whose latest recorded expected date is before the database server's current date; orders without a promised date are excluded. Refresh and paging retain the applied filters. An issued order can be fully received; check its lines for remaining quantities.

Choose **Outstanding 30 days or more** to find issued orders dated at least 30 calendar days before the database server's current date that still have goods or services awaiting acceptance. Damaged quantities do not count as accepted. This age is measured from the order date, not a supplier's promised delivery date; the 30-day threshold is fixed. Apply the filter and refresh to obtain current results. Fully received and cancelled orders are excluded.

1. Open **Purchasing → Purchase requests → New purchase request**.
2. Enter title, justification and currency. Use **INR** for the downstream order workflow. Preferred supplier and needed-by date are optional.
3. Select active items and enter positive quantities and estimated unit prices. Use **Search master data** if the desired item/supplier is outside the first 20 matches.
4. Select **Save draft** and check the server total and lines.
5. Select a different active business approver, then **Submit for approval**.

Quantities accept up to six decimal places and request prices up to four. Use a decimal point and leading zero, for example `0.5`. Requests contain 1–100 unique item lines. These totals are pre-tax estimates. Downstream orders require positive prices.

### 2. Approve, reject or revise

**Who:** the assigned business approver, different from the requester.

Open the assigned submitted request, review its saved version and select **Approve request**, or enter a reason and **Reject request**. A rejected request may be revised by its requester, saved as a draft and resubmitted. The old rejection remains in history. Submitted requests are locked for editing; approved requests have no reopen/edit action.

| State | Next supported action |
| --- | --- |
| DRAFT | Originator edits or submits to an independent approver. |
| SUBMITTED | Assigned approver approves/rejects; requester can reassign or withdraw to draft. |
| REJECTED | Originator revises to DRAFT and resubmits. |
| APPROVED | Purchasing issues the downstream INR order. |

The requester can select a different active **Replacement approver** and **Reassign request** while it is submitted. The new approver must be independent of the requester. The previous approver loses access unless their role otherwise grants it; the reassignment is retained in history. Alternatively, select **Withdraw request** to return it to draft and clear the approver; revise and submit it again when ready. If an approval or another change happens first, refresh the request. If master data changed, revise/save before resubmitting. Delegation is not implemented.

The currently assigned approver can also select another active, independent **Handoff approver**, enter a **Handoff reason** and select **Hand off request**. The decision moves to that person and the detail closes; the former approver loses access unless another role permission grants it. The reason and change are retained in history, and the original submission time remains. Select **Refresh handoff approvers** to reload eligible approvers. This is a permanent reassignment of the current decision, not scheduled delegation or automatic escalation.

### 3. Issue the purchase order

**Who:** purchasing.

Before ordering, purchasing may open an approved request and use **Supplier quotations** to compare manually obtained quotes. Search active suppliers, choose one, enter its reference, optional expiry and a unit price for every request line, then select **Record supplier quotation**. Totals use the request quantities and currency, before tax; the latest 100 quotes are shown. Past validity dates are marked expired using the database server's date. Supplier reference must be unique per supplier, ignoring case and surrounding spaces. Quotes are immutable; enter a new reference for a corrected quote. Administrators and auditors can view them, but only purchasing can record or withdraw them.

To mark an incorrect or obsolete quote, select its **Withdraw** action, enter a reason of at least three characters and select **Confirm quote withdrawal**. Avoid personal or sensitive information in the reason. The quote, prices, reason, actor and time remain visible as withdrawn, with an audit event. Withdrawal is permanent and does not change an order or its approved prices.

Before an order exists, purchasing can select **Recommend** on an unexpired, unwithdrawn quote from an active supplier, enter a reason and select **Record recommendation**. Recommendation history shows the latest 100 events, including whether a quote has since expired or been withdrawn or its supplier is inactive. Avoid sensitive information in the reason. Recommendations are non-binding: they do not award a contract, approve a supplier or price, create an order, or change the approved request. Multiple recommendations remain in history.

This comparison does not send an RFQ or create an order. Orders still use approved request prices. If those prices need to change, follow the approved request process; approved requests cannot currently be reopened. Review quote validity and terms manually.

Open **Orders & billing → Orders**. In **Issue purchase order**, select the approved INR request, active supplier, date and description, then **Issue approved order**. Quantities and prices come from the approved request. There is one order per request. If the supplier has a qualification record, it must be approved and unexpired at issue time. For a pending, rejected or expired record, ask Purchasing to resubmit current references and a different administrator to review; refresh before retrying. A supplier with no qualification record can be used only when the server’s REQUIRE_SUPPLIER_QUALIFICATION policy is false (the default). When enabled, submit qualification and obtain independent review first.

Optionally select a quotation for the request before issuing the order. The selected quotation must be unexpired, unwithdrawn, for the same active supplier and request version, with quantities and prices matching the approved request exactly. The latest 100 quotations are available for selection; the server rechecks eligibility at issuance. The resulting order retains the quotation link. An order without a linked quotation remains supported; changing approved prices, split awards and automatic supplier communication are not supported.

After the supplier confirms the order through your usual channel, open the issued order and enter **Acknowledged on**, the **Supplier acknowledgement reference**, and optionally **Expected delivery date (optional)**. Select **Record acknowledgement**. Acknowledgement must be on or after the order date and no later than the database server's current date; an expected date cannot precede acknowledgement. To record a changed confirmation, enter its details and select **Record updated acknowledgement**. Previous confirmations remain in order history with the actor and time. The application does not send an order or contact the supplier. Only purchasing can record this; the order version changes, so another user should refresh a stale order before receiving or cancelling it. The record does not change stock or accounts.

Review ordered, accepted, damaged and remaining accepted quantities. **Cancel remaining order** requires a reason, preserves receipts and allows invoicing accepted quantities. Cancelled orders cannot be reopened.

On an open order, select **Load related documents** to see its goods receipts, service acceptances and, if your role permits invoice access, related supplier invoices. Select **Open** beside a goods receipt or invoice to open its register. Expand a service acceptance to review its evidence, recorded time, entry lag and accepted line quantities/values, plus current uninvoiced quantities; **Load transaction history** opens its retained history inline. The service list includes all acceptances for this order, regardless of the Receipts screen's entry-lag filter. No acceptance is posted from this view. Invoice results follow your existing permissions and are paginated; an exception reviewer sees only permitted invoices. Reload related documents after another user posts an acceptance or invoice to refresh quantities. Switching sections leaves the current order screen, so save or cancel any unsaved order work first.

### Controlled order description amendments

In **Orders & billing → Orders**, open an issued order. Purchasing enters **Proposed order description** and **Amendment proposal reason**, then selects **Propose description amendment**. The saved description remains effective during review. An independent business approver opens the same order, reviews the proposal, enters **Amendment decision reason** and selects **Approve description amendment** or **Reject description amendment**. The proposer, originating requester and order creator cannot decide it. Refresh the order after another user acts. A newer proposal or any intervening order version change expires the previous proposal; Purchasing must propose again. History retains proposals and decisions. This workflow changes description only: quantities, prices, supplier, quote, dates and financial source links remain governed by their existing controls. Commercial line amendments and split sourcing remain pending. Update client and server together; no migration is required.

### 4. Post partial receipts and record damage

For service-entry follow-up, open **Orders & billing → Receipts → Service acceptance**, load and select the service order, then choose **Service entry lag**: Any, at least 1, 3 or 7 days. The server filters all acceptances for that order. Expand a record to see **Recorded** and **Entry lag**. Select **Refresh service acceptances** to reload the saved records. Lag uses UTC calendar days from the entered posting date to record creation, with a minimum of zero; it does not prove physical completion time or actual supplier delay. The recorded timestamp displays in local time. The selected filter remains when you change orders or post a new acceptance; choose Any if a recent record is hidden. Existing invoice allocation selections continue to load all accepted sources. Update client/server together; no migration.

**Who:** inventory manager. **Before starting:** books initialised, active warehouse, open posting period and issued order.

These prerequisites have different owners; they are not all tasks for the inventory manager:

| Prerequisite | Responsible role | Where |
| --- | --- | --- |
| Initialise books once | Administrator | Accounting & stock → Chart & periods |
| Create/open the accounting period | Accountant | Accounting & stock → Chart & periods |
| Issue the purchase order from an approved INR request | Purchasing | Orders & billing → Orders |
| Create the receiving warehouse | Inventory manager | Accounting & stock → Warehouses & stock |
| View the issued order and post its goods receipt | Inventory manager | Orders & billing → Receipts |

The inventory manager can read issued orders but cannot issue them, initialise books or manage accounting periods. If one of those prerequisites is missing, contact its responsible user, then refresh the receiving sources. Existing configured books do not need initialisation again.

1. Open **Orders & billing → Receipts**, select the order and inspect outstanding quantities.
2. Enter **Receipt posting date**, **Delivery reference** and **Receiving warehouse**.
3. Enter accepted and damaged quantities separately, with a damage explanation. Leave unreceived lines at zero.
4. Select **Post goods receipt** and inspect the receipt and resulting stock value.

To find an existing delivery, use **Search goods receipts** for a receipt number, order number or delivery reference. Select **Damaged deliveries only** to narrow the register to receipts with recorded damaged quantities, then select **Apply receipt filters**. Filters apply before pagination and remain in effect when refreshing or paging. This is a review tool; it does not create a return or quarantine transaction.

The register also shows **Recorded** and **Entry lag**. Choose **Entry lag** of at least 1, 3 or 7 days and select **Apply receipt filters** to find receipts entered after their posting date. Lag compares the recorded timestamp's **UTC calendar date** with **Receipt posting date**, never below zero. It is a data-entry timeliness cue, not proof of physical delivery time or an automatic escalation; inspect the delivery evidence before drawing a conclusion. Search, damage, lag and pagination combine.

Accepted stock fulfils the order and posts inventory against GRNI (goods received, not invoiced) at PO cost. Damaged quantities record evidence only: they add no valued stock, do not fulfil the accepted order quantity and cannot be invoiced. Replacements can be received later. A delivery's accepted plus damaged quantity cannot exceed the outstanding accepted quantity. Duplicate delivery references per order are blocked, ignoring case/outer spaces.

Do not add the same delivery through a separate manual stock increase. Posted receipts are immutable. Supplier returns, quarantine, disposal and claims need a reviewed external process while those features remain unavailable.

For services, an inventory manager who is not the requester can use **Receipts → Service acceptance**. Select **Load service orders**, choose the order, enter the acceptance date, reference, evidence and quantities, then select **Post service acceptance**. An open period is required. Acceptance records expense against GRNI using the approved service price; it creates no stock movement. It is immutable, and the accepted quantity cannot exceed the order. Service and stock lines use their respective acceptance or receipt paths, including on mixed orders.

### 5. Enter and match the supplier invoice

**Who:** accountant; only its creator revises the draft.

1. Open **Orders & billing → Supplier invoices** and create a draft against one PO.
2. Enter supplier invoice reference, posting/due dates, explanation, line quantities/prices and configured tax codes.
3. Allocate stock lines to eligible accepted goods receipts and service lines to eligible service acceptances. Save the draft.
4. Select **Run three-way matching** and review every exception.
5. For a held matching exception, the accountant chooses an active **Exception reviewer**, enters an **Assignment reason**, and selects **Assign exception**. To transfer an overdue or unavailable reviewer’s case, choose another reviewer, enter the reason and select **Reassign exception**. The owner and assignment time are shown on the invoice; both changes remain in history. The invoice creator cannot be assigned. Older unassigned exceptions need assignment after upgrading to schema 16. Only the current owner can decide the exception, and the reviewer’s register shows their assigned cases.
6. Correct missing receipts, excess quantities, dates and changed tax codes by revising the draft. Price differences beyond the configured tolerance require the assigned, independent business approver to **Accept reviewed price variance** with a reason, or **Return invoice for correction**. Editing or successful rematching clears the assignment; editing also invalidates prior variance acceptance and matching snapshots.
6. Once eligible, post the invoice and inspect its posted status, linked journal, outstanding and available balance.

Only accepted quantities not already consumed by posted invoices may be billed. Drafts do not reserve receipt quantities; posting checks again. Duplicate references per supplier are blocked even for void drafts. Damaged goods cannot be allocated. Posting clears receipt carrying value from GRNI and records AP, configured tax and any reviewed variance. Nonrecoverable tax is expensed in this release.

In **Orders & billing → Taxes**, administrators can set **Invoice price tolerance** in basis points (100 basis points is 1%) and provide a change reason. The initial value is zero. The absolute difference in unit price is compared with the approved order price; posting rechecks the current setting, so changes can affect existing drafts. Increasing tolerance can allow previously held price differences to post without a separate price decision. Missing receipts, excess quantities, date and tax checks remain mandatory. Policy changes are versioned and audited.

Posted invoices cannot be edited/voided. Credit notes, refunds and cancellation of posted invoices are not implemented. Escalate corrections to finance rather than entering an unrelated transaction to conceal a difference.

#### Review invoice source documents

For a saved supplier invoice, select **Review invoice source documents** to load its current order and the goods/service acceptance allocated to each invoice line. The view shows ordered versus invoiced quantities/prices, goods accepted/damaged quantities and damage evidence, service acceptance evidence, and current uninvoiced quantities. It shows only acceptance records allocated by the selected invoice's lines. A missing allocation displays guidance; resolve it through the invoice workflow. The button uses existing order-read permissions and is unavailable on customer invoices. Reload after another user acts. Switching or revising the selected invoice clears loaded source details. Current uninvoiced quantity can include this invoice's allocation while it remains a draft and fall after posting; it is not a matching decision or proof that another invoice can safely post. Existing server matching and posting checks remain authoritative. Rebuild/restart desktop; no migration.

#### Import one supplier invoice from JSON

An accountant opens **Orders & billing → Supplier invoices → New supplier invoice**, then expands **Import supplier invoice JSON**. Paste one version-1 invoice (maximum 64 KiB), select **Replace unsaved invoice fields with this import**, then **Validate and preview invoice JSON**. Validation checks structure and reads live order, goods/service acceptance and tax selections before replacing the form. Invalid input leaves the form unchanged. Preview creates no server invoice. Review the supplier/order, receipt or service allocations, dates, prices, tax and explanation, then select **Save invoice draft**. Existing duplicate-reference, permissions, matching, exception and posting controls still apply; preview is not a matching or posting decision. Only a new unsaved supplier draft supports this action; revise saved drafts using their normal workflow.

For a template, select an order and accepted sources and fill the invoice fields, then select **Use current draft as JSON template**. Blank/invalid form values still need correction before JSON can validate. The format is `{"formatVersion":1,"invoice":{...}}`; invoice fields are `orderId`, `reference`, `date`, `dueDate`, `description` and `lines`. Each line contains `orderLineId`, `receiptLineId` (nullable), `serviceAcceptanceLineId` (nullable; defaults to null), positive decimal-string `quantity`, nonnegative decimal-string `unitPrice` and `taxId`. IDs identify saved records on your server; use one acceptance source per line. The template supplies IDs from your chosen draft. Dates use YYYY-MM-DD. Unknown fields, unsupported versions and invoice arrays are refused. No OCR, PDF/email parsing, bulk import or automatic posting is included. Preview sends the order ID to read saved sources; the invoice payload is submitted for creation only when you save the draft; protect source files under your organisation's invoice-data rules. Rebuild/restart desktop; no migration.

### 6. Prepare and independently approve payment


**Who:** accountant prepares; two assigned business approvers decide.

In **Orders & billing → Payments**, an eligible approver can select **Awaiting my decision** to show submitted payment batches assigned to them that they have not yet decided in the current approval round. Select **Show all permitted payments** to return to the normal register. Refresh and pagination retain the selected view; the queue does not send notifications or change approval authority.

Use **Search payments**, **Payment status** and **Apply payment filters** to find permitted batches by payment number, supplier code or name, or recorded transfer reference. Search and status apply before pagination and combine with **Awaiting my decision**. Refresh, paging and queue switching retain the last applied filters; a status incompatible with the submitted-only queue produces no results. These filters do not change payment or approval records.

1. In **Orders & billing → Payments**, create a batch for one supplier. Allocate amounts to 1–100 posted invoices; partial payment is supported.
2. Select two distinct active business approvers, neither the preparer. Save and review the draft.
3. The preparer selects **Submit payment for approvals**. Submission reserves amounts against other submitted/approved batches.
4. Each assigned approver signs in separately, opens the batch, reviews allocations and enters an approval/rejection reason. One approval leaves SUBMITTED; two make APPROVED.
5. Rejection releases reservations. The preparer can revise and resubmit; both approvals are required again. Cancelling an unexecuted batch releases reservations and retains history.

### 7. Record the confirmed bank transfer

**Who:** authorised accountant, separate from the assigned approvers.

After the transfer has completed outside the ERP, open the approved batch. Enter its actual date and unique bank reference, confirm completion and select **Record supplier transfer**. Inspect executed status and the updated invoice balance. This posts AP against Bank. The ERP does not connect to a bank or send money.

The server rechecks both approvers' eligibility and open-period/balance rules. A bank reference is unique across supplier transfers and customer collections after case/space normalisation. An executed batch cannot be cancelled or edited. Include the transfer in bank reconciliation.

### Worked pilot example

Use synthetic masters, an open current period and the seeded zero-rate **NONE** tax code. Request and order **10 units at INR 100.00**. Receive **6 accepted and 1 damaged**: stock and GRNI increase by **INR 600.00**, while **4 units remain to be accepted**. Record a second delivery of **4 accepted**, making total accepted value **INR 1,000.00**. The damaged unit remains evidence only.

Invoice the ten accepted units at the ordered price: GRNI clears and AP becomes **INR 1,000.00**. Obtain both approvals and record a confirmed **INR 600.00** transfer: AP outstanding becomes **INR 400.00**. A second separately approved confirmed payment can clear the balance. Reconcile both actual bank entries. This example assumes no prior balances, cost differences or taxes; finance should agree expected figures before pilot execution.

See [trade workflows](TRADE_WORKFLOWS.md) and [trade posting rules](TRADE_POSTING_RULES.md).

## Accounting and period management

**Who:** accountant; administrator/auditor have reporting access.

1. In **Accounting & stock → Chart & periods**, review fixed system accounts and create any needed manual accounts. Codes/types/mappings stay fixed; inactive accounts retain historical balances.
2. Create inclusive, non-overlapping accounting periods. Posting dates must fall within an open period and cannot be later than the database's current date.
3. In **Journals → New journal**, enter date, explanation and 2–100 lines. Each line has one positive debit or credit. Total debits and credits must agree exactly and be nonzero.
4. Enter amounts with at most two decimal places, without commas or scientific notation. Choose a cash-flow category for manual bank journals. Save the balanced draft, inspect it and select **Post journal**.
5. To correct a posted manual journal, enter an open reversal date and reason and select **Create posted reversal**. A manual journal can be reversed once; posted sources stay immutable.

Inventory, GRNI, AP, AR and input/output-tax controls are maintained by their source workflows. Manual journals cannot post to those controls; stock/source journals cannot be reversed through the manual journal screen. A bank posting at or before a finalised bank-statement cutoff is blocked.

Before closing a period, resolve its draft journals/invoices and stock, AP, AR and GRNI differences. Enter a reason and use **Close**. Reopening also requires an accountant and reason and does not change old postings. Review [accounting/inventory](ACCOUNTING_INVENTORY.md) and [posting rules](ACCOUNTING_POSTINGS.md) for detailed controls.

## Warehouses and stock

**Who:** inventory manager.

Open **Accounting & stock → Warehouses & stock**, create active warehouses and refresh balances before posting. Choose the appropriate movement, date, item, warehouse, quantity and explanation. Incoming increases require unit cost; transfers require an active destination warehouse.

| Movement | Use |
| --- | --- |
| OPENING | Approved opening stock, once before any entry for that item/warehouse. |
| INCREASE | Explained added stock at entered incoming cost. |
| DECREASE | Explained removal at current carrying average. |
| CONSUME | Consumption at current carrying average. |
| TRANSFER | Move stock/value between warehouses atomically. |
| COUNT | Enter actual physical quantity, including zero; the difference posts an adjustment. An increased count requires cost. Start the balance before counting an existing version. |

Quantities and incoming unit costs allow six decimal places. Valuation uses moving weighted average per item/warehouse with monetary values rounded to paise. Transfers preserve source carrying value and recalculate the destination average. Negative stock is blocked. Valued inventory cannot be backdated before the latest stock movement; review the current sequence before entering corrections.

Movements and their linked journals post together. Movements are immutable; corrections require new explained adjustments at current cost. Counts post directly under inventory permission; separate adjustment approval and count-sheet storage remain future work. Purchase receipts belong in **Receipts** to keep order fulfilment and GRNI correct.

## Customer invoicing and collections

**Who:** accountant. An administrator first creates the customer master.

1. Open **Orders & billing → Customer invoices**, enter the customer code, reference, posting/due dates and service/non-stock lines with configured tax codes.
2. Save and review the draft, then post. This records AR, sales and output tax.
3. After receiving cleared funds, open **Collections**, select the customer and posted invoices and allocate full/partial amounts.
4. Enter the actual bank date/reference, confirm clearance and record the collection. Check the reduced outstanding balance and include the bank entry in reconciliation.

Collections cannot exceed eligible balances, cross customers, predate invoices or reuse a transfer/collection reference. They are immutable. This invoice workflow does not dispatch inventory or calculate cost of goods sold. Deposits on account, customer credit notes/refunds and sales order fulfilment remain future work.

## Tax, reports and reconciliation

### Tax configuration

Accountants use **Orders & billing → Taxes** to create/revise named codes with rate, effective dates, recoverability and active state. Rates range from 0–100 percent, with up to four decimal places. Codes stay fixed. Invoice lines snapshot the selected tax details; editing an effective code may require draft re-review. The seeded **NONE** code has a zero rate.

The current calculations use exclusive prices and round each line's net/tax to paise. INR is the currency choice; it does not select an Indian tax jurisdiction. Country-specific tax rules, GST filing, withholding, inclusive/compound tax and remittance workflows require further implementation and professional configuration.

### Reports

Open **Orders & billing → Statements** and select the relevant date range or cutoff. Authorised readers can review:

| Report | Review |
| --- | --- |
| AP/AR ageing | Posted supplier/customer amounts less actual payments/collections through the cutoff. |
| Supplier delivery follow-up | For issued purchase orders dated within the range that have a dated supplier acknowledgement, review promised orders completed on time, completed late, still open and overdue, or still open and not due. |
| Issued purchase order value | For issued purchase orders dated within the range, review order count, line count, original estimated net value, still-open order count and estimated unaccepted net value grouped by the supplier saved on the order. |
| AP/AR/GRNI controls | Subledger versus general-ledger differences; investigate any difference. |
| Income statement | Posted income/expense activity within the range. |
| Balance sheet | Cumulative assets, liabilities, equity and unclosed earnings; review the balance difference. |
| Cash flow | Bank opening/closing and operating/investing/financing categories; review unclassified lines. |
| Tax summary | Posted input recoverable/nonrecoverable and output amounts by snapshotted code/rate. |

In **Accounting & stock → Reconciliation**, review stock valuation versus inventory control, current stock projections versus immutable movements, and the trial balance. Historical reports do not reconstruct old balance projections. Differences require investigation; the application does not automatically post them away. These are operational reports; statutory presentation, accountant review and report export capabilities require separate acceptance.

Supplier delivery follow-up uses the latest acknowledged expected date for each order. Completion requires accepted quantities for every stock and service line; rejected or damaged quantities do not count. The open/overdue status is evaluated today, so it changes over time and when a supplier promise is revised. Orders without a dated acknowledgement are excluded. This live operational view is not a historical supplier score or a measure of delivery quality.

Issued purchase order value includes all ordered quantities, even when already received or invoiced. Cancelled orders are excluded. It is not the remaining commitment, tax-inclusive spend, accounts payable balance or payment amount. Compare it with invoiced spend only after checking that the selected order-date and invoice-date ranges refer to the same transactions.

**Unaccepted net** uses each order line's remaining quantity after accepted goods receipts or service acceptances, multiplied by its saved unit price. Damaged goods do not reduce the amount. It is recalculated when you run Statements; the order date controls which orders are included, while receipts and service acceptances are counted through the current record state. It is an operational estimate, not a historical cutoff or an approved accounting commitment. Check the order and receipt records before using it for purchasing decisions.

### Bank reconciliation

**Who:** accountant, in **Accounting & stock → Bank statements**.

1. Enter account, inclusive dates, opening/closing balances and up to 100 signed statement lines. Positive amounts increase Bank; negative amounts reduce it. A zero-line statement is supported.
2. Confirm opening plus signed movements equals closing, then save the draft. Statements for the same account cannot overlap.
3. Match each statement line to one posted bank ledger line of exactly the same signed amount. Older outstanding ledger lines can clear on a later statement. Post legitimate missing fees/interest as journals before matching them.
4. Review expected opening, outstanding ledger entries and adjusted closing. Statement closing plus outstanding ledger must equal ledger closing.
5. Finalise earlier drafts first and follow the preceding finalised statement contiguously. Finalisation makes the statement/matches immutable and protects bank postings through its cutoff.

Revising a draft clears its matches, so recheck all lines. Bank-file import, split/combined matching and bank connectivity remain future work.

## Export P2P reports

Users with finance reporting access can open **Orders & billing → Statements**, run the desired date range, then use **Export P2P reports**. Choose **Export Supplier invoiced spend CSV**, **Export Item invoiced spend CSV**, **Export Issued purchase order value CSV**, **Export Supplier delivery follow-up CSV** or **Export Supplier exceptions and rework CSV**. Choose a location in the Windows save dialog; cancelling creates no file. Export uses the range of the loaded report, even if you subsequently edit the date fields. It fetches fresh server data after the save dialog, so values can differ from an earlier screen. Each data row includes the range, currency and UTC export time. Empty reports contain column headings only. Item spend export is blocked when its reconciliation fails.

These CSV files contain supplier names and identifiers; store and share them under your organisation's reporting-access rules. Spreadsheet formula prefixes are escaped as text. CSV contains the selected report's explicit columns, without credentials, contact details or audit snapshots. Report date definitions and limitations still apply. No database migration is required; rebuild and restart the desktop. Other register exports, bank files and system integrations remain pending.

## Master imports

**Who:** administrator for customers/suppliers/items; purchasing for suppliers/items.

1. Open **Operations & privacy → Master imports** and choose **Record type**.
2. Paste a JSON array of 1–100 new records into **Records as JSON**. For example:

   ```json
   [{"code":"PILOT-ITEM-01","name":"Pilot widget","unit":"EA","active":true}]
   ```

3. Select **Run import dry run**. Correct every row error and review the **Normalized preview**, including defaults and uppercase codes/units.
4. Check **I reviewed these records and want to create all of them**, then **Commit reviewed import** within 30 minutes using the same account.
5. Check the successful count and master register. The batch creates all rows together or none.

Supplier imports use the same duplicate review. A row that matches an existing supplier, or another row in the batch, needs a `duplicateReviewRef` from the reviewed source data (for example `SUP-REVIEW-042`). The preview flags missing references, and commit checks again for concurrent records. A newly found duplicate without a reference rolls back the whole batch. The reference and matching supplier codes are retained in history and audit; do not put personal or banking details in it.

The import steps at the top provide orientation: prepare records, review the dry run, then commit the reviewed import. A displayed dry run may contain errors and does not by itself mean the batch can be committed.

Existing/duplicate codes are rejected. Changing input requires a new preview; a dry run creates no masters. Imports create new masters only. CSV/Excel, record updates, accounts/users, opening balances and posted transactions are outside this importer. See [templates and privacy operations](IMPORTS_AND_PRIVACY.md).

## Privacy requests

**Who:** administrator, following the organisation's privacy decision process.

1. Verify identity outside the ERP using the approved restricted case system.
2. Open **Operations & privacy → Privacy requests**. Choose subject type, enter its UUID (customer code for customers), request type, actual original receipt date and identity-verification ticket reference.
3. Create/review the case and its due date. The displayed target is one calendar month from original receipt; verification does not restart the clock. Manage applicable extensions, communications and legal decisions in the external case system.
4. For an ACCESS case, prepare the extract, review third-party information, supplement missing records/context and transfer it through the approved secure process. The displayed extract clears when leaving the workspace; it is not automatically sent or saved to a file.
5. Record an authorised decision/reference using the appropriate action below.

| Action | Effect and required review |
| --- | --- |
| Record completed review / refusal | Saves the reviewed decision/reference. Completion does not itself edit or erase data. |
| Apply/release legal hold | Records a subject-wide guard; a hold on any case prevents minimisation and release of restrictions. Holds may remain after case closure. |
| Restrict current use | For user/supplier restriction cases, makes the record inactive/restricted; user sessions are revoked. |
| Release restriction | Leaves the record inactive for separate authorised reactivation. A legal hold blocks this action. |
| Minimise current data; retain history | For eligible erasure cases, clears supplier contacts or retires a user and removes current authentication material. Requires retention review and no subject hold. |

Minimisation retains financial history, audit/snapshots, old retry responses, free text and backups and records `APPLIED_WITH_RETENTION`. Maintain a separate restricted retention/deletion register with decisions, legal basis, review dates and remaining copies. Customer restriction/erasure requires a reviewed manual process; automatic application is blocked. Rectification uses the available authorised editing process and then records the outcome.

Keep identity documents and correspondence out of reference fields. Access extracts omit authentication secrets but still contain personal data; supplement them with relevant historical/free-text records and response context before disclosure. Supplier extract includes quote headers; quote line details need separate review. Extracts above the interactive limit require an operator-reviewed offline process. After a restore, the operator must replay post-backup restrictions/minimisations before admitting users. See [privacy operations](IMPORTS_AND_PRIVACY.md). These features support privacy work; organisational GDPR compliance needs its own assessment.

## History, conflicts and uncertain saves

Use **History**, **Load record history** or **Load transaction history** on authorised record screens to see versions, actors, actions and saved snapshots. The record UI shows the latest 200 versions; the database retains earlier history. Administrator/auditor **Account security and access → Audit history** supplies broader security/business events with pagination.

If another user changed a record, a version conflict prevents overwriting their work. Refresh, reopen the latest version, review the change and deliberately reapply your edit/decision. Never bypass the conflict by changing database rows.

If a save/post/transfer times out, its outcome may be uncertain:

1. Keep the current workspace open and preserve the entered values.
2. Refresh its register/detail and check document number, reference, state, balance and history.
3. If unresolved, retry the unchanged action while that workspace remains open. Supported writes reuse the pending retry key to avoid a duplicate successful operation.
4. If you have already closed/reloaded/switched workspaces or signed out, ask the operator to verify the server result before entering it again. Pending keys are not persisted across those boundaries.

Changing input creates a different operation. Reference uniqueness is an additional safeguard, not a replacement for checking an uncertain result. Never repeat an external bank transfer because the ERP response was lost.

## Troubleshooting and support

| Symptom | Action |
| --- | --- |
| Cannot connect / server not ready | Check the supplied HTTPS origin, network/VPN and server availability with IT. Use localhost only for a server on this PC. |
| Certificate/remote HTTP rejected | Ask IT to correct HTTPS, hostname and certificate trust. Do not bypass certificate checking. |
| Invalid login / disabled account | Check email/password privately; ask the access administrator to review account status. Respect attempt limits. |
| MFA code rejected | Check latest enrolment key, correct account and automatic device/server time; wait for a fresh code or use an unused recovery code. |
| Session expired | Sign in again, refresh the record, and verify any uncertain prior action before re-entry. |
| Missing workspace / permission denied | Ask the administrator to review the actual role and record assignment. Administrator status does not grant business approvals or posting. |
| Item/supplier not selectable | Search further; check active state, role scope and current master version. |
| Version conflict | Refresh and review the latest record before applying a new edit. |
| Closed period / date rejected | Finance checks the period, database date, latest stock movement and finalised bank cutoff. |
| Invoice cannot match/post | Review eligible accepted receipts, quantities, dates, tax snapshots and independent price-variance decision. |
| Payment unavailable | Check reservations, outstanding amount, current version, two independent approvals and both approvers' active roles. |
| Cannot progress from order to receipt, invoice or payment | Have the administrator provision the missing inventory-manager/accountant accounts and a second independent business approver. Sign in using the role responsible for that stage; each account completes MFA. |
| Stock or ledger difference | Stop related close/posting decisions and ask finance/inventory to investigate source documents and history. |
| Workspace cannot be displayed | Verify uncertain transactions, then use **Reload workspace**. Unsaved forms may be lost. |
| Database/schema unavailable | Operator checks migrations and deployed versions using the operations runbook. Ordinary users should not change `.env` or database tables. |

Use **Diagnostic logs** in the footer or **Open diagnostic logs** on an error to open the desktop log folder. Send support the time/timezone, client version, workspace/action, document reference, visible error/request reference and whether the operation may have succeeded. Have the operator review/redact the relevant log excerpt before sharing through an approved channel. Exclude passwords, setup/MFA/recovery codes, `.env`, tokens, identity evidence and unnecessary personal/financial data.

## Daily checks and current limits

At the start of work, confirm the intended company server/account, refresh the relevant registers and check open-period/warehouse/master setup. At the end of work, review pending requests, receipts awaiting invoices, matching exceptions, reserved/approved payments and unrecorded confirmed transfers. Finance checks AP/AR/GRNI, stock reconciliation, trial balance and bank outstanding entries; users sign out when finished.

The operator separately reviews backup results and recovery rehearsal evidence. Backup tooling exists; scheduling, off-host copies, monitoring and restore authority require deployment setup. No backup/restore button or automatic update service is supplied by the desktop.

Current boundaries include fixed roles/policies, one company per deployment, INR books, no foreign-currency conversion, no statutory tax filing, no supplier/customer credit notes or refunds, no stock returns/quarantine, no sales inventory dispatch/COGS, no bank connection and no implemented last-administrator emergency recovery. Financial opening migration and legacy Python data conversion are not covered by master imports. Pilot accessibility, performance, signed-release and deployment evidence remain acceptance work; see the [next sprint](NEXT_SPRINT_PLAN.md).

## Planned modules and availability

The [ERP module roadmap](ERP_MODULE_ROADMAP.md) proposes Finance completion, CRM/Sales, broader Supply Chain, HR and Marketing using [ERPNext/Frappe workflow references](ERPNEXT_MODULE_CROSSWALK.md). The proposed [Core and Finance epic and stories](CORE_FINANCE_EPIC_AND_STORIES.md) provide more detail for the first expansion phase. The [draft Finance decision record](CF01_FINANCE_DECISION_RECORD.md) collects unresolved scope and policy decisions and synthetic examples for review; it is not approved or authority to post. The [draft correction posting contract](CF05_CORRECTION_POSTING_CONTRACT.md) proposes return, credit and refund rules and fixtures for independent Finance and accountant review; it is not approved or implemented. These are development plans, not additional installed workspaces. Current source is version 0.2.0 / schema 16; the operator must confirm your deployed versions separately.

| Area | What you can use now | Planned addition |
| --- | --- | --- |
| Finance | Current books, AP/AR, recorded payments/collections, reconciliation and statements described above. | Credits/refunds, controlled opening migration, budgets/cost centres and bank-file matching. |
| Sales and CRM | Customer register and service/non-stock invoicing/collections. | Contacts, leads, opportunities, quotations, orders, stock reservation/dispatch/COGS and linked sales returns. |
| Supply Chain | Current purchasing, manual quotation comparison, accepted receipts, warehouses, stock and transfers. | Replenishment, RFQs and quote award, quality/quarantine, returns and independent count adjustment. |
| HR | Login accounts support application access; they are not employee profiles. | Employees, leave/attendance and independently approved expenses. Payroll needs a separate reviewed jurisdiction. |
| Marketing | No campaign, audience or communication-sending workspace. | Campaign planning, eligible audiences, source/results reporting; outbound delivery separately selected and accepted. |

The proposed [CRM epic and user stories](CRM_EPIC_AND_USER_STORIES.md) detail future lead, contact and opportunity workflows. The [CRM-01 decision draft](CRM01_SCOPE_DECISION_RECORD.md) sets out candidate identity, access and workflow rules for stakeholder review; reviewers and decisions remain outstanding. These documents do not enable CRM screens, permissions or imports in the current application.

Continue using the actual workspace names and steps in this guide. Current master-import templates do not accept employees, leads or campaign audiences. There are no module enable/install actions in this release, and upgrading the desktop alone does not add server/database workflows. The [controlled pilot](NEXT_SPRINT_PLAN.md) keeps its existing scope; new module instructions, permissions, imports and upgrade steps will be documented when implemented and accepted. No operator action is required by this planning revision.

## Guide maintenance and revision history

This is the maintained entry point for user instructions. Every application, configuration, deployment, security or operating-workflow change must review this guide in the same change. Update affected steps, screen labels, roles, examples, troubleshooting and limits, plus the baseline/date and revision table. For an internal change with no task impact, add a dated review entry explaining that conclusion. Planned features stay labelled planned until implemented. Review against actual source/screens and applicable verification; document review alone does not establish deployment acceptance.

The root [contributor instructions](../AGENTS.md) and [documentation maintenance process](USER_GUIDE_MAINTENANCE.md) define ownership and the checklist. `npm run docs:check` checks local links/baseline and requires this guide to change alongside covered repository changes. CI checks committed changes against its event base. The check detects missing updates; a reviewer must judge correctness and completeness. A repository setting must require the CI check if merges are to be blocked. The guide is maintained through changes, rather than rewritten automatically from code.

| Date | Baseline / change | Guide update |
| --- | --- | --- |
| 2026-11-28 | 0.2.0 / schema 16; invoice source review | Added inline order and allocated goods/service acceptance review on saved supplier invoices, including price/quantity comparison and current uninvoiced amounts. Existing read permissions; desktop update only, no migration. |
| 2026-11-28 | 0.2.0 / schema 16; supplier invoice JSON preview | Added versioned single-invoice JSON validation and preview into a new unsaved supplier draft, with explicit field replacement and unchanged save/match/post controls. Desktop update only; no migration. |
| 2026-11-28 | 0.2.0 / schema 16; supplier qualification renewal queue | Added a permission-scoped server filter for approved qualifications expiring today through 30 days ahead, with boundary, refresh and renewal-review guidance. Update client/server together; no migration or automated reminder. |
| 2026-11-28 | 0.2.0 / schema 16; mandatory supplier qualification policy | Added server-only REQUIRE_SUPPLIER_QUALIFICATION, default false, to require approved/unexpired qualification for all new orders when enabled. Reviewed onboarding queues and activation/restart steps. No migration; existing installations were not reconfigured. |
| 2026-11-28 | 0.2.0 / schema 16; related-service desktop verification | Corrected the related-documents test locator to target the enabled control. The isolated multi-role desktop workflow completed with exit code 0, including inline service evidence and uninvoiced quantity after invoice posting, plus sampled automated accessibility. No application workflow, permissions or migration changed; installation and human acceptance remain separate. |
| 2026-11-28 | 0.2.0 / schema 16; related order service acceptances | Added inline service evidence, accepted/uninvoiced quantities, entry timestamps and history under an order's related documents. Rebuild/restart desktop; no migration or new permissions. |
| 2026-11-28 | Desktop test maintenance | Aligned the explicit preload API allowlist, supplier-filter button label and invoice-reviewer assignment step with implemented workflows. The attempted full desktop run stopped at an ambiguous related-documents locator before service-view verification; it is not recorded as a UI pass. |
| 2026-11-28 | 0.2.0 / schema 16; service acceptance entry lag | Added recorded timestamps and UTC-calendar entry-lag cues and 1/3/7-day per-order filters to service acceptance. Update desktop/server together; no migration or accounting change. |
| 2026-11-28 | 0.2.0 / schema 16; approver holding times | Added completed per-assignment intervals with historical assignee, UTC end-date filters and elapsed hours. Documented open-assignment exclusion and working-time/SLA limits. Update client/server together; no migration. |
| 2026-11-28 | 0.2.0 / schema 16; historical approval cycles | Added permission-scoped, paged reporting over retained approval/rejection history, including earlier resubmission cycles. Documented UTC decision-date filters, elapsed-time limits and refresh behaviour. Update client/server together; no migration. |
| 2026-11-28 | 0.2.0 / schema 16; P2P CSV export | Added five permission-checked P2P report exports through Windows save dialogs, with formula protection, reporting metadata and supplier-data handling guidance. Desktop update only; no migration. |
| 2026-11-28 | 0.2.0 / schema 16; description amendments | Added Purchasing proposals and independent business decisions for issued-order descriptions, version expiry and retained history. No migration; update client and server together. Quantity/price amendments and split sourcing remain pending. |
| 2026-11-28 | 0.2.0 / schema 16; supplier exception and rework report | Added permission-scoped period totals for damaged receipts and immutable supplier-invoice matching holds, grouped by supplier. Update desktop and server together; no migration. The report is an operational cue and does not assign supplier fault. |
| 2026-11-28 | 0.2.0 / schema 16; internal migration-test maintenance | Reviewed desktop tasks after aligning three upgrade-test expectations with schema 16 and the complete migration sequence. No user workflow, permission, schema, deployment or operator procedure changed. |
| 2026-11-27 | 0.2.0 / schema 10; payment approval queue | Added a permission-scoped queue for submitted batches awaiting the signed-in approver's decision in the current round. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; approval waiting time | Added an elapsed-time cue to submitted requests; documented its clock, refresh and SLA limitations. Rebuild and restart the desktop; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; upcoming supplier invoices | Added a database-date filter for outstanding supplier invoices due in the next seven days. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; supplier invoiced spend | Added period-based supplier invoice totals to financial statements. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; supplier duplicate contacts | Extended the supplier save advisory to matching email and phone, with permission-scoped checks. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; aged open orders | Added a database-date filter for orders outstanding at least 30 calendar days. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; related order documents | Added links from an order to its receipts and permitted supplier invoices. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; supplier contact and approval queues | Added permission-restricted supplier contact-completeness filters and server-side request waiting-time filters. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; payment register filters | Added permission-scoped payment search and status filters, including their interaction with the approval queue. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 12; invoice matching policy | Added administrator-controlled unit-price tolerance, defaulting to zero, with versioned audit and posting-time rechecks. Back up and migrate before updating desktop and server together. |
| 2026-11-27 | 0.2.0 / schema 13; linked quotations | Added optional quotation-linked purchase orders with eligibility and approved-price checks. Back up and migrate before updating desktop and server together. |
| 2026-11-27 | 0.2.0 / schema 13; approver handoff | Added reasoned reassignment by the current approver with independent replacement and history. Update desktop and server together; no additional migration is required. |
| 2026-11-27 | 0.2.0 / schema 14; service purchasing | Added service items, independent service acceptance, supplier invoice allocation and GRNI reconciliation. Back up and migrate, then update desktop and server together; Finance must review the posting treatment before production use. |
| 2026-11-27 | 0.2.0 / schema 14; receipt register filters | Added receipt/order/reference search and a damaged-deliveries filter. Update desktop and server together; no additional migration is required. |
| 2026-11-27 | 0.2.0 / schema 14; approval workload | Added a permission-scoped, paged approval workload table with pending ageing and latest-cycle decision duration. Update desktop and server together; no additional migration is required. |
| 2026-11-27 | 0.2.0 / schema 14; supplier duplicate review | Added transaction-time duplicate review for supplier saves and imports with an audited reference. Update desktop and server together; no additional migration is required. |
| 2026-11-27 | 0.2.0 / schema 14; P2P team test guide | Reviewed current tasks and added a shareable synthetic test checklist and Phase Two gap register. No application, schema or operator deployment change is implied. |
| 2026-11-28 | 0.2.0 / schema 16; item invoiced spend | Added stock/service item totals to Statements for posted supplier invoice lines, with a reconciliation warning against supplier invoiced totals. Update desktop and server together; no migration. |
| 2026-11-28 | 0.2.0 / schema 16; supplier delivery follow-up | Added dated-promise completion and open-order counts to Statements. Update desktop and server together; no migration or automatic supplier notification. |
| 2026-11-28 | 0.2.0 / schema 16; issued order value | Added supplier-grouped original estimated net value for issued purchase orders in Statements. Update desktop and server together; no migration. This is not an open commitment balance. |
| 2026-11-28 | 0.2.0 / schema 16; unaccepted order value | Added still-open order counts and current unaccepted net estimates alongside issued order value. Update desktop and server together; no migration. This is an operational estimate rather than a financial commitment ledger. |
| 2026-11-28 | 0.2.0 / schema 16; invoice exception ownership | Added accountant assignment and reasoned reassignment of held supplier invoice exceptions to active independent reviewers. Reviewers see only assigned cases; Finance can filter unassigned and 24-hour cases. Back up and apply schema 16, then update desktop and server together. |
| 2026-11-28 | 0.2.0 / schema 15; qualification queue and payment deadlines | Added server-side supplier qualification filters and permission-scoped due-invoice counts in supplier finance screens. Update desktop and server together; no migration or automatic notification. |
| 2026-11-28 | 0.2.0 / schema 15; delivery attention | Added server-based overdue-promise and aged-open-order counts to Purchasing Overview for users with order access. Update desktop with the matching server; no new migration or automatic notification. |
| 2026-11-28 | 0.2.0 / schema 15; supplier order gate | New orders require approved, unexpired qualification once a supplier has a qualification record; suppliers without a record remain eligible. Update client and server together; no new migration. |
| 2026-11-28 | 0.2.0 / schema 15; supplier qualification | Added reference-only supplier registration and expiry tracking with an independent administrator review. Apply schema 15 after backup and update desktop and server together. This does not validate registrations or gate orders. |
| 2026-11-28 | 0.2.0 / schema 14; receipt entry lag | Added a UTC calendar-day entry-lag cue and server-side 1/3/7-day filter to the goods receipt register. Update desktop and server together; no migration is required. |
| 2026-11-27 | 0.2.0 / schema 14; isolated factory demo | Documented a local fictional factory dataset, separate API and demo sign-in. Demo records and test access are not production data; no business-database migration is implied. |
| 2026-11-27 | 0.2.0 / schema 11; quotation recommendations | Added non-binding, reasoned quotation recommendations with history and supplier privacy extract entries. Back up and migrate, then update desktop and server together. Deployment and business acceptance remain separate. |
| 2026-11-27 | 0.2.0 / schema 10; supplier acknowledgement | Added manual, versioned order acknowledgement with an optional promised date and history. Update desktop and server together; no schema migration or supplier transmission is required. |
| 2026-11-27 | 0.2.0 / schema 10; approval queue ordering | Assigned requests now appear in submission order, oldest first, including after reassignment. Other request-register ordering is unchanged. Update the server; no migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; supplier duplicate review | Added a permission-restricted exact-name advisory during desktop supplier save, including inactive matches and an explicit save-anyway choice. Updated limitations: it is not legal-entity verification or a database uniqueness rule. Update client and server together; no schema migration. |
| 2026-11-27 | 0.2.0 / schema 10; outstanding receipts | Added the permission-scoped **Awaiting accepted goods** order filter. Updated its meaning for partial and damaged deliveries. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; order search | Added server-side purchase-order search and issued/cancelled filters with pagination. Update desktop and server together; no schema migration is required. Issued does not necessarily mean unreceived. |
| 2026-11-27 | 0.2.0 / schema 10; due invoice filters | Added permission-scoped overdue and due-today filters over the full supplier invoice register. Documented the database-date basis and difference from local row cues. Update desktop and server together; no migration required. |
| 2026-11-27 | 0.2.0 / schema 10; supplier invoice search | Added server-side supplier invoice search and status filtering, including matching exceptions, with permission-scoped pagination. Update desktop and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 10; supplier invoice due visibility | Added display-only overdue and due-today cues for posted supplier invoices with outstanding balances. Documented local-date, refresh and page limitations; no payment, schema or accounting behaviour changed. Rebuild and restart the desktop. |
| 2026-11-27 | 0.2.0 / schema 10; approval visibility | Added pending approver and submission time to the permitted request register and documented refresh and reassignment behaviour. Added the [business problem map](P2P_BUSINESS_PROBLEM_MAP.md); proposed capabilities remain unimplemented. Rebuild and restart the desktop; no schema migration is required. |
| 2026-11-27 | Phase One P2P assessment | Added the [source and operations assessment](P2P_PHASE_ONE_ASSESSMENT.md) and prioritised gap register. This is an assessment, not new functionality or deployment evidence; current user and operator procedures are unchanged. |
| 2026-11-27 | 0.2.0 / schema 10; Project X desktop identity | Updated the visible desktop name, navigation rail and account controls. Existing Windows installer/shortcut naming and the saved profile identity remain unchanged; rebuild and restart the desktop to see the new interface. No schema or permissions change; deployment and business acceptance remain separate. |
| 2026-11-27 | 0.2.0 / schema 10; product workspace design | Updated the shared shell and customer register, accounting and stock/bank screens, billing registers and transaction forms, import/privacy guidance and security sections. Reviewed task names and role limits against the specialist guides; permissions and database schema are unchanged. Rebuild/restart the desktop to use the changes. Source changes do not establish deployment or business acceptance. |
| 2026-11-27 | Product design review | Added [proposed product-wide wireframes](PRODUCT_WIREFRAMES.html) and a [design handoff](PRODUCT_DESIGN_SPEC.md). They do not change existing tasks, permissions, schema or operator procedures; deployment and acceptance are not implied. |
| 2026-11-27 | 0.2.0 / schema 10; workspace navigation | Standardised section navigation across Purchasing, Accounting & stock, Orders & billing, and Operations & privacy. Added a purchasing overview with request counts and role-aware shortcuts. Existing permissions and tasks remain in effect; save work before switching sections. No schema change. |
| 2026-11-27 | 0.2.0 / schema 10; quote withdrawal | Added permanent reasoned quote withdrawal, audit and supplier access-extract details. Isolated API, populated schema 9 upgrade, desktop and recovery checks passed. Back up and migrate, then update client and server together; deployment and business acceptance remain separate. |
| 2026-11-27 | 0.2.0 / schema 9; supplier quotations | Added manual quotation capture and comparison for approved requests, permissions, supplier privacy extract headers and order limitations. Isolated API and recovery tests passed; back up and migrate the database, then update client and server together. Tests do not establish deployment or business acceptance. |
| 2026-11-27 | 0.2.0 / schema 8; request overview and approval queue | Added permission-scoped request counts, status shortcuts and an assigned-to-me queue; explained search and refresh behavior. Added a [public-reference capability review](PURCHASING_CAPABILITY_REVIEW.md); it is planning evidence, not production acceptance. Update client and server together; no schema migration is required. |
| 2026-11-27 | 0.2.0 / schema 8; integration review | The API integration suite passed against a separate disposable PostgreSQL 18 database, including purchasing approval and queue tests. No user task or installation procedure changed; this does not establish desktop or deployment acceptance. |
| 2026-11-26 | 0.2.0 / schema 8; request withdrawal and reassignment | Added requester withdrawal to draft and reassignment to another independent approver, with history and resubmission guidance. Client and server need updating together; no schema migration is required. |
| 2026-11-20 | 0.2.0 / schema 8; CRM-01 decision draft | Reviewed customer creation, roles, imports, privacy, recovery and planned CRM limits against the proposed identity and workflow rules. Current tasks and operator procedures remain unchanged; continue using existing customer workflows. Stakeholder review, migration and release decisions remain open; no deployment or acceptance is implied. |
| 2026-11-19 | 0.2.0 / schema 8; CRM story refinement | Reviewed customer creation, roles, imports, privacy and planned CRM limits against the proposed backlog. Added a planning reference; existing workflows and operator procedures are unchanged. No new module, migration, deployment or acceptance is implied. |
| 2026-11-19 | 0.2.0 / schema 8; CF-05 draft contract | Reviewed receipt, invoice, collection, accounting and correction limits against the proposed contract. Current tasks and operator procedures are unchanged; continue escalating unsupported corrections to Finance. Independent Finance calculation, accountant approval and CF-01 decisions remain outstanding; no migration or deployment is implied. |
| 2026-11-19 | 0.2.0 / schema 8; CF-03 identity recovery | Added two-administrator recovery, token handling, MFA re-enrolment, cancellation and escalation guidance. Upgrade client and server and migrate after backup; operator verification and emergency procedures still require local adoption and rehearsal. |
| 2026-11-19 | 0.2.0 / schema 7; CF-03 draft threat review | Reviewed sign-in, recovery codes, privacy restriction and last-administrator guidance against the proposed recovery design. Operator-assisted recovery remains unavailable; no policy approval, operator rehearsal, schema migration or deployment is implied. |
| 2026-11-17 | 0.2.0 / schema 7; FUP-01 password change | Reviewed sign-in, session revocation, password limits and uncertain responses against the new desktop and API flow. Upgrade client and server together; no schema migration or deployment acceptance is implied. |
| 2026-11-17 | 0.2.0 / schema 7; CF-01 draft decision record | Reviewed current Finance posting, opening, report and privacy limits against the draft scope and synthetic examples. No user workflow, role, configuration, version or schema changed; operators should continue current procedures and obtain Finance review before any release decision. |
| 2026-11-17 | 0.2.0 / schema 7; Core and Finance story refinement | Reviewed sign-in/access, purchasing and Finance corrections, openings, reports, privacy and recovery limits against the proposed CF-01–21 backlog. Added a planning reference; no current task, role, operator procedure, application version or schema changed. No operator action or deployment acceptance is implied. |
| 2026-11-17 | 0.2.0 / schema 7; module expansion plan | Reviewed current navigation, roles, service AR, stock/purchasing, imports/privacy and deployment limits against the proposed six-module scope. Added an availability table and roadmap/reference links; current task instructions and application/schema baseline remain unchanged. Operator implication: no module enablement, migration or installation required by this documentation change. No new UI/test/deployment acceptance is established. |
| 2026-11-16 | 0.2.0 / schema 7 | Initial consolidated guide: connection, MFA/access, masters, procure to pay, books/stock, AP/AR, tax/reconciliation, imports/privacy, history, recovery boundaries and support. Added same-change maintenance instructions and documentation check. Reconciled current-schema and implemented-scope statements in the linked workflow documents and README. Reviewed against source; hosted CI and deployed environment acceptance are not established by this documentation change. |
| 2026-11-16 | Procure-to-pay setup troubleshooting | Added an active-role preflight and missing-account troubleshooting. Local checks passed: API readiness, PostgreSQL connectivity, migration checksums through schema 7, TypeScript, eight unit tests and seven isolated API integration tests. These checks do not establish desktop UI or pilot acceptance. |
| 2026-11-16 | Receiving prerequisite ownership | Clarified administrator, accountant, purchasing and inventory-manager responsibilities before receiving. Confirmed against the role registry and server permission guards; business permissions are unchanged. |

For specialist references, use [authentication](AUTHENTICATION.md), [procurement](PROCUREMENT.md), [books/stock](ACCOUNTING_INVENTORY.md), [trade](TRADE_WORKFLOWS.md), [imports/privacy](IMPORTS_AND_PRIVACY.md), [operations](OPERATIONS_RUNBOOK.md) and [Windows installers](WINDOWS_INSTALLER.md). Older schema-specific activation sections describe the release that introduced a feature; the current development source requires schema 16. Confirm actual deployed schema with the operator.
