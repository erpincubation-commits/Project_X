import unittest
from erp.features.customers.domain import Customer, ValidationError
from erp.features.customers.repository import create_customer, list_customers


class FakeConnection:
    def __init__(self):
        self.calls = []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        return self

    def fetchall(self):
        return [("CUST-1", "Example Customer")]


class CustomerTests(unittest.TestCase):
    def test_normalizes_input(self):
        self.assertEqual(Customer.create(" cust-1 ", " Example Customer "), Customer("CUST-1", "Example Customer"))

    def test_rejects_invalid_values(self):
        for code, name in [("", "Name"), ("a b", "Name"), ("A" * 33, "Name"), ("A", "   "), ("A", "Name\nOther"), ("A", "x" * 161)]:
            with self.subTest(code=code, name=name), self.assertRaises(ValidationError):
                Customer.create(code, name)

    def test_repository_uses_parameters_and_returns_customers(self):
        connection = FakeConnection()
        create_customer(connection, Customer.create("cust-1", "Example Customer"))
        self.assertEqual(connection.calls[0][1], ("CUST-1", "Example Customer"))
        self.assertEqual(list_customers(connection), [Customer("CUST-1", "Example Customer")])


if __name__ == "__main__":
    unittest.main()
