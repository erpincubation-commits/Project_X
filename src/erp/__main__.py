"""Development CLI for the first PostgreSQL-backed feature."""
import argparse
import sys

from erp.features.customers.domain import Customer, ValidationError
from erp.features.customers.repository import create_customer, list_customers
from erp.features.system.migrations import migrate
from erp.features.system.config import database_connection_options


def main(argv=None):
    parser = argparse.ArgumentParser(description="ERP development CLI")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("migrate", help="Initialize or upgrade the empty development database")
    add = commands.add_parser("add-customer", help="Add a customer to the master")
    add.add_argument("code")
    add.add_argument("name")
    commands.add_parser("list-customers", help="List customers")
    args = parser.parse_args(argv)
    try:
        customer = Customer.create(args.code, args.name) if args.command == "add-customer" else None
    except ValidationError as error:
        print(str(error), file=sys.stderr)
        return 2
    try:
        import psycopg
    except ImportError:
        print("PostgreSQL driver is not installed; install the project in its virtual environment.", file=sys.stderr)
        return 1
    try:
        with psycopg.connect(**database_connection_options()) as connection:
            if args.command == "migrate":
                migrate(connection)
            elif args.command == "add-customer":
                create_customer(connection, customer)
            else:
                for row in list_customers(connection):
                    print(f"{row.code}\t{row.name}")
        if args.command == "migrate":
            print("Database schema is up to date.")
        elif args.command == "add-customer":
            print(f"Created customer {customer.code}.")
    except psycopg.errors.UniqueViolation:
        print("Customer code already exists.", file=sys.stderr)
        return 1
    except (psycopg.Error, RuntimeError) as error:
        # Driver errors may contain connection details; do not echo them.
        print(f"Database operation failed ({type(error).__name__}). Check your connection and schema.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
