import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RedheadTemplate, Unit
from app.schemas import ApiMessage, UnitCreate, UnitOut, UnitUpdate
from app.services.constants import default_redhead_template_a, default_redhead_template_b

router = APIRouter(prefix="/api/units", tags=["units"])


def _normalize_unit_code(code: str | None) -> str:
    raw = (code or "").strip()
    if not raw:
        return f"unit-{uuid.uuid4().hex[:8]}"

    safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", raw).strip("-_")
    if not safe:
        return f"unit-{uuid.uuid4().hex[:8]}"
    return safe[:50]


@router.get("", response_model=list[UnitOut])
def list_units(db: Session = Depends(get_db)):
    rows = db.query(Unit).order_by(Unit.created_at.asc()).all()
    return [UnitOut(id=r.id, name=r.name, code=r.code) for r in rows]


@router.post("", response_model=UnitOut)
def create_unit(payload: UnitCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="单位名称不能为空")

    row = Unit(name=name, code=_normalize_unit_code(payload.code))
    db.add(row)

    try:
        db.flush()
        tpl_a = default_redhead_template_a(row.id, row.name)
        tpl_b = default_redhead_template_b(row.id, row.name)

        db.add_all(
            [
                RedheadTemplate(
                    unit_id=row.id,
                    name=tpl_a["name"],
                    version=tpl_a["version"],
                    status=tpl_a["status"],
                    is_default=tpl_a["isDefault"],
                    scope=tpl_a["scope"],
                    note=tpl_a["note"],
                    page=tpl_a["page"],
                    elements=tpl_a["elements"],
                ),
                RedheadTemplate(
                    unit_id=row.id,
                    name=tpl_b["name"],
                    version=tpl_b["version"],
                    status=tpl_b["status"],
                    is_default=tpl_b["isDefault"],
                    scope=tpl_b["scope"],
                    note=tpl_b["note"],
                    page=tpl_b["page"],
                    elements=tpl_b["elements"],
                ),
            ]
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="单位名称或编码已存在")

    return UnitOut(id=row.id, name=row.name, code=row.code)


@router.put("/{unit_id}", response_model=ApiMessage)
def update_unit(unit_id: str, payload: UnitUpdate, db: Session = Depends(get_db)):
    row = db.query(Unit).filter(Unit.id == unit_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="单位不存在")

    row.name = payload.name.strip()
    if not row.name:
        raise HTTPException(status_code=400, detail="单位名称不能为空")

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="单位名称已存在")

    return ApiMessage(message="ok")
