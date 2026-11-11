"""Customer master validation independent of storage and user interface."""
from dataclasses import dataclass
import re


class ValidationError(ValueError):
    """A customer field failed validation."""


@dataclass(frozen=True)
class Customer:
    code: str
    name: str

    @classmethod
    def create(cls, code: str, name: str) -> "Customer":
        if not isinstance(code, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,31}", code.strip()):
            raise ValidationError("Customer code must be 1–32 letters, digits, underscores or hyphens, beginning with a letter or digit.")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 160:
            raise ValidationError("Customer name must contain 1–160 characters.")
        if any(ord(character) < 32 or ord(character) == 127 for character in name):
            raise ValidationError("Customer name cannot contain control characters.")
        return cls(code.strip().upper(), name.strip())
