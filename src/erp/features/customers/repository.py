"""PostgreSQL customer persistence; callers own the transaction."""
from .domain import Customer


def create_customer(connection, customer: Customer) -> None:
    connection.execute(
        "INSERT INTO erp_customers (code, name) VALUES (%s, %s)",
        (customer.code, customer.name),
    )


def list_customers(connection) -> list[Customer]:
    rows = connection.execute("SELECT code, name FROM erp_customers ORDER BY code").fetchall()
    return [Customer(code=code, name=name) for code, name in rows]
