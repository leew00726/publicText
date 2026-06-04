from __future__ import annotations

from typing import Literal


EmployeeRole = Literal["staff", "admin"]

DEFAULT_EMPLOYEE_ROLE: EmployeeRole = "admin"

ROLE_PERMISSIONS: dict[EmployeeRole, tuple[str, ...]] = {
    "staff": (
        "workspace.home",
        "workspace.meetingMinutes",
        "layout.home",
        "layout.summary",
        "layout.company",
        "layout.topicList",
        "layout.topicCompose",
        "layout.topicLibrary",
        "layout.docEditor",
    ),
    "admin": (
        "workspace.home",
        "workspace.meetingMinutes",
        "layout.home",
        "layout.summary",
        "layout.company",
        "layout.topicList",
        "layout.topicCompose",
        "layout.topicLibrary",
        "layout.docEditor",
        "management.home",
        "management.company",
        "management.topicList",
        "management.topicTrain",
        "management.company.create",
        "management.company.delete",
        "management.topic.create",
        "management.topic.delete",
        "management.template.delete",
        "management.doc.delete",
    ),
}


def normalize_employee_role(value: object, default: EmployeeRole | None = DEFAULT_EMPLOYEE_ROLE) -> EmployeeRole | None:
    role = str(value or "").strip().lower()
    if role in ROLE_PERMISSIONS:
        return role  # type: ignore[return-value]
    return default


def list_permissions_for_role(role: EmployeeRole) -> list[str]:
    return list(ROLE_PERMISSIONS[role])
