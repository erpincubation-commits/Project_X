"""Configuration shared by PostgreSQL entry points."""
import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[4]


def database_url():
    """Read DATABASE_URL from the environment or root .env, without logging it."""
    load_dotenv(PROJECT_ROOT / ".env", override=False)
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url or not url.startswith(("postgresql://", "postgres://")):
        raise RuntimeError("Set DATABASE_URL to a PostgreSQL URL in the root .env file.")
    return url


def database_connection_options():
    return {"conninfo": database_url(), "connect_timeout": 5}
