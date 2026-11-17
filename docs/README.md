# Documentation index

**Reviewed:** 17 November 2026. Current source baseline: application 0.2.0 / schema 7. Source functionality, proposed requirements and actual deployment evidence are separate.

Start with the [desktop user guide](USER_GUIDE.md) for implemented tasks. For the proposed six-module expansion use the [ERP module roadmap](ERP_MODULE_ROADMAP.md) and [ERPNext reference crosswalk](ERPNEXT_MODULE_CROSSWALK.md). The [Core and Finance epic and stories](CORE_FINANCE_EPIC_AND_STORIES.md) refine phase 1. The [next sprint](NEXT_SPRINT_PLAN.md) and [sprint stories](NEXT_SPRINT_USER_STORIES.md) retain the existing controlled-pilot scope and capacity.

| Purpose | Documents | Expansion-plan review |
| --- | --- | --- |
| User instructions and maintenance | [User guide](USER_GUIDE.md), [maintenance](USER_GUIDE_MAINTENANCE.md) | Current navigation/limits preserved; planned modules and same-change documentation responsibilities identified. |
| Product and design | [PRD](SMB_ERP_DESKTOP_PRD.md), [application flow](SMB_ERP_APP_FLOW.md), [UI/UX](SMB_ERP_UI_UX_DESIGN_BRIEF.md) | Six module scopes, phase order, handoffs and future screens. |
| Phase 1 backlog | [Core and Finance epic/stories](CORE_FINANCE_EPIC_AND_STORIES.md) | Proposed story acceptance, dependencies, release gates and mapping to FUP-01–08 and MOD-PLT/FIN; estimates and implementation remain open. |
| Engineering and access | [Technical requirements](SMB_ERP_TECHNICAL_REQUIREMENTS.md), [schema](SMB_ERP_BACKEND_SCHEMA.md), [security/access](SMB_ERP_SECURITY_AND_ACCESS.md), [architecture status](DESKTOP_MIGRATION.md) | Proposed ownership, entities, permissions and compatibility; source baseline distinguished from logical target. |
| Finance and purchasing | [Accounting/inventory](ACCOUNTING_INVENTORY.md), [posting contract](ACCOUNTING_POSTINGS.md), [trade posting rules](TRADE_POSTING_RULES.md), [trade workflows](TRADE_WORKFLOWS.md), [procurement](PROCUREMENT.md) | Finance/Sales/Supply Chain extension gates; existing posting and workflow rules remain authoritative. |
| Privacy and migration | [Imports/privacy](IMPORTS_AND_PRIVACY.md) | New entities require new import, discovery, retention and restore coverage; current importer remains create-only masters. |
| Release and operation | [Deployment](DEPLOYMENT.md), [operations](OPERATIONS_RUNBOOK.md), [recovery](BACKUP_RESTORE.md), [verification](VERIFICATION.md), [testing/deployment runbook](SMB_ERP_TESTING_DEPLOYMENT_RUNBOOK.md) | Module release evidence, migration/reconciliation, new workload and job/attachment recovery requirements. |
| Setup/build references | [Development](DEVELOPMENT.md), [PostgreSQL setup](POSTGRES_SETUP.md), [Windows installer](WINDOWS_INSTALLER.md) | Reviewed: no command, dependency, setup or installer change in this planning revision; existing procedures still apply. |
| Change history | [Changelog](CHANGELOG.md), [historical archive](archive/README.md) | Planning change recorded; archived pilot claims remain historical. |

No new module is enabled by these documents. Review dates record documentation review, not a deployment or production acceptance date.
