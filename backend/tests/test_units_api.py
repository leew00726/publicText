import os
import unittest
import uuid
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "test_units_api.db"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_MODE"] = "local"
os.environ["EXPORT_DIR"] = str((ROOT / "test-storage").as_posix())

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import RedheadTemplate, Unit  # noqa: E402


class UnitApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if DB_PATH.exists():
            DB_PATH.unlink()
        cls._client_cm = TestClient(app)
        cls.client = cls._client_cm.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._client_cm.__exit__(None, None, None)
        engine.dispose()
        if DB_PATH.exists():
            DB_PATH.unlink()

    def test_delete_unit_removes_company_and_templates(self) -> None:
        create_resp = self.client.post("/api/units", json={"name": f"delete_company_{uuid.uuid4().hex[:8]}"})
        self.assertEqual(create_resp.status_code, 200)
        unit_id = create_resp.json()["id"]

        with SessionLocal() as session:
            self.assertEqual(session.query(Unit).filter(Unit.id == unit_id).count(), 1)
            self.assertEqual(session.query(RedheadTemplate).filter(RedheadTemplate.unit_id == unit_id).count(), 2)

        delete_resp = self.client.delete(f"/api/units/{unit_id}")
        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(delete_resp.json()["message"], "ok")

        with SessionLocal() as session:
            self.assertEqual(session.query(Unit).filter(Unit.id == unit_id).count(), 0)
            self.assertEqual(session.query(RedheadTemplate).filter(RedheadTemplate.unit_id == unit_id).count(), 0)

    def test_delete_unit_returns_404_when_not_found(self) -> None:
        resp = self.client.delete("/api/units/not-exist")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
