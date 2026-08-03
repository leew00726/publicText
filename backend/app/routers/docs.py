from __future__ import annotations

from datetime import datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, DocumentFile, Unit
from app.schemas import (
    ApiMessage,
    CheckResponse,
    DocumentCreate,
    DocumentOut,
    DocumentUpdate,
    IdResponse,
    ImportResponse,
)
from app.services.checker import check_document, normalize_doc_no_brackets
from app.services.docx_export import export_docx
from app.services.docx_import import import_docx
from app.services.storage import storage_service
from app.services.template_rules import normalize_template_rules

router = APIRouter(prefix="/api/docs", tags=["docs"])


def _to_out(row: Document) -> DocumentOut:
    structured_fields = dict(row.structured_fields or {})
    if structured_fields.get("topicTemplateRules"):
        structured_fields["topicTemplateRules"] = normalize_template_rules(structured_fields["topicTemplateRules"])
    return DocumentOut(
        id=row.id,
        title=row.title,
        docType=row.doc_type,
        unitId=row.unit_id,
        redheadTemplateId=row.redhead_template_id,
        status=row.status,
        structuredFields=structured_fields,
        body=row.body,
        importReport=row.import_report,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


@router.get("", response_model=list[DocumentOut])
def list_docs(topicId: str | None = Query(default=None), unitId: str | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(Document)
    if unitId:
        query = query.filter(Document.unit_id == unitId)

    rows = query.order_by(Document.updated_at.desc()).all()
    if topicId:
        rows = [row for row in rows if isinstance(row.structured_fields, dict) and row.structured_fields.get("topicId") == topicId]
    return [_to_out(r) for r in rows]


@router.post("", response_model=IdResponse)
def create_doc(payload: DocumentCreate, db: Session = Depends(get_db)):
    sf = payload.structuredFields.model_dump()
    sf["docNo"] = normalize_doc_no_brackets(sf.get("docNo", ""))
    if sf.get("topicTemplateRules"):
        sf["topicTemplateRules"] = normalize_template_rules(sf["topicTemplateRules"])

    row = Document(
        title=payload.title,
        doc_type=payload.docType,
        unit_id=payload.unitId,
        redhead_template_id=payload.redheadTemplateId,
        status=payload.status,
        structured_fields=sf,
        body=payload.body,
        import_report=None,
    )
    db.add(row)
    db.commit()
    return IdResponse(id=row.id)


@router.get("/{doc_id}", response_model=DocumentOut)
def get_doc(doc_id: str, db: Session = Depends(get_db)):
    row = db.query(Document).filter(Document.id == doc_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="文档不存在")
    return _to_out(row)


@router.put("/{doc_id}", response_model=ApiMessage)
def update_doc(doc_id: str, payload: DocumentUpdate, db: Session = Depends(get_db)):
    row = db.query(Document).filter(Document.id == doc_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="文档不存在")

    data = payload.model_dump(exclude_none=True)
    if "title" in data:
        row.title = data["title"]
    if "docType" in data:
        row.doc_type = data["docType"]
    if "unitId" in data:
        row.unit_id = data["unitId"]
    if "redheadTemplateId" in data:
        row.redhead_template_id = data["redheadTemplateId"]
    if "status" in data:
        row.status = data["status"]
    if "structuredFields" in data:
        sf = data["structuredFields"]
        sf["docNo"] = normalize_doc_no_brackets(sf.get("docNo", ""))
        if sf.get("topicTemplateRules"):
            sf["topicTemplateRules"] = normalize_template_rules(sf["topicTemplateRules"])
        row.structured_fields = sf
    if "body" in data:
        row.body = data["body"]

    db.commit()
    return ApiMessage(message="ok")


@router.delete("/{doc_id}", response_model=ApiMessage)
def delete_doc(doc_id: str, db: Session = Depends(get_db)):
    row = db.query(Document).filter(Document.id == doc_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="文档不存在")

    file_rows = db.query(DocumentFile).filter(DocumentFile.document_id == doc_id).all()
    for item in file_rows:
        storage_service.delete_object(item.object_name)

    db.query(DocumentFile).filter(DocumentFile.document_id == doc_id).delete(synchronize_session=False)
    db.delete(row)
    db.commit()
    return ApiMessage(message="ok")


@router.post("/{doc_id}/check", response_model=CheckResponse)
def check_doc(doc_id: str, db: Session = Depends(get_db)):
    row = db.query(Document).filter(Document.id == doc_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="文档不存在")

    issues = check_document(row.body, row.structured_fields, row.title)
    return CheckResponse(issues=issues)


@router.post("/importDocx", response_model=ImportResponse)
async def import_docx_api(
    file: UploadFile = File(...),
    documentId: str | None = Form(default=None),
    unitId: str = Form(...),
    docType: str = Form("qingshi"),
    title: str = Form("导入文档"),
    redheadTemplateId: str | None = Form(default=None),
    preserveFormatting: bool = Form(default=True),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="仅支持 DOCX")

    data = await file.read()
    body, structured_fields, report = import_docx(data, preserve_formatting=preserveFormatting)
    resolved_title = (structured_fields.get("title") or "").strip() or title

    row = db.query(Document).filter(Document.id == documentId).first() if documentId else None
    if documentId and not row:
        raise HTTPException(status_code=404, detail="文档不存在")

    if row:
        existing_fields = row.structured_fields if isinstance(row.structured_fields, dict) else {}
        preserved_keys = {
            "topicId",
            "topicName",
            "topicTemplateId",
            "topicTemplateVersion",
            "topicTemplateRules",
            "exportWithRedhead",
        }
        for key in preserved_keys:
            if key in existing_fields:
                structured_fields[key] = existing_fields[key]
        row.title = resolved_title
        row.structured_fields = structured_fields
        row.body = body
        row.import_report = report
    else:
        row = Document(
            title=resolved_title,
            doc_type=docType,
            unit_id=unitId,
            redhead_template_id=redheadTemplateId,
            status="draft",
            structured_fields=structured_fields,
            body=body,
            import_report=report,
        )
        db.add(row)
        db.flush()

    object_name = f"imports/{row.id}/{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    object_saved = False
    try:
        storage_service.save_bytes(
            object_name,
            data,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        object_saved = True
        db.add(DocumentFile(document_id=row.id, file_kind="import_source", object_name=object_name))
        db.commit()
    except Exception:
        db.rollback()
        if object_saved:
            storage_service.delete_object(object_name)
        raise

    return ImportResponse(docId=row.id, importReport=report)


@router.post("/{doc_id}/exportDocx")
def export_docx_api(doc_id: str, db: Session = Depends(get_db)):
    row = db.query(Document).filter(Document.id == doc_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="文档不存在")

    unit = db.query(Unit).filter(Unit.id == row.unit_id).first()
    if not unit:
        raise HTTPException(status_code=400, detail="单位不存在")

    structured_fields = row.structured_fields or {}
    include_redhead = False

    doc_payload = {
        "id": row.id,
        "title": row.title,
        "docType": row.doc_type,
        "structuredFields": structured_fields,
        "body": row.body,
    }

    redhead_payload = {"elements": [], "page": {}}
    output = export_docx(doc_payload, unit.name, redhead_payload, include_redhead=include_redhead)

    filename = f"{row.title or '公文'}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.docx"
    object_name = f"exports/{row.id}/{filename}"
    object_saved = False
    try:
        storage_service.save_bytes(
            object_name,
            output,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        object_saved = True
        db.add(DocumentFile(document_id=row.id, file_kind="export_docx", object_name=object_name))
        db.commit()
    except Exception:
        db.rollback()
        if object_saved:
            storage_service.delete_object(object_name)
        raise

    return StreamingResponse(
        iter([output]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": (
                f"attachment; filename=export.docx; filename*=UTF-8''{quote(filename)}"
            )
        },
    )
