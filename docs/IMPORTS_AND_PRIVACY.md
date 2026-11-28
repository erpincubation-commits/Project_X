# Master imports and privacy operations

## Import workflow

Open **Operations & privacy → Master imports**. Administrators can import customers, suppliers and items; purchasing users can import suppliers/items only. Server permissions and the current account role are checked again during commits. Every endpoint requires a valid MFA-authenticated session.

Paste a JSON array (1–100 rows, total HTTP body at most 128 KiB). Choose the matching record type. Examples:

```json
[{"code":"ITEM-01","name":"Widget","unit":"EA","description":"Stock item","active":true}]
```

```json
[{"code":"SUP-01","name":"Example supplier","contactEmail":"contact@example.test","phone":"+44 1234","paymentTermsDays":30,"active":true}]
```

```json
[{"code":"CUST-01","name":"Example customer"}]
```

Run the dry run, correct row-level errors and inspect the normalized values/defaults. Codes and item units are uppercased. Unknown fields, invalid emails/numbers/units, duplicate source codes and existing database codes are rejected. Supplier rows matching another supplier by normalized name, nonblank email or phone digits (at least seven) require a `duplicateReviewRef` of 3–100 characters from an internal review ticket. The preview checks the database and earlier rows in the batch. Commit checks again inside the transaction; a newly discovered match without a reference rolls back the batch. A reference records a deliberate review; it does not verify identity or merge records. Invalid previews never create master records. Valid previews store the reviewed batch for 30 minutes, bound to the originating account and a canonical SHA-256 digest. Changing the input requires a new preview.

Check the review confirmation and commit. The server rechecks access, ownership, expiry, digest and supplier duplicates and inserts **all rows in one transaction**, including individual audit entries and supplier/item history. A concurrent supplier match without a review reference or a duplicate code causes the entire batch to roll back. A reviewed supplier match stores the reference and matched supplier codes in immutable history and audit, which can appear in a supplier access extract; do not put personal or bank details in the reference. Repeating a commit with the same idempotency key/data returns the original result; a changed payload under the same key conflicts. A committed batch cannot create its records again even with another key. The preview's raw rows are removed on commit; expired unused previews are removed by `ops:cleanup -- --apply`.

Imports create new masters only. They do not update existing records, ingest CSV/Excel, import users/passwords, post journals/opening balances, approve documents or bypass financial workflows. Map legacy data to these JSON templates outside the ERP, validate totals, then use the existing reviewed financial entry/approval workflows for opening values. Customer imports have audit entries; customer editing/history remains outside this feature.

API routes: `POST /api/v1/operations/imports/preview` (`{kind,rows}`), then `POST /api/v1/operations/imports/:id/commit` (`{digest}`). Both require `Idempotency-Key: <UUID>`. Preserve a pending key after network failure; use a new preview when an expired or changed source needs review.

## Privacy request workflow

Supplier quotation headers, references and related non-binding recommendation events appear in the supplier access extract, subject to the interactive limit. Recommendation reasons may contain third-party information and must be reviewed before disclosure. Quotation line details and other business records require separate review. Quotations are retained business records; apply the organisation's approved retention, access and disclosure procedures. Avoid placing personal or sensitive data in quote references and recommendation reasons.

Supplier-specific service acceptance headers and evidence are included in access extracts, subject to the interactive limit. Review evidence for third-party information before disclosure; acceptance line details and related business records require separate review.

Only administrators have `privacy.manage`. Open **Privacy requests**, verify the subject's identity through the approved restricted process, then record subject type/UUID (customer code for customers), request type, **actual original receipt date** and the verification ticket reference. Do not paste identity documents, personal correspondence or sensitive evidence into ticket reference fields. Due date is one calendar month after receipt, including when verification/intake occurred later; the case clock is not reset by identity verification. Extensions, communications and legal assessments are managed in the external case system.

| Action | Behaviour |
| --- | --- |
| Prepare access extract | ACCESS cases only; returns current personal master/account fields, supplier-specific historical snapshots and related audit activity metadata. Excludes hashes, MFA secrets, bearer tokens, recovery codes and session rows. Response is `Cache-Control: no-store`; the body is not copied into retry tables or logs. |
| Apply/release legal hold | Versioned and audited; a hold on **any case for that subject** prevents minimisation and release of restrictions until explicitly released. A hold can remain after a case closes. |
| Restrict current use | RESTRICTION cases for users/suppliers: marks privacy-restricted and inactive. User sessions/challenges are revoked. Database constraints prevent ordinary access/master edits from reactivating a restricted record. |
| Release restriction | RESTRICTION case with authorised reason; leaves the record inactive. Separate access/master approval must reactivate it. A hold prevents release. |
| Minimise current data | ERASURE case only, no subject hold: supplier contact email/phone cleared and record restricted/inactive; user email replaced with a pseudonymous identifier, password disabled, MFA secret/recovery codes removed, sessions/challenges revoked and account restricted/inactive. Self-service administrator retirement and removal of the last active administrator are blocked. |
| Record completed review / refusal | Records the external reviewed outcome/reason reference; does not claim data was automatically erased or rectified. Rectification uses the existing authorised editing workflow, then records the review outcome. |

Each action requires the current case version and a UUID retry key. Conflicts require refresh/review; failed actions leave no partial changes. Case creation, export and decisions are audited. Historical financial records, master snapshots, audit changes, previous retry responses, free text and existing backups are **not rewritten**. Minimisation therefore resolves as `APPLIED_WITH_RETENTION`, not complete erasure. Review every remaining copy and record the specific lawful retention basis, restricted access, review date and destruction plan externally. The product does not impose a country-specific retention period. A legal hold is a decision guard, not a substitute for controlling all processing or a full legal restriction implementation.

Customer restriction/erasure requires a reviewed manual plan because the current customer schema/financial identities cannot be safely removed through this feature. Record the decision/reference; the server blocks automatic customer minimisation/restriction. An access extract is an operational starting point: review third-party information and supplement relevant free-text business records, historical snapshots, import data, logs, backups and information about purposes, recipients, retention and rights. Interactive exports exceeding 10,000 rows in history, activity, quotations or recommendations fail explicitly instead of silently truncating; arrange a reviewed offline extract. Copy the extract to the approved secure case system; the desktop clears it when the workspace unmounts. It is not automatically sent to anyone or written as a local file.

Maintain the case/deletion register independently of database backups. On recovery, replay post-backup restrictions/minimisations before admitting users. Control and expire exported extracts and archived backups through the organisation's retention policy. These are technical support workflows, **not certification of GDPR compliance**. The controller remains responsible for identity checks, lawful basis, responses, retention, processor arrangements and incident assessment.

Legal context: the [European Commission's individual-rights guidance](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en) explains access, the usual one-month response period and exceptions to erasure. Review disclosure and retention decisions against [GDPR Articles 12–19](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/), including safeguards for other people's rights.

## Planned module data coverage

Reviewed 17 November 2026. [CRM, HR and Marketing](ERP_MODULE_ROADMAP.md) add contacts/addresses, activities, employee/manager/leave/claim records, attachments, preferences, audience snapshots and delivery history. These are not supported subjects/import kinds in the current schema 7 tools. The current 1–100-row JSON master importer and existing privacy-case limitations remain unchanged; do not paste employee files or campaign audiences into supplier/customer templates.

Before each module release, catalogue fields/purposes/access/retention, add reviewed validated import/backfill mappings and extend subject discovery, protected exports, holds, restriction/minimisation decisions and restore replay. Duplicate contact matching must not automatically merge financial identities. Leave employee compensation/medical data out of the initial HR core model. Marketing needs explicit purpose/channel eligibility and suppression that cannot be bypassed by a new campaign, audience snapshot or reimport; the controller reviews the policy.

Reconcile preserved history, attachments, exported audiences and external provider copies under their approved retention policy. Keep case/suppression decisions independently protected and replay post-backup changes before access or outbound jobs resume. Current historical retention does not become complete future-module privacy coverage by adding a table. Use synthetic fixtures until the relevant release's privacy/access review is complete.
