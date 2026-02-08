from __future__ import annotations

from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RedheadTemplate
from app.schemas import (
    ApiMessage,
    IdResponse,
    RedheadTemplateCreate,
    RedheadTemplateOut,
    RedheadTemplateUpdate,
    RedheadValidationResult,
)
from app.services.redhead_validation import validate_publish_payload

router = APIRouter(prefix="/api/redheadTemplates", tags=["redhead-templates"])


def _to_out(row: RedheadTemplate) -> RedheadTemplateOut:
    return RedheadTemplateOut(
        id=row.id,
        unitId=row.unit_id,
        name=row.name,
        version=row.version,
        status=row.status,
        isDefault=row.is_default,
        scope=row.scope,
        note=row.note,
        page=row.page,
        elements=row.elements,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


@router.get("", response_model=list[RedheadTemplateOut])
def list_templates(unitId: str | None = Query(default=None), db: Session = Depends(get_db)):
    q = db.query(RedheadTemplate)
    if unitId:
        q = q.filter(RedheadTemplate.unit_id == unitId)
    rows = q.order_by(RedheadTemplate.updated_at.desc()).all()
    return [_to_out(r) for r in rows]


@router.get("/{template_id}", response_model=RedheadTemplateOut)
def get_template(template_id: str, db: Session = Depends(get_db)):
    row = db.query(RedheadTemplate).filter(RedheadTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="模板不存在")
    return _to_out(row)


@router.post("", response_model=IdResponse)
def create_template(payload: RedheadTemplateCreate, db: Session = Depends(get_db)):
    row = RedheadTemplate(
        unit_id=payload.unitId,
        name=payload.name,
        version=payload.version,
        status=payload.status,
        is_default=payload.isDefault,
        scope=payload.scope,
        note=payload.note,
        page=payload.page.model_dump(),
        elements=[e.model_dump() for e in payload.elements],
    )
    if payload.isDefault:
        db.query(RedheadTemplate).filter(RedheadTemplate.unit_id == payload.unitId).update(
            {RedheadTemplate.is_default: False}
        )
    db.add(row)
    db.commit()
    return IdResponse(id=row.id)


@router.put("/{template_id}", response_model=ApiMessage)
def update_template(template_id: str, payload: RedheadTemplateUpdate, db: Session = Depends(get_db)):
    row = db.query(RedheadTemplate).filter(RedheadTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="模板不存在")

    data = payload.model_dump(exclude_none=True)
    if "name" in data:
        row.name = data["name"]
    if "note" in data:
        row.note = data["note"]
    if "status" in data:
        row.status = data["status"]
    if "isDefault" in data:
        row.is_default = data["isDefault"]
        if row.is_default:
            db.query(RedheadTemplate).filter(
                RedheadTemplate.unit_id == row.unit_id, RedheadTemplate.id != row.id
            ).update({RedheadTemplate.is_default: False})
    if "page" in data:
        row.page = data["page"]
    if "elements" in data:
        row.elements = data["elements"]

    db.commit()
    return ApiMessage(message="ok")


@router.post("/{template_id}/clone", response_model=IdResponse)
def clone_template(template_id: str, db: Session = Depends(get_db)):
    row = db.query(RedheadTemplate).filter(RedheadTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="模板不存在")

    new_row = RedheadTemplate(
        unit_id=row.unit_id,
        name=f"{row.name}-副本",
        version=row.version + 1,
        status="draft",
        is_default=False,
        scope=row.scope,
        note=row.note,
        page=deepcopy(row.page),
        elements=deepcopy(row.elements),
    )
    db.add(new_row)
    db.commit()
    return IdResponse(id=new_row.id)


@router.post("/{template_id}/publish", response_model=RedheadValidationResult)
def publish_template(template_id: str, db: Session = Depends(get_db)):
    row = db.query(RedheadTemplate).filter(RedheadTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="模板不存在")

    payload = {
        "elements": row.elements,
        "page": row.page,
    }
    errors, warnings = validate_publish_payload(payload)
    if errors:
        return RedheadValidationResult(errors=errors, warnings=warnings)

    row.status = "published"
    db.commit()
    return RedheadValidationResult(errors=[], warnings=warnings)


@router.post("/{template_id}/disable", response_model=ApiMessage)
def disable_template(template_id: str, db: Session = Depends(get_db)):
    row = db.query(RedheadTemplate).filter(RedheadTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="模板不存在")
    row.status = "disabled"
    if row.is_default:
        row.is_default = False
    db.commit()
    return ApiMessage(message="ok")


@router.post("/{template_id}/setDefault", response_model=ApiMessage)
def set_default_template(template_id: str, db: Session = Depends(get_db)):
    row = db.query(RedheadTemplate).filter(RedheadTemplate.id == template_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="模板不存在")

    db.query(RedheadTemplate).filter(RedheadTemplate.unit_id == row.unit_id).update(
        {RedheadTemplate.is_default: False}
    )
    row.is_default = True
    if row.status == "disabled":
        row.status = "draft"
    db.commit()
    return ApiMessage(message="ok")
