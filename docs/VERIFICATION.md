# Security, accessibility and performance verification

## Security

Run `npm run build`, `npm run check`, `npm test`, `npm run test:integration`, `npm run security:check` and `npm run security:dependencies`. The repository checks fail for tracked secret files, missing Electron isolation/navigation/sender controls, missing HTTP headers/CSP or missing/obviously weak/reused authentication keys. They print check names only. They are regression/configuration assertions, not a secret scanner, SAST product, cryptographic audit or penetration test. Run dependency checks with network access to the registry advisory service; a network failure is not a clean bill of health. High/critical runtime advisories fail the dependency command; review moderate advisories and build-tool advisories separately with `npm audit`.

API integration tests verify authentication/expiry/MFA, role denial, request ownership, independent approvals, history/audit, optimistic versions, duplicate retries, immutable financial records, atomic rollback, migration upgrades/checksums and import/privacy boundaries. Run production configuration checks as `npm run security:check -- --production` using the actual runtime role: no SUPERUSER/CREATEDB/CREATEROLE and an explicitly confirmed TLS proxy. Also inspect effective schema/table ownership and privileges with the DBA, test the real certificate/firewall and confirm no direct client database access. Those infrastructure checks cannot be inferred from source flags.

Before production, verify certificate trust/expiry, protected NTFS ACLs, secret escrow, restricted DB roles, lock-screen/device policy, signed installer provenance, off-host backups, monitoring and recovery evidence. Do not paste credentials into issues or commit `.env`. Audit/history triggers protect ordinary application writes; a database owner can bypass them.

## Accessibility

`npm run test:accessibility` builds and launches a sandboxed Electron client against a disposable server/database. It uses axe-core WCAG 2 A/AA, 2.1 AA and 2.2 AA tagged rules on connection, MFA enrollment, customers, import preview, privacy register and the access extract. It also checks visible keyboard focus. Reports under `.local/accessibility/*.json` contain rule/selector findings, pass counts and items needing manual review, not screenshots of personal records. Any automated violation or missing focus fails. `npm run test:desktop` additionally checks the financial statements screen and exercises the complete multi-role purchasing/accounting/trade workflow.

The interface includes a skip-to-main link, labelled inputs, keyboard focus outlines, status/alert regions and strengthened footer contrast. Automated passing results cover sampled states only; do not claim whole-product WCAG conformance from them.

Manual release checks, recorded by tester, build and assistive technology version:

1. Navigate connection, password/MFA, recovery codes, every workspace, form errors, confirmation and history with Tab/Shift+Tab/Enter/Space and arrow keys where applicable. Activate **Skip to main content**. Ensure focus is visible, logical, never trapped and does not disappear after actions.
2. Use Windows Narrator (and the organisation's supported screen reader) to check headings, form labels/help/errors, required states, table headers, page changes and status announcements. Review every axe `incomplete` finding manually.
3. Check text/display scaling at 200% and 400%, narrow window sizes and long names/error messages. Ensure controls and content remain reachable with appropriate scrolling. Test Windows high-contrast/forced-colours modes and colour-independent status meaning.
4. Verify masked secrets, recovery-code handling, timeout messaging and reauthentication are understandable without a mouse. Avoid capturing real credentials or personal extracts in screenshots.

Store manual evidence and remaining defects with release sign-off; automated checks do not replace this review.

## Load testing

```powershell
npm run test:load
$env:LOAD_REQUESTS = '1000'
$env:LOAD_CONCURRENCY = '16'
$env:LOAD_P95_MS = '2000'
npm run test:load
```

The tool creates a uniquely named local test database, migrates it, seeds synthetic customers and independent worker sessions, starts a loopback API on a random port, runs bounded authenticated paginated reads and creates with exact duplicate retries, then drops the database. It accepts no arbitrary target URL. Limits: 20–5,000 operations and 1–32 workers. Defaults: 200 operations, 8 workers, p95 <=2,000 ms. Each create is sent twice to verify it produces exactly one row. Any HTTP/network failure, duplicate-write discrepancy or breached p95 budget fails. Fixture sessions intentionally isolate database/API load from human MFA timing; this does not test login throughput or MFA usability.

`.local/load-report.json` records concurrency, request count, completion count, duration, throughput, p50/p95/p99, failures, retry invariant and pass/fail. This is a repeatable local regression baseline, not a customer capacity guarantee. Run it with no competing builds/tests, repeat on production-like staging hardware/data/network, and agree business SLOs. Cover posting contention, large historical reports, backups during normal load, database interruption and external TLS latency in an approved staging exercise before sizing a production deployment. The tool never runs synthetic payments against a real bank or accepts a production HTTP target.

## Dependency override

The lockfile overrides affected minimatch 7?10 dependencies used by the installer toolchain to patched 11.0.8 (compatible with this project's Node requirement). Older minimatch 3/5 consumers remain untouched. This addresses [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), which affects versions before 11.0.1 in that range. Validate packaging and packaged startup whenever changing this override; do not use an unreviewed forced electron-builder downgrade suggested by an audit resolver.
