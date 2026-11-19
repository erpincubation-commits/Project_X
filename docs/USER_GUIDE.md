# SMB ERP desktop user guide

**Last reviewed:** 19 November 2026

**Application baseline:** package version 0.2.0, implemented workflows through database schema 8<br>
**Audience:** Windows desktop users, administrators, purchasing, inventory and finance teams

This guide describes the current Electron application connected to a shared on-premises server. Your administrator must confirm the installed client, server and database match this baseline. The version in the source tree does not establish which version is running at your company. Use synthetic data during the [controlled pilot](NEXT_SPRINT_PLAN.md); production acceptance is a separate decision.

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

Ask your administrator for the approved Windows installer, server address and your individual account credentials. Use the approved installer and launch **SMB ERP**. The installer supplies the desktop client; the shared API and PostgreSQL must already be running on the company server.

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

Use the left sidebar to select a workspace. Tabs and actions depend on your role; the server checks permission again for every protected operation. Missing actions should be reviewed with your administrator.

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

### Customers

As administrator, open **Customers**, enter **Customer code** and **Customer name**, then select **Save customer**. Review the customer register; use **Refresh customers**, **Previous** and **Next** to navigate. Codes are unique and normalised to uppercase. Customers are shared across connected users. Customer editing is not currently provided.

### Suppliers and items

As administrator or purchasing user:

1. Open **Purchasing → Suppliers**, create a unique code/name and optionally contact email, phone and payment terms in days. Save and check the register.
2. Open **Items**, create a unique code/name, unit such as `EA`, and optional description. Save.
3. Use **Edit** to update authorised fields or deactivate a record. Codes stay fixed. Item units become fixed after use by an order or stock movement. Records holding stock cannot be deactivated.
4. Use search, **Active only**, pagination and **History** where available. Supplier contacts are visible only to authorised master-history roles, rather than all requesters.

Codes allow up to 32 letters/numbers/hyphens/underscores; names allow up to 160 characters. Supplier bank details are outside the current master. Select masters instead of repeatedly entering free-text identities. See [procurement details](PROCUREMENT.md).

## Procure to pay

The implemented path is **request → independent approval → order → accepted receipt → matched supplier invoice → two payment approvals → recorded confirmed transfer**. An approved request or issued order creates no ledger posting. A payment record documents a transfer completed outside the ERP.

Before testing the complete path, ask the administrator to check **Account security and access** for active purchasing, inventory-manager and accountant accounts, plus **two distinct active business approvers**. Each user must complete MFA. One approver can decide a purchase request, but supplier payment requires two. If a later workspace or action is missing, check this account setup before treating the workflow as a server failure. Administrator access does not substitute for these business permissions.

### 1. Create and submit a purchase request

**Who:** requester, business approver, purchasing or administrator; only the originating requester can revise/submit their record.

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
| SUBMITTED | Assigned approver approves/rejects. |
| REJECTED | Originator revises to DRAFT and resubmits. |
| APPROVED | Purchasing issues the downstream INR order. |

If master data changed after the draft, revise/save to capture its current details before submission. Unavailable approvers require an administration review; withdrawal, reassignment and delegation are not implemented.

### 3. Issue the purchase order

**Who:** purchasing.

Open **Orders & billing → Orders**. In **Issue purchase order**, select the approved INR request, active supplier, date and description, then **Issue approved order**. Quantities and prices come from the approved request. There is one order per request.

Review ordered, accepted, damaged and remaining accepted quantities. **Cancel remaining order** requires a reason, preserves receipts and allows invoicing accepted quantities. Cancelled orders cannot be reopened.

### 4. Post partial receipts and record damage

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

Accepted stock fulfils the order and posts inventory against GRNI (goods received, not invoiced) at PO cost. Damaged quantities record evidence only: they add no valued stock, do not fulfil the accepted order quantity and cannot be invoiced. Replacements can be received later. A delivery's accepted plus damaged quantity cannot exceed the outstanding accepted quantity. Duplicate delivery references per order are blocked, ignoring case/outer spaces.

Do not add the same delivery through a separate manual stock increase. Posted receipts are immutable. Supplier returns, quarantine, disposal and claims need a reviewed external process while those features remain unavailable.

### 5. Enter and match the supplier invoice

**Who:** accountant; only its creator revises the draft.

1. Open **Orders & billing → Supplier invoices** and create a draft against one PO.
2. Enter supplier invoice reference, posting/due dates, explanation, line quantities/prices and configured tax codes.
3. Allocate each invoice line to eligible accepted receipt quantities. Save the draft.
4. Select **Run three-way matching** and review every exception.
5. Correct missing receipts, excess quantities, dates and changed tax codes by revising the draft. Price tolerance is zero. A different business approver can **Accept reviewed price variance** with a reason, or **Return invoice for correction**. Editing invalidates prior variance acceptance and matching snapshots.
6. Once eligible, post the invoice and inspect its posted status, linked journal, outstanding and available balance.

Only accepted quantities not already consumed by posted invoices may be billed. Drafts do not reserve receipt quantities; posting checks again. Duplicate references per supplier are blocked even for void drafts. Damaged goods cannot be allocated. Posting clears receipt carrying value from GRNI and records AP, configured tax and any reviewed variance. Nonrecoverable tax is expensed in this release.

Posted invoices cannot be edited/voided. Credit notes, refunds and cancellation of posted invoices are not implemented. Escalate corrections to finance rather than entering an unrelated transaction to conceal a difference.

### 6. Prepare and independently approve payment

**Who:** accountant prepares; two assigned business approvers decide.

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
| AP/AR/GRNI controls | Subledger versus general-ledger differences; investigate any difference. |
| Income statement | Posted income/expense activity within the range. |
| Balance sheet | Cumulative assets, liabilities, equity and unclosed earnings; review the balance difference. |
| Cash flow | Bank opening/closing and operating/investing/financing categories; review unclassified lines. |
| Tax summary | Posted input recoverable/nonrecoverable and output amounts by snapshotted code/rate. |

In **Accounting & stock → Reconciliation**, review stock valuation versus inventory control, current stock projections versus immutable movements, and the trial balance. Historical reports do not reconstruct old balance projections. Differences require investigation; the application does not automatically post them away. These are operational reports; statutory presentation, accountant review and report export capabilities require separate acceptance.

### Bank reconciliation

**Who:** accountant, in **Accounting & stock → Bank statements**.

1. Enter account, inclusive dates, opening/closing balances and up to 100 signed statement lines. Positive amounts increase Bank; negative amounts reduce it. A zero-line statement is supported.
2. Confirm opening plus signed movements equals closing, then save the draft. Statements for the same account cannot overlap.
3. Match each statement line to one posted bank ledger line of exactly the same signed amount. Older outstanding ledger lines can clear on a later statement. Post legitimate missing fees/interest as journals before matching them.
4. Review expected opening, outstanding ledger entries and adjusted closing. Statement closing plus outstanding ledger must equal ledger closing.
5. Finalise earlier drafts first and follow the preceding finalised statement contiguously. Finalisation makes the statement/matches immutable and protects bank postings through its cutoff.

Revising a draft clears its matches, so recheck all lines. Bank-file import, split/combined matching and bank connectivity remain future work.

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

Keep identity documents and correspondence out of reference fields. Access extracts omit authentication secrets but still contain personal data; supplement them with relevant historical/free-text records and response context before disclosure. Extracts above the interactive limit require an operator-reviewed offline process. After a restore, the operator must replay post-backup restrictions/minimisations before admitting users. See [privacy operations](IMPORTS_AND_PRIVACY.md). These features support privacy work; organisational GDPR compliance needs its own assessment.

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

The [ERP module roadmap](ERP_MODULE_ROADMAP.md) proposes Finance completion, CRM/Sales, broader Supply Chain, HR and Marketing using [ERPNext/Frappe workflow references](ERPNEXT_MODULE_CROSSWALK.md). The proposed [Core and Finance epic and stories](CORE_FINANCE_EPIC_AND_STORIES.md) provide more detail for the first expansion phase. The [draft Finance decision record](CF01_FINANCE_DECISION_RECORD.md) collects unresolved scope and policy decisions and synthetic examples for review; it is not approved or authority to post. These are development plans, not additional installed workspaces. Current source is version 0.2.0 / schema 8; the operator must confirm your deployed versions separately.

| Area | What you can use now | Planned addition |
| --- | --- | --- |
| Finance | Current books, AP/AR, recorded payments/collections, reconciliation and statements described above. | Credits/refunds, controlled opening migration, budgets/cost centres and bank-file matching. |
| Sales and CRM | Customer register and service/non-stock invoicing/collections. | Contacts, leads, opportunities, quotations, orders, stock reservation/dispatch/COGS and linked sales returns. |
| Supply Chain | Current purchasing, accepted receipts, warehouses, stock and transfers. | Replenishment, RFQs/quote comparison, quality/quarantine, returns and independent count adjustment. |
| HR | Login accounts support application access; they are not employee profiles. | Employees, leave/attendance and independently approved expenses. Payroll needs a separate reviewed jurisdiction. |
| Marketing | No campaign, audience or communication-sending workspace. | Campaign planning, eligible audiences, source/results reporting; outbound delivery separately selected and accepted. |

Continue using the actual workspace names and steps in this guide. Current master-import templates do not accept employees, leads or campaign audiences. There are no module enable/install actions in this release, and upgrading the desktop alone does not add server/database workflows. The [controlled pilot](NEXT_SPRINT_PLAN.md) keeps its existing scope; new module instructions, permissions, imports and upgrade steps will be documented when implemented and accepted. No operator action is required by this planning revision.

## Guide maintenance and revision history

This is the maintained entry point for user instructions. Every application, configuration, deployment, security or operating-workflow change must review this guide in the same change. Update affected steps, screen labels, roles, examples, troubleshooting and limits, plus the baseline/date and revision table. For an internal change with no task impact, add a dated review entry explaining that conclusion. Planned features stay labelled planned until implemented. Review against actual source/screens and applicable verification; document review alone does not establish deployment acceptance.

The root [contributor instructions](../AGENTS.md) and [documentation maintenance process](USER_GUIDE_MAINTENANCE.md) define ownership and the checklist. `npm run docs:check` checks local links/baseline and requires this guide to change alongside covered repository changes. CI checks committed changes against its event base. The check detects missing updates; a reviewer must judge correctness and completeness. A repository setting must require the CI check if merges are to be blocked. The guide is maintained through changes, rather than rewritten automatically from code.

| Date | Baseline / change | Guide update |
| --- | --- | --- |
| 2026-11-19 | 0.2.0 / schema 8; CF-03 identity recovery | Added two-administrator recovery, token handling, MFA re-enrolment, cancellation and escalation guidance. Upgrade client and server and migrate after backup; operator verification and emergency procedures still require local adoption and rehearsal. |
| 2026-11-19 | 0.2.0 / schema 7; CF-03 draft threat review | Reviewed sign-in, recovery codes, privacy restriction and last-administrator guidance against the proposed recovery design. Operator-assisted recovery remains unavailable; no policy approval, operator rehearsal, schema migration or deployment is implied. |
| 2026-11-17 | 0.2.0 / schema 7; FUP-01 password change | Reviewed sign-in, session revocation, password limits and uncertain responses against the new desktop and API flow. Upgrade client and server together; no schema migration or deployment acceptance is implied. |
| 2026-11-17 | 0.2.0 / schema 7; CF-01 draft decision record | Reviewed current Finance posting, opening, report and privacy limits against the draft scope and synthetic examples. No user workflow, role, configuration, version or schema changed; operators should continue current procedures and obtain Finance review before any release decision. |
| 2026-11-17 | 0.2.0 / schema 7; Core and Finance story refinement | Reviewed sign-in/access, purchasing and Finance corrections, openings, reports, privacy and recovery limits against the proposed CF-01–21 backlog. Added a planning reference; no current task, role, operator procedure, application version or schema changed. No operator action or deployment acceptance is implied. |
| 2026-11-17 | 0.2.0 / schema 7; module expansion plan | Reviewed current navigation, roles, service AR, stock/purchasing, imports/privacy and deployment limits against the proposed six-module scope. Added an availability table and roadmap/reference links; current task instructions and application/schema baseline remain unchanged. Operator implication: no module enablement, migration or installation required by this documentation change. No new UI/test/deployment acceptance is established. |
| 2026-11-16 | 0.2.0 / schema 7 | Initial consolidated guide: connection, MFA/access, masters, procure to pay, books/stock, AP/AR, tax/reconciliation, imports/privacy, history, recovery boundaries and support. Added same-change maintenance instructions and documentation check. Reconciled current-schema and implemented-scope statements in the linked workflow documents and README. Reviewed against source; hosted CI and deployed environment acceptance are not established by this documentation change. |
| 2026-11-16 | Procure-to-pay setup troubleshooting | Added an active-role preflight and missing-account troubleshooting. Local checks passed: API readiness, PostgreSQL connectivity, migration checksums through schema 7, TypeScript, eight unit tests and seven isolated API integration tests. These checks do not establish desktop UI or pilot acceptance. |
| 2026-11-16 | Receiving prerequisite ownership | Clarified administrator, accountant, purchasing and inventory-manager responsibilities before receiving. Confirmed against the role registry and server permission guards; business permissions are unchanged. |

For specialist references, use [authentication](AUTHENTICATION.md), [procurement](PROCUREMENT.md), [books/stock](ACCOUNTING_INVENTORY.md), [trade](TRADE_WORKFLOWS.md), [imports/privacy](IMPORTS_AND_PRIVACY.md), [operations](OPERATIONS_RUNBOOK.md) and [Windows installers](WINDOWS_INSTALLER.md). Older schema-specific activation sections describe the release that introduced a feature; the current source requires schema 8. Confirm actual deployed schema with the operator.
