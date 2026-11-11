"""Versioned schema changes for the new PostgreSQL application database."""

MIGRATIONS = (
    (1, """CREATE TABLE erp_customers (
        code VARCHAR(32) PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
        CHECK (length(btrim(name)) > 0)
    )"""),
)


def migrate(connection) -> None:
    # A transaction-scoped lock serializes concurrent migration attempts.
    connection.execute("SELECT pg_advisory_xact_lock(83478621)")
    connection.execute("CREATE TABLE IF NOT EXISTS erp_schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)")
    applied = {row[0] for row in connection.execute("SELECT version FROM erp_schema_migrations").fetchall()}
    known = {version for version, _ in MIGRATIONS}
    if applied - known:
        raise RuntimeError("Database schema is newer than this application; use a compatible version.")
    for version, sql in MIGRATIONS:
        if version not in applied:
            connection.execute(sql)
            connection.execute("INSERT INTO erp_schema_migrations (version) VALUES (%s)", (version,))
