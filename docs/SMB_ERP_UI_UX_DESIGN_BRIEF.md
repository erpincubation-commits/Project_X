# SMB ERP Desktop — UI/UX Design Brief

**Status:** Draft for product, design, engineering and user review  
**Version:** 0.1  
**Date:** 15 November 2026  
**Related documents:** [Product requirements](SMB_ERP_DESKTOP_PRD.md), [Application flow](SMB_ERP_APP_FLOW.md), [Technical requirements](SMB_ERP_TECHNICAL_REQUIREMENTS.md)

## 1. Purpose and scope

Design a Windows-first ERP desktop experience for small and medium-sized businesses using a shared on-premises server. The interface should make everyday operational work clear, efficient and traceable for people in purchasing, warehouse, finance and administration.

The first complete release centres on purchase-to-payment, supported by inventory, finance, user administration and essential reports. Later capabilities include sales, manufacturing and HR. This brief translates the product and flow documents into design direction; it does not represent an approved visual identity or claim that the proposed screens exist.

**Current baseline:** The application provides a server connection and sign-in screen, a customer register, administrator customer creation, read-only access and diagnostic log access. It uses a green sidebar, white cards and a compact customer table. The remaining ERP workflows in this brief are planned.

**Platform:** Electron with a React/TypeScript interface on Windows. Users need access to their organisation's server for shared transactions. Mobile access is an open product decision; this brief does not prescribe a mobile application or offline transaction support.

## 2. Design objectives

1. Help users identify their next task, understand its current state and complete it with confidence.
2. Make financial and inventory consequences, approvals and exceptions visible before a user commits an action.
3. Support fast, repetitive work with keyboard access, legible tables and consistent forms.
4. Provide a coherent experience for users with different responsibilities without exposing data or actions outside their permissions.
5. Explain connection problems and uncertain transaction outcomes in plain language, with a safe route to recovery.
6. Work comfortably at practical Windows desktop sizes, with accessible controls and adjustable display settings.

## 3. Users and design priorities

| User | Main task | Design priority |
| --- | --- | --- |
| Requester | Submit and track purchase requests. | Simple entry, clear approval status and reasons for rejection. |
| Approver / manager | Decide on assigned requests or payment batches. | Relevant context, totals, exceptions, authority and decision history. |
| Purchasing | Manage suppliers and purchase orders. | Searchable records, clear order status and controlled changes. |
| Warehouse | Record receipts, shortages and damaged goods. | Large, readable quantities and a quick partial-receipt workflow. |
| Accounts payable / finance | Match invoices, prepare payments and reconcile records. | Side-by-side comparisons, precise amounts and traceable exceptions. |
| Administrator | Manage users and settings and support colleagues. | Explicit permissions, clear consequences and useful diagnostics. |
| Management / auditor | Review authorised performance and evidence. | Trustworthy summaries with source-document drill-through. |

Users may have multiple roles. Final permissions and approval rules require product and customer review. The interface should reflect permissions, while the server enforces them.

## 4. Experience principles

- **Show the next action.** Each screen has a clear purpose and a primary action appropriate to the user's role and the record's state.
- **Make state explicit.** Pair status labels with supporting text; distinguish drafts, submitted work, approvals, exceptions and confirmed transactions.
- **Protect against costly mistakes.** Present totals, affected records and consequences before approval, posting, payment recording or other consequential actions. Confirm only when it helps the user make an informed decision.
- **Preserve context.** Keep document identifiers, supplier, amounts, state and relevant history visible while users move between related records.
- **Support real work.** Allow efficient keyboard navigation, predictable tab order, compact scanning and clear recovery from validation errors.
- **Communicate honestly.** Never say a transaction was saved or paid until the server confirms the relevant action. A recorded payment must be clearly distinguished from an actual bank transfer.
- **Respect privacy.** Show sensitive information only to authorised users and only when needed for the task; avoid unnecessary personal data in notifications and exports.

## 5. Information architecture

The following navigation is proposed for the first complete release. Show modules and actions according to the user's assigned permissions; preserve a predictable location for shared functions such as account and help.

```text
Workspace
├── Home / My work       Approvals, exceptions, assigned tasks
├── Purchasing           Requests, suppliers, purchase orders, receipts
├── Inventory            Items, warehouses, stock, movements
├── Finance              Supplier invoices, payments, ledger, bank, close
├── Reports              Operational and financial reports
├── Customers            Current register; later expanded sales features
└── Administration       Users, roles, approvals, settings, audit
```

The current interface only exposes Customers. A richer navigation shell and work queue are planned design work. Detailed page names, grouping and roles should be validated with users as the scope is implemented.

## 6. Desktop layout direction

Use a persistent application shell with a left navigation area, a main work area and a compact account/connection area. For document pages, place the title, identifier, state and relevant primary action near the top; organise details, linked records and history in a predictable order. Provide a route back to the user's previous list or task queue.

**Suggested layout for a transaction detail:**

```text
┌────────────┬───────────────────────────────────────────────────────┐
│ Navigation │ Purchase order PO-0124          Status: Awaiting receipt │
│            │ Supplier · date · total                    [Action]    │
│ Purchasing │───────────────────────────────────────────────────────│
│ Inventory  │ Details | Receipts | Invoices | Activity               │
│ Finance    │                                                       │
│ Reports    │ Items and quantities                 Related records   │
│            │                                                       │
│            │ Approval / exception context                          │
└────────────┴───────────────────────────────────────────────────────┘
```

This is a structural sketch, not a pixel-perfect specification. Avoid requiring horizontal scrolling for critical controls. Wide tables may scroll inside a clearly labelled region while keeping record identity and essential actions accessible. Confirm minimum window size, display scaling and supported screen resolutions during usability testing; the design should reflow or prioritise content as space decreases. Support standard Windows resizing and display scaling, without assuming full-screen use.

## 7. Key screen briefs

| Screen | Core content and actions | Critical states |
| --- | --- | --- |
| Connection and sign-in | Server address, connection status, account fields, sign-in and support access. Explain that IT supplies the server address. | Unreachable server, invalid certificate, incorrect credentials, session expired. MFA and account recovery are planned. |
| Home / work queue | Assigned approvals, exceptions and recent permitted work; clear links to the next action. | Empty queue, loading, stale data, permission changes. |
| Register / list | Title, search/filter controls when available, meaningful columns, status, pagination and role-appropriate create action. | No records, no results, loading, error, filtered results. |
| Purchase request | Requester, items, quantities, estimated values, justification, budget context and submit action. | Draft, validation errors, pending, approved, rejected; final state model to be agreed. |
| Approval review | Request or batch summary, amount, decision context, approval history, approve/reject actions and reason where required. | Delegated authority, prohibited self-approval, stale record, rejected decision. |
| Purchase order | Supplier, lines, prices, tax, linked request, approval history and receiving progress. | Draft, approved, partial receipt, complete, controlled change or cancellation. |
| Goods receipt | Order lines, ordered/outstanding quantities, received/accepted quantities, damage, shortages and warehouse location. | Partial receipt, over-receipt policy, invalid quantity, concurrent update. |
| Invoice match | Supplier invoice alongside PO and receipt details, with quantity/price differences, tolerance outcome and review action. | Matched, missing data, suspected duplicate, exception under review. |
| Payment batch | Eligible liabilities, totals, approval history and the action to record a payment. Explicitly identify whether a bank transfer is external. | Unapproved, awaiting independent approval, payment recorded, partial or failed operation. |
| Finance and reports | Relevant ledger, reconciliation and financial-report views with filters, totals, export permission and source links. | No data, incomplete reconciliation, closed period, restricted export. |
| Administration | Named users, roles, approval configuration and authorised audit/support views. | Restricted access, account disabled, configuration validation, session revoked. |

The listed states are conceptual until the workflow and accounting rules are agreed. Avoid suggesting a button or state is already implemented solely because it is shown in this brief.

## 8. Interaction patterns

### Forms and validation

- Group related fields and label them visibly. Identify required fields and units, give examples only where they clarify input, and preserve valid entries when an error occurs where feasible.
- Validate on submission and provide timely field-level feedback. Put an error summary near the form heading for longer forms, with links to affected fields.
- Show currency, units, tax and totals explicitly. Do not imply a country-specific format or tax rule before the first jurisdiction is selected.
- For unsaved changes, offer a clear choice before navigation that would discard the user's work. Do not promise local draft recovery until the behaviour is implemented.

### Tables and records

- Use meaningful headings and a consistent column order. Right-align amounts and quantities where this helps comparison; retain currency and units.
- Keep primary identifiers and status visible. Offer sorting, filtering and pagination where supported, and indicate active filters and result counts.
- Do not rely on colour alone to show status or discrepancies. Use text, accessible labels and, where useful, icons.
- Link to source records and approval history only when the user is authorised to view them.

### Approval and payment actions

- Present the document, amount, supplier, relevant exceptions and intended consequence before a decision. Require a reason when the agreed business rule calls for one.
- Explain why an action is unavailable when doing so is safe, including self-approval restrictions. Server-side checks remain authoritative.
- Use explicit verbs such as **Submit request**, **Approve batch** and **Record payment**. Never label a transaction as sent to a bank unless an approved integration confirms that event.

### Connection and transaction feedback

- Show pending activity and prevent accidental duplicate submissions while a request is in progress.
- On confirmed success, identify the saved record and next useful action. For a failed or uncertain response, explain whether the user should check the record before retrying.
- Preserve unsent form content where feasible, without claiming offline saving or synchronisation. Do not silently queue financial writes.
- Show a safe diagnostic reference for support; do not display passwords, tokens, raw database errors or unnecessary personal information.

## 9. Visual direction and design system

The existing green-and-neutral palette can serve as a starting point: a dark green navigation area, light neutral canvas and white content surfaces. Treat this as a proposal to refine through contrast testing and brand review, not a fixed identity. Aim for a calm, professional visual hierarchy suited to dense operational data.

| Element | Direction |
| --- | --- |
| Typography | Use a legible Windows-available sans-serif stack; establish consistent sizes and weights for page titles, section headings, body text, labels and metadata. Avoid very small text for essential content. |
| Colour | Define semantic tokens for text, surfaces, borders, focus, success, warning and error. Check each foreground/background pairing rather than assuming existing colours pass. |
| Spacing | Use a consistent spacing scale and align related controls. Provide enough separation to prevent selection mistakes while keeping tables practical for repeated use. |
| Components | Specify buttons, text inputs, selects, date/number fields, status badges, alerts, dialogs, tabs, tables, pagination and empty states. Include hover, focus, disabled, loading and error states. |
| Icons | Use a consistent, simple icon set; pair action icons with labels where meaning could be ambiguous. |
| Responsive desktop | Let navigation and content adapt to window size and Windows scaling. Do not hide essential actions when the window is narrowed. |

Use design tokens and reusable React components as the interface grows. Produce a component inventory and examples before engineering scales the system to multiple modules. Dark mode is not a first-release commitment.

## 10. Accessibility and inclusion

The product target is WCAG 2.1 AA where applicable to desktop content, as described in the PRD. Validate the actual implementation; a design brief alone does not demonstrate conformance.

- Make core journeys operable with a keyboard, with logical focus order, visible focus indicators and no keyboard traps. Dialogs should move focus in, return it on close and expose their title and purpose.
- Associate labels, instructions and field errors with controls. Announce important status changes and errors to assistive technology without excessive interruption.
- Test normal text contrast at least 4.5:1 and large text at least 3:1; test applicable interface controls and focus indicators against their surroundings. Do not use colour as the sole indicator of state.
- Support Windows text/display scaling, zoom and high-contrast settings; test reflow without losing essential content or controls.
- Use plain language, consistent terminology and recognisable date/number formats; confirm localisation with the selected jurisdiction.
- Test with keyboard and a supported Windows screen reader, including dense tables, validation, approval dialogs and connection failures. Record and resolve findings.

## 11. Content and privacy guidance

Use direct, task-focused language. State what happened and what the user can do next. Avoid technical stack traces and ambiguous terms such as “processed” when “submitted”, “approved” or “recorded” is more precise.

| Situation | Example copy |
| --- | --- |
| Connection failure | “Can't connect to the company server. Check the address or contact your administrator.” |
| Invalid certificate | “The server's identity couldn't be verified. Contact your administrator before continuing.” |
| Validation | “Enter a quantity greater than zero.” |
| Uncertain save | “We couldn't confirm whether this was saved. Reconnect and check the record before trying again.” |
| Approval restriction | “You can't approve your own request. Ask an authorised approver to review it.” |
| Confirmed recorded payment | “Payment recorded. Check your bank statement when it is available.” |

These examples are proposed copy and should be checked against actual system behaviour. Limit personal data in lists, notifications, logs and exports to what the role and task require. Privacy request and retention workflows need review with the customer's privacy lead; design choices alone do not establish GDPR compliance.

## 12. Design deliverables and validation

### Deliverables

1. Role-based journey maps and a reviewed information architecture.
2. Low-fidelity wireframes for sign-in, work queue, request, approval, order, receipt, invoice match, payment, reports and administration.
3. High-fidelity designs and an accessible component library, including interaction, error and empty states.
4. A clickable prototype for the P0 procure-to-pay journey and documented handoff covering behaviour, permissions, content and responsive desktop states.
5. A usability and accessibility findings log, prioritised with owners and resolution decisions.

### Evaluation scenarios

Test representative users carrying out realistic tasks without coaching. Record task completion, errors, time, observed confusion and participant feedback; set numerical thresholds with the product owner after a baseline study.

| Scenario | Evidence of success |
| --- | --- |
| Connect and sign in | User identifies the supplied server address, signs in and can recover from a connection error. |
| Submit and approve a request | Requester enters items; a different authorised approver finds the task, reviews context and decides. |
| Receive a partial delivery | Warehouse user records accepted, short and damaged quantities without confusing them. |
| Resolve an invoice exception | Finance user identifies the discrepancy, finds the linked documents and routes or records an authorised decision. |
| Review a payment batch | Approver understands the amount, outstanding approvals and whether an actual bank transfer occurs. |
| Handle a lost connection | User can determine whether to check the server before retrying and does not assume an unconfirmed write succeeded. |
| Work with assistive technology | Keyboard and screen-reader users can complete the same core tasks and understand errors and status changes. |

## 13. Decisions needed

- Confirm the product name, brand direction and whether the existing green palette should be retained.
- Select a pilot customer, representative roles and approval rules for design research.
- Select the first country and agree date, currency, tax and accounting terminology with finance experts.
- Agree supported Windows versions, minimum window size, common display scaling and assistive-technology test configurations.
- Decide whether mobile approvals and warehouse access are needed, and in which phase.
- Define permission-denied, delegated approval, data retention and financial correction behaviours with product, customer IT and privacy stakeholders.
- Confirm the detail and scope of the work queue, RFQ step, payment method and external integrations before finalising those screens.
