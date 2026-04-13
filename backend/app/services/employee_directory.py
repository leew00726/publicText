from __future__ import annotations

import hashlib
import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Employee, Unit
from app.services.passwords import hash_password


DEFAULT_EMPLOYEE_PASSWORD = "000000"


def _normalize_text(value: object) -> str:
    return str(value or "").strip()


def _stable_unit_code(company_name: str) -> str:
    digest = hashlib.md5(company_name.encode("utf-8")).hexdigest()[:8]
    return f"unit-{digest}"


def _load_directory_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []

    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        return []

    rows: list[dict[str, str]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue

        employee_no = _normalize_text(item.get("employeeNo"))
        company_name = _normalize_text(item.get("companyName"))
        if not employee_no or not company_name:
            continue

        rows.append(
            {
                "employeeNo": employee_no,
                "name": _normalize_text(item.get("name")) or employee_no,
                "companyName": company_name,
                "departmentName": _normalize_text(item.get("departmentName")),
                "subDepartmentName": _normalize_text(item.get("subDepartmentName")),
            }
        )
    return rows


def sync_employee_directory(db: Session, directory_path: str | None = None) -> int:
    settings = get_settings()
    path = Path(directory_path or settings.employee_directory_path)
    rows = _load_directory_rows(path)
    if not rows:
        return 0

    company_names = sorted({row["companyName"] for row in rows})
    units_by_name = {unit.name: unit for unit in db.query(Unit).filter(Unit.name.in_(company_names)).all()}

    for company_name in company_names:
        if company_name in units_by_name:
            continue
        unit = Unit(name=company_name, code=_stable_unit_code(company_name))
        db.add(unit)
        db.flush()
        units_by_name[company_name] = unit

    employee_nos = [row["employeeNo"] for row in rows]
    employees_by_no = {
        employee.employee_no: employee
        for employee in db.query(Employee).filter(Employee.employee_no.in_(employee_nos)).all()
    }

    synced = 0
    for row in rows:
        unit = units_by_name[row["companyName"]]
        employee = employees_by_no.get(row["employeeNo"])
        if employee is None:
            employee = Employee(
                employee_no=row["employeeNo"],
                name=row["name"],
                company_id=unit.id,
                company_name=unit.name,
                department_name=row["departmentName"] or None,
                sub_department_name=row["subDepartmentName"] or None,
                role="admin",
                password_hash=hash_password(DEFAULT_EMPLOYEE_PASSWORD),
                is_active=True,
            )
            db.add(employee)
            employees_by_no[employee.employee_no] = employee
            synced += 1
            continue

        employee.name = row["name"]
        employee.company_id = unit.id
        employee.company_name = unit.name
        employee.department_name = row["departmentName"] or None
        employee.sub_department_name = row["subDepartmentName"] or None
        employee.role = "admin"
        employee.is_active = True
        if not employee.password_hash:
            employee.password_hash = hash_password(DEFAULT_EMPLOYEE_PASSWORD)
        synced += 1

    db.commit()
    return synced
