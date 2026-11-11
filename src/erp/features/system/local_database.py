"""Run the local-only development database using credentials from DATABASE_URL."""
import argparse
import os
import subprocess
import sys

from psycopg import Error
from psycopg.conninfo import conninfo_to_dict

from .config import PROJECT_ROOT, database_url


def compose_environment(url):
    try:
        connection = conninfo_to_dict(url)
    except (Error, ValueError) as error:
        raise ValueError("DATABASE_URL is invalid.") from error
    if connection.get("host") not in ("localhost", "127.0.0.1"):
        raise ValueError("The development database must use localhost or 127.0.0.1.")
    if not all(connection.get(key) for key in ("user", "password", "dbname")):
        raise ValueError("DATABASE_URL must include a user, password and database name.")
    if connection["password"] == "CHANGE_ME":
        raise ValueError("Replace CHANGE_ME in DATABASE_URL with your development password.")
    port = connection.get("port", "5432")
    if not port.isdecimal() or not 1 <= int(port) <= 65535:
        raise ValueError("DATABASE_URL must include a valid TCP port.")
    return {
        "ERP_COMPOSE_USER": connection["user"],
        "ERP_COMPOSE_PASSWORD": connection["password"],
        "ERP_COMPOSE_DB": connection["dbname"],
        "ERP_COMPOSE_PORT": port,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Manage the local PostgreSQL development container")
    parser.add_argument("action", choices=("up", "stop"))
    args = parser.parse_args(argv)
    try:
        environment = os.environ.copy()
        environment.update(compose_environment(database_url()))
        command = ["docker", "compose", "-f", str(PROJECT_ROOT / "infra" / "compose.yaml")]
        command += ["up", "-d"] if args.action == "up" else ["stop"]
        return subprocess.run(command, cwd=PROJECT_ROOT, env=environment, check=False).returncode
    except (RuntimeError, ValueError) as error:
        print(str(error), file=sys.stderr)
    except OSError:
        print("Could not run Docker Compose. Check Docker Desktop is installed and running.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
