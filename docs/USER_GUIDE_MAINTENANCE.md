# Maintaining the user guide

## Ownership

[USER_GUIDE.md](USER_GUIDE.md) is the maintained user entry point. Each change author updates it; the reviewer checks the affected tasks; the release owner confirms its baseline matches the candidate. These are responsibilities, not newly assigned people or automated approvals.

Review it with every application, contract/schema, dependency, configuration, launcher, deployment, security, operating-tool or current-documentation change. Include the update in the same change. For an internal change with no task impact, add a dated revision explaining that conclusion and any operator implications. Archived historical documents alone do not trigger review.

## Change checklist

1. Read affected guide sections and specialist references before changing a feature.
2. Check actual labels, roles, prerequisites, validation, state transitions, accounting effects and failure/retry behaviour.
3. Update the steps, synthetic examples, troubleshooting and current limits. Explain any actions needed after an upgrade. Label unimplemented features as planned.
4. Update **Last reviewed**, the version/schema baseline when applicable, and **revision history**. Do not bump the application version just for documentation.
5. Run `npm run docs:check`, or `npm run docs:check -- --base <base-commit>` for a branch containing committed work.
6. Review instructions against the change's applicable verification. Presence/link checks cannot establish task accuracy or deployment acceptance.
7. Include the matching guide revision in release handover; exclude credentials and actual customer data.

Revision entry format: `YYYY-MM-DD | version / schema or change ID | Affected tasks, revised instructions and review limits`.

## Automated check

The check uses Git and Node only; it needs no server/database or extra dependencies. It validates relative links and heading anchors in the guide and this maintenance document, compares the guide baseline with source, and requires a guide edit when covered files change.

| Command | Comparison |
| --- | --- |
| `npm run docs:check` | HEAD against the working tree, including staged and non-ignored untracked changes. |
| `npm run docs:check -- --base <commit>` | Base commit against the working tree, including untracked files. |
| `npm run docs:check -- --base <commit> --head <commit>` | Committed changes and documentation at the head revision. |

Coverage includes `apps/`, `packages/`, `tools/`, `scripts/`, `infra/`, `.github/workflows/`, current Markdown under `docs/`, and root contributor/readme/package/example-environment/TypeScript configuration files. The guide itself and archived documentation do not trigger a guide edit. Ignored `.env`, dependencies and generated outputs are not inspected. Diagnostics contain paths/status, never file contents or credentials.

The **Windows installer → validate** job runs this check. Pull requests compare the base commit with the candidate merge revision; pushes compare the previous and new revision. Full history is fetched. A first push uses an empty tree. Manual dispatch uses the selected revision's parent, or an empty tree for a root commit. Invalid explicit revisions fail instead of silently skipping review.

The repository owner must configure branch protection/rulesets to require the validate job for enforced merging. This change does not modify GitHub settings or install local hooks. The check requires an edit but does not generate prose or assess its quality. It cannot detect changes deployed outside this repository. Human review and release ownership remain necessary.

## Where to update

| Change | Guide sections | Specialist reference |
| --- | --- | --- |
| Install/connection/launcher | Start and connect; Troubleshooting; baseline | [Deployment](DEPLOYMENT.md), [Installer](WINDOWS_INSTALLER.md) |
| Authentication/access | Sign in; Roles; Administrator setup | [Authentication](AUTHENTICATION.md) |
| Masters/requests/approval | Masters; Procure to pay; History | [Procurement](PROCUREMENT.md) |
| Orders/receipts/AP/AR/payments | Procure to pay; Collections; Reports; example | [Trade](TRADE_WORKFLOWS.md), [posting rules](TRADE_POSTING_RULES.md) |
| Books/stock/period/bank | Accounting; Stock; Reconciliation | [Accounting/inventory](ACCOUNTING_INVENTORY.md) |
| Imports/privacy | Imports; Privacy; limits | [Imports/privacy](IMPORTS_AND_PRIVACY.md) |
| Module plan or delivery | Planned modules/availability; roles; affected workflows/imports/privacy; upgrade/limits | [Roadmap](ERP_MODULE_ROADMAP.md), [PRD](SMB_ERP_DESKTOP_PRD.md), [module acceptance](SMB_ERP_TESTING_DEPLOYMENT_RUNBOOK.md#12-module-expansion-acceptance) |
| Logs/migration/backup/recovery/CI | Troubleshooting; operator links; limits; revision history | [Operations](OPERATIONS_RUNBOOK.md), [Recovery](BACKUP_RESTORE.md), [Verification](VERIFICATION.md) |

The delivered guide is repository Markdown. In-app help, published documentation and automated screenshots should be tracked separately if requested.

## Module-planning review

Reviewed 17 November 2026. Keep roadmap phases and MOD-* epics labelled proposed until source and release evidence support availability. When a module ships, replace the relevant guide availability row with actual tasks/labels/roles, migration prerequisites, examples, imports, privacy/recovery implications and limits in the same change. Do not turn the full roadmap into present-tense user steps. The [documentation index](README.md) records specialist coverage; historical archives remain separate.
