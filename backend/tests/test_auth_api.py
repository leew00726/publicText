import json
import os
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "test_auth_api.db"
EMPLOYEE_PATH = ROOT / "test_employee_directory.json"

EMPLOYEE_PATH.write_text(
    json.dumps(
        [
            {
                "employeeNo": "80051081",
                "name": "金刚善",
                "companyName": "云成数科",
                "departmentName": "公司领导",
                "subDepartmentName": "",
            }
        ],
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_MODE"] = "local"
os.environ["EXPORT_DIR"] = str((ROOT / "test-storage").as_posix())
os.environ["EMPLOYEE_DIRECTORY_PATH"] = str(EMPLOYEE_PATH.as_posix())

from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402


class AuthApiTests(unittest.TestCase):
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
        if EMPLOYEE_PATH.exists():
            EMPLOYEE_PATH.unlink()

    def test_login_accepts_imported_employee_with_default_password(self) -> None:
        resp = self.client.post(
            "/api/auth/login",
            json={"username": "80051081", "password": "000000"},
        )

        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["role"], "admin")
        self.assertEqual(payload["employeeNo"], "80051081")
        self.assertEqual(payload["name"], "金刚善")
        self.assertEqual(payload["companyName"], "云成数科")
        self.assertTrue(payload["companyId"])

    def test_login_rejects_unknown_employee(self) -> None:
        resp = self.client.post(
            "/api/auth/login",
            json={"username": "not-exists", "password": "000000"},
        )

        self.assertEqual(resp.status_code, 401)

    def test_login_rejects_wrong_password(self) -> None:
        resp = self.client.post(
            "/api/auth/login",
            json={"username": "80051081", "password": "123456"},
        )

        self.assertEqual(resp.status_code, 401)


if __name__ == "__main__":
    unittest.main()
