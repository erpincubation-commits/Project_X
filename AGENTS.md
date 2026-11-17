# Repository contribution instructions

## Keep the user guide current

- `docs/USER_GUIDE.md` is the maintained entry point for desktop users. Read the relevant sections before changing a workflow.
- Review and update it in the same change as application, contract/schema, dependency, configuration, launch/deployment, security or operational-tool changes. Update affected steps, labels, permissions, examples, troubleshooting and limitations.
- Update its review date, version/schema baseline when applicable and revision history. For internal changes with no task impact, add a dated review entry stating that conclusion and any operator implications.
- Reconcile changed current instructions with the specialist documents. Keep plans and historical archives distinct from implemented behaviour and deployed evidence.
- Follow `docs/USER_GUIDE_MAINTENANCE.md`. Run `npm run docs:check`; use `-- --base <base-commit>` for a change spanning commits. A token guide edit does not replace review of affected tasks.
- Keep credentials, `.env` contents, actual personal data and recovery material out of documentation. Preserve unrelated workspace changes. A source change does not establish that a database was migrated or an installation deployed/certified.
