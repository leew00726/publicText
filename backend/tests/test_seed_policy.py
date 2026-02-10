import os
import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "test_seed_policy.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_MODE"] = "local"
os.environ["EXPORT_DIR"] = str((ROOT / "test-storage").as_posix())

from app.database import Base
from app.models import Unit
from app.seed import seed_data


class SeedPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)()

    def tearDown(self) -> None:
        self.session.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_seed_data_is_skipped_when_disabled(self) -> None:
        seed_data(self.session, enabled=False)
        self.assertEqual(self.session.query(Unit).count(), 0)

    def test_seed_data_populates_defaults_when_enabled(self) -> None:
        seed_data(self.session, enabled=True)
        self.assertGreaterEqual(self.session.query(Unit).count(), 2)


if __name__ == "__main__":
    unittest.main()
