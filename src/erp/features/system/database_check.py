"""Check the PostgreSQL connection configured by DATABASE_URL."""
import sys
from .config import database_connection_options


def main():
    try:
        import psycopg
    except ImportError:
        print("PostgreSQL driver is not installed. Install the project in its virtual environment.", file=sys.stderr)
        return 1

    try:
        with psycopg.connect(**database_connection_options()) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database(), current_user, version()")
                database, user, version = cursor.fetchone()
    except (psycopg.Error, RuntimeError) as error:
        # Connection strings can contain secrets, so do not print driver errors.
        print(f"PostgreSQL connection failed ({type(error).__name__}). Check the server and PG environment settings.", file=sys.stderr)
        return 1

    print(f"Connected to database {database} as {user}.")
    print(version.split(",", 1)[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
