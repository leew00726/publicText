import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SUITE_DB_PATH = ROOT / "test_suite.db"
TEST_STORAGE_DIR = ROOT / "test-storage"

os.environ.setdefault("DATABASE_URL", f"sqlite:///{SUITE_DB_PATH.as_posix()}")
os.environ.setdefault("STORAGE_MODE", "local")
os.environ.setdefault("EXPORT_DIR", str(TEST_STORAGE_DIR.as_posix()))
