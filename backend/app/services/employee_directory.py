from __future__ import annotations

import hashlib
import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Department, Employee, Personnel, Unit
from app.services.passwords import hash_password


DEFAULT_EMPLOYEE_PASSWORD = "000000"


def _normalize_text(value: object) -> str:
    return str(value or "").strip()


def _stable_unit_code(company_name: str) -> str:
    digest = hashlib.md5(company_name.encode("utf-8")).hexdigest()[:8]
    return f"unit-{digest}"


def _stable_department_code(company_name: str, department_name: str) -> str:
    digest = hashlib.md5(f"{company_name}:{department_name}".encode("utf-8")).hexdigest()[:10]
    return f"dept-{digest}"


def _personnel_source_key(row: dict[str, str]) -> str:
    if row["employeeNo"]:
        return f"employee:{row['employeeNo']}"
    digest = hashlib.md5(
        f"{row['companyName']}:{row['departmentName']}:{row['name']}".encode("utf-8")
    ).hexdigest()[:16]
    return f"directory:{digest}"


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
        name = _normalize_text(item.get("name"))
        company_name = _normalize_text(item.get("companyName"))
        department_name = _normalize_text(item.get("departmentName"))
        if not name or not company_name or not department_name:
            continue

        rows.append(
            {
                "employeeNo": employee_no,
                "name": name,
                "companyName": company_name,
                "departmentName": department_name,
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

    department_specs: dict[tuple[str, str], int] = {}
    department_positions: dict[str, int] = {}
    for row in rows:
        key = (row["companyName"], row["departmentName"])
        if key in department_specs:
            continue
        sort_order = department_positions.get(row["companyName"], 0)
        department_specs[key] = sort_order
        department_positions[row["companyName"]] = sort_order + 1

    target_company_ids = [unit.id for unit in units_by_name.values()]
    existing_departments = {
        (department.company_id, department.name): department
        for department in db.query(Department).filter(Department.company_id.in_(target_company_ids)).all()
    }
    departments_by_name: dict[tuple[str, str], Department] = {}
    desired_department_ids: set[str] = set()
    for (company_name, department_name), sort_order in department_specs.items():
        unit = units_by_name[company_name]
        lookup_key = (unit.id, department_name)
        department = existing_departments.get(lookup_key)
        if department is None:
            department = Department(
                company_id=unit.id,
                name=department_name,
                code=_stable_department_code(company_name, department_name),
                sort_order=sort_order,
            )
            db.add(department)
            db.flush()
        else:
            department.sort_order = sort_order
        departments_by_name[(company_name, department_name)] = department
        desired_department_ids.add(department.id)

    existing_personnel = {
        (person.company_id, person.source_key): person
        for person in db.query(Personnel).filter(Personnel.company_id.in_(target_company_ids)).all()
    }
    desired_personnel_ids: set[str] = set()
    for sort_order, row in enumerate(rows):
        unit = units_by_name[row["companyName"]]
        department = departments_by_name[(row["companyName"], row["departmentName"])]
        source_key = _personnel_source_key(row)
        person = existing_personnel.get((unit.id, source_key))
        if person is None:
            person = Personnel(
                company_id=unit.id,
                department_id=department.id,
                source_key=source_key,
                employee_no=row["employeeNo"] or None,
                name=row["name"],
                sub_department_name=row["subDepartmentName"] or None,
                has_login=bool(row["employeeNo"]),
                sort_order=sort_order,
            )
            db.add(person)
            db.flush()
        else:
            person.department_id = department.id
            person.employee_no = row["employeeNo"] or None
            person.name = row["name"]
            person.sub_department_name = row["subDepartmentName"] or None
            person.has_login = bool(row["employeeNo"])
            person.sort_order = sort_order
        desired_personnel_ids.add(person.id)

    for person in existing_personnel.values():
        if person.id not in desired_personnel_ids:
            db.delete(person)
    db.flush()

    for department in existing_departments.values():
        if department.id not in desired_department_ids:
            db.delete(department)
    db.flush()

    employee_nos = [row["employeeNo"] for row in rows if row["employeeNo"]]
    employees_by_no = {
        employee.employee_no: employee
        for employee in db.query(Employee).filter(Employee.employee_no.in_(employee_nos)).all()
    }

    synced = 0
    for row in rows:
        if not row["employeeNo"]:
            continue
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
