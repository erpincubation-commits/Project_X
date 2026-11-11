# Local PostgreSQL development setup

This is an isolated development database. The existing pilot still uses SQLite; the PostgreSQL customer master does not migrate old data. Do not enter production data. Docker Desktop must run with Linux containers enabled.

1. From the repository root, create a virtual environment and install the project:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -e .
   ```

2. If needed, copy `.env.example` to `.env` in the repository root. Set `DATABASE_URL` to a PostgreSQL URI, replacing `CHANGE_ME` with a strong development password. Percent-encode special characters in the username, password and database name (for example, `@` becomes `%40`). The default local host and port are `127.0.0.1:55432`. Python loads `.env` using `python-dotenv`; an existing process `DATABASE_URL` takes precedence.

   The URL contains a password. `.env` is ignored by Git but remains plaintext: restrict Windows file permissions and never commit or share it. The local development container receives its password through its environment and Docker administrators can inspect it; use proper secret management and least-privilege accounts for deployment.

3. Start the local database. The helper derives its settings from the URL and only permits a loopback host:

   ```powershell
   .\.venv\Scripts\python.exe -m erp.features.system.local_database up
   ```

4. Check the connection and initialize the schema:

   ```powershell
   .\.venv\Scripts\python.exe -m erp.features.system.database_check
   .\.venv\Scripts\python.exe -m erp migrate
   .\.venv\Scripts\python.exe -m erp add-customer CUST-001 'Example Customer'
   .\.venv\Scripts\python.exe -m erp list-customers
   ```

To stop the container without removing its data, run `python -m erp.features.system.local_database stop` using the virtual environment interpreter. Docker keeps data in the named `erp_postgres_data` volume. The PostgreSQL image applies the user, database and password only when initializing an empty volume: changing the URL does not change an existing database account or its password. Rotate the database password inside PostgreSQL and update the URL together. Do not delete the volume unless its contents are intentionally disposable.

The customer master has an initial schema but is not connected to the desktop UI or the older pilot workflows. Production authentication, authorization, backups, recovery and migration procedures still need to be developed and verified.
