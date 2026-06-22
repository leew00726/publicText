import json
import os
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "test_departments_api.db"
EMPLOYEE_PATH = ROOT / "test_department_directory.json"

EMPLOYEE_PATH.write_text(
    json.dumps(
        [
            {
                "employeeNo": "80051081",
                "name": "金刚善",
                "companyName": "部门测试公司",
                "departmentName": "公司领导",
                "subDepartmentName": "",
            },
            {
                "employeeNo": "82051864",
                "name": "杨立寨",
                "companyName": "部门测试公司",
                "departmentName": "总监、专职董监事",
                "subDepartmentName": "",
            },
            {
                "employeeNo": "",
                "name": "程立强",
                "companyName": "部门测试公司",
                "departmentName": "总监、专职董监事",
                "subDepartmentName": "",
            },
            {
                "employeeNo": "82051916",
                "name": "李辰辉",
                "companyName": "部门测试公司",
                "departmentName": "平台开发与科技管理部",
                "subDepartmentName": "",
            },
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
from app.services.employee_directory import sync_employee_directory  # noqa: E402


class DepartmentsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if DB_PATH.exists():
            DB_PATH.unlink()
        cls._client_cm = TestClient(app)
        cls.client = cls._client_cm.__enter__()
        with SessionLocal() as db:
            sync_employee_directory(db, str(EMPLOYEE_PATH))

    @classmethod
    def tearDownClass(cls) -> None:
        cls._client_cm.__exit__(None, None, None)
        with SessionLocal() as db:
            company = db.query(Unit).filter(Unit.name == "部门测试公司").first()
            if company:
                db.query(Employee).filter(Employee.company_id == company.id).delete(synchronize_session=False)
                db.delete(company)
                db.commit()
        engine.dispose()
        if DB_PATH.exists():
            DB_PATH.unlink()
        if EMPLOYEE_PATH.exists():
            EMPLOYEE_PATH.unlink()

    def test_company_departments_include_ordered_directory_members(self) -> None:
        companies = self.client.get("/api/management/companies").json()
        company = next(item for item in companies if item["name"] == "部门测试公司")

        response = self.client.get(f"/api/management/units/{company['id']}/departments")

        self.assertEqual(response.status_code, 200)
        departments = response.json()
        self.assertEqual(
            [item["name"] for item in departments],
            ["公司领导", "总监、专职董监事", "平台开发与科技管理部"],
        )
        self.assertEqual([item["memberCount"] for item in departments], [1, 2, 1])
        self.assertEqual(
            [member["name"] for member in departments[1]["members"]],
            ["杨立寨", "程立强"],
        )
        self.assertIsNone(departments[1]["members"][1]["employeeNo"])

    def test_unknown_company_departments_return_not_found(self) -> None:
        response = self.client.get("/api/management/units/not-found/departments")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "公司不存在")


if __name__ == "__main__":
    unittest.main()
