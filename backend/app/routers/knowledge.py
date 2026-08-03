import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import KnowledgeDocument
from app.services.document_summary import extract_text_from_uploaded_file
from app.services.knowledge_base import knowledge_document_to_out
from app.services.storage import storage_service

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


def _safe_filename_stem(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return "知识库文档"
    text = re.sub(r"[\\/:*?\"<>|]+", "_", text)
    return text[:120]


def _safe_object_filename(value: str) -> str:
    text = re.sub(r"[\\/:*?\"<>|]+", "_", (value or "").strip())
    return text[:160] or "document"


@router.get("/docs")
def list_knowledge_documents_api(db: Session = Depends(get_db)):
    rows = db.query(KnowledgeDocument).order_by(KnowledgeDocument.updated_at.desc()).all()
    return [knowledge_document_to_out(row) for row in rows]


@router.post("/docs")
async def upload_knowledge_document_api(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    file_name = (file.filename or "").strip()
    if not file_name:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="上传文件为空")
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="单文件不能超过 20MB")

    try:
        extracted = extract_text_from_uploaded_file(file_name, raw, max_chars=60000)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    doc_id = str(uuid.uuid4())
    resolved_title = (title or "").strip() or _safe_filename_stem(file_name.rsplit(".", 1)[0])
    object_name = f"knowledge/{doc_id}/{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}_{_safe_object_filename(file_name)}"
    text = extracted["text"]
    row = KnowledgeDocument(
        id=doc_id,
        title=resolved_title,
        file_name=file_name,
        file_type=extracted["fileType"],
        object_name=object_name,
        content_text=text,
        excerpt=text[:260],
        source_chars=extracted["originalChars"],
    )
    object_saved = False
    try:
        storage_service.save_bytes(object_name, raw, content_type=file.content_type or "application/octet-stream")
        object_saved = True
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
        if object_saved:
            storage_service.delete_object(object_name)
        raise
    db.refresh(row)
    return knowledge_document_to_out(row)
