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
                "role": "admin",
            },
            {
                "employeeNo": "81000001",
                "name": "李四",
                "companyName": "华能资本",
                "departmentName": "业务部",
                "subDepartmentName": "",
                "role": "staff",
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

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Employee, Unit  # noqa: E402
from app.services.employee_directory import (  # noqa: E402
    DEFAULT_EMPLOYEE_PASSWORD,
    _stable_unit_code,
    sync_employee_directory,
)
from app.services.passwords import hash_password  # noqa: E402


class AuthApiTests(unittest.TestCase):
    employee_nos = ["80051081", "81000001"]
    mutable_company_name = "华能资本"
    renamed_company_name = "华能资本控股"

    @classmethod
    def setUpClass(cls) -> None:
        if DB_PATH.exists():
            DB_PATH.unlink()
        cls._client_cm = TestClient(app)
        cls.client = cls._client_cm.__enter__()
        cls._sync_test_employees()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._delete_test_employees()
        cls._delete_mutable_test_company()
        cls._client_cm.__exit__(None, None, None)
        engine.dispose()
        if DB_PATH.exists():
            DB_PATH.unlink()
        if EMPLOYEE_PATH.exists():
            EMPLOYEE_PATH.unlink()

    @classmethod
    def _delete_test_employees(cls) -> None:
        with SessionLocal() as db:
            db.query(Employee).filter(Employee.employee_no.in_(cls.employee_nos)).delete(synchronize_session=False)
            db.commit()

    @classmethod
    def _reset_mutable_test_company(cls) -> None:
        with SessionLocal() as db:
            company_code = _stable_unit_code(cls.mutable_company_name)
            company = db.query(Unit).filter(Unit.code == company_code).first()
            if company is None:
                return
            if company.name == cls.mutable_company_name:
                return

            existing = db.query(Unit).filter(Unit.name == cls.mutable_company_name).first()
            if existing is not None and existing.id != company.id:
                db.delete(company)
            else:
                company.name = cls.mutable_company_name
            db.commit()

    @classmethod
    def _delete_mutable_test_company(cls) -> None:
        with SessionLocal() as db:
            company_code = _stable_unit_code(cls.mutable_company_name)
            db.query(Unit).filter(
                (Unit.code == company_code) | (Unit.name == cls.renamed_company_name)
            ).delete(synchronize_session=False)
            db.commit()

    @classmethod
    def _sync_test_employees(cls) -> None:
        cls._delete_test_employees()
        cls._reset_mutable_test_company()
        with SessionLocal() as db:
            sync_employee_directory(db, str(EMPLOYEE_PATH))
            for employee in db.query(Employee).filter(Employee.employee_no.in_(cls.employee_nos)).all():
                employee.password_hash = hash_password(DEFAULT_EMPLOYEE_PASSWORD)
            db.commit()

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
        self.assertIn("management.company.create", payload["permissions"])
        self.assertIn("layout.topicList", payload["permissions"])

    def test_login_binds_employee_to_directory_company_and_role(self) -> None:
        resp = self.client.post(
            "/api/auth/login",
            json={"username": "81000001", "password": "000000"},
        )

        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertEqual(payload["role"], "staff")
        self.assertEqual(payload["employeeNo"], "81000001")
        self.assertEqual(payload["name"], "李四")
        self.assertEqual(payload["companyName"], "华能资本")
        self.assertTrue(payload["companyId"])
        self.assertIn("layout.topicList", payload["permissions"])
        self.assertNotIn("management.company.create", payload["permissions"])

    def test_login_binds_different_employees_to_different_companies(self) -> None:
        first = self.client.post(
            "/api/auth/login",
            json={"username": "80051081", "password": "000000"},
        )
        second = self.client.post(
            "/api/auth/login",
            json={"username": "81000001", "password": "000000"},
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertNotEqual(first.json()["companyId"], second.json()["companyId"])
        self.assertEqual(first.json()["companyName"], "云成数科")
        self.assertEqual(second.json()["companyName"], "华能资本")

    def test_login_uses_live_company_master_data_after_rename(self) -> None:
        login_resp = self.client.post(
            "/api/auth/login",
            json={"username": "81000001", "password": "000000"},
        )
        self.assertEqual(login_resp.status_code, 200)
        company_id = login_resp.json()["companyId"]

        rename_resp = self.client.put(
            f"/api/management/units/{company_id}",
            json={"name": "华能资本控股"},
        )
        self.assertEqual(rename_resp.status_code, 200)

        relogin_resp = self.client.post(
            "/api/auth/login",
            json={"username": "81000001", "password": "000000"},
        )
        self.assertEqual(relogin_resp.status_code, 200)
        self.assertEqual(relogin_resp.json()["companyName"], "华能资本控股")

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
