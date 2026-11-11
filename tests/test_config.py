import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from erp.features.system import config
from erp.features.system.local_database import compose_environment


class DatabaseConfigTests(unittest.TestCase):
    def test_loads_root_url_and_respects_process_environment(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / ".env").write_text("DATABASE_URL=postgresql://file:secret@localhost/filedb\n", encoding="utf-8")
            with patch.object(config, "PROJECT_ROOT", root), patch.dict(os.environ, {}, clear=True):
                self.assertEqual(config.database_connection_options()["conninfo"], "postgresql://file:secret@localhost/filedb")
            with patch.object(config, "PROJECT_ROOT", root), patch.dict(os.environ, {"DATABASE_URL": "postgresql://shell:secret@localhost/shelldb"}, clear=True):
                self.assertEqual(config.database_url(), "postgresql://shell:secret@localhost/shelldb")

    def test_missing_or_invalid_url_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(config, "PROJECT_ROOT", Path(temporary)):
            for url in ("", "sqlite:///example.db"):
                with self.subTest(url=url), patch.dict(os.environ, {"DATABASE_URL": url}, clear=True):
                    with self.assertRaises(RuntimeError):
                        config.database_connection_options()

    def test_local_compose_uses_decoded_url_and_rejects_nonlocal(self):
        values = compose_environment("postgresql://erp:abc%40def@127.0.0.1:55432/erp_dev")
        self.assertEqual(values["ERP_COMPOSE_PASSWORD"], "abc@def")
        self.assertEqual(values["ERP_COMPOSE_PORT"], "55432")
        for url in ("postgresql://erp:secret@example.com/erp_dev", "postgresql://erp:CHANGE_ME@localhost/erp_dev", "postgresql://erp@localhost/erp_dev"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                compose_environment(url)
