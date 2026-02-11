from __future__ import annotations

import copy
import re
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, DeletionAuditEvent, RedheadTemplate, Topic, TopicTemplate, TopicTemplateDraft, Unit
from app.schemas import (
    DeletionAuditEventOut,
    IdResponse,
    TopicAnalyzeResponse,
    TopicConfirmResponse,
    TopicCreate,
    TopicCreateDocRequest,
    TopicDraftOut,
    TopicOut,
    TopicReviseRequest,
    TopicTemplateOut,
    UnitOut,
)
from app.services.topic_inference import extract_docx_features, extract_pdf_features, infer_topic_rules

router = APIRouter(tags=["topics"])


def _topic_out(row: Topic) -> TopicOut:
    return TopicOut(
        id=row.id,
        companyId=row.company_id,
        name=row.name,
        code=row.code,
        description=row.description,
        status=row.status,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _draft_out(row: TopicTemplateDraft) -> TopicDraftOut:
    return TopicDraftOut(
        id=row.id,
        topicId=row.topic_id,
        version=row.version,
        status=row.status,
        inferredRules=row.inferred_rules,
        confidenceReport=row.confidence_report,
        agentSummary=row.agent_summary,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _template_out(row: TopicTemplate) -> TopicTemplateOut:
    return TopicTemplateOut(
        id=row.id,
        topicId=row.topic_id,
        version=row.version,
        rules=row.rules,
        sourceDraftId=row.source_draft_id,
        effective=row.effective,
        createdAt=row.created_at,
    )


def _audit_out(row: DeletionAuditEvent) -> DeletionAuditEventOut:
    return DeletionAuditEventOut(
        id=row.id,
        companyId=row.company_id,
        topicId=row.topic_id,
        fileCount=row.file_count,
        totalBytes=row.total_bytes,
        status=row.status,
        errorCode=row.error_code,
        startedAt=row.started_at,
        endedAt=row.ended_at,
    )


def _slugify_topic_name(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    if not slug:
        return "topic"
    return slug[:100]


def _generate_topic_code(db: Session, company_id: str, name: str) -> str:
    base = _slugify_topic_name(name)
    candidate = base
    index = 2
    while (
        db.query(Topic)
        .filter(Topic.company_id == company_id, Topic.code == candidate)
        .first()
        is not None
    ):
        suffix = f"-{index}"
        candidate = f"{base[: (120 - len(suffix))]}{suffix}"
        index += 1
    return candidate


def _merge_patch(target: dict, patch: dict) -> dict:
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _merge_patch(target[key], value)
            continue
        target[key] = value
    return target


def _infer_doc_type(topic_name: str, preferred_doc_type: str | None) -> str:
    if preferred_doc_type in {"qingshi", "jiyao", "han", "tongzhi"}:
        return preferred_doc_type

    name = topic_name or ""
    if "请示" in name:
        return "qingshi"
    if "纪要" in name:
        return "jiyao"
    if "函" in name:
        return "han"
    return "tongzhi"


@router.get("/api/companies", response_model=list[UnitOut])
def list_companies(db: Session = Depends(get_db)):
    rows = db.query(Unit).order_by(Unit.created_at.asc()).all()
    return [UnitOut(id=row.id, name=row.name, code=row.code) for row in rows]


@router.get("/api/topics", response_model=list[TopicOut])
def list_topics(companyId: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Topic)
        .filter(Topic.company_id == companyId)
        .order_by(Topic.created_at.asc())
        .all()
    )
    return [_topic_out(row) for row in rows]


@router.get("/api/topics/{topic_id}", response_model=TopicOut)
def get_topic(topic_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")
    return _topic_out(topic)


@router.post("/api/topics", response_model=TopicOut)
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)):
    company = db.query(Unit).filter(Unit.id == payload.companyId).first()
    if not company:
        raise HTTPException(status_code=404, detail="公司不存在")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="题材名称不能为空")

    topic = Topic(
        company_id=payload.companyId,
        name=name,
        code=_generate_topic_code(db, payload.companyId, name),
        description=(payload.description or "").strip() or None,
        status="active",
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _topic_out(topic)


@router.post("/api/topics/{topic_id}/analyze", response_model=TopicAnalyzeResponse)
async def analyze_topic(topic_id: str, files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一个 DOCX 或 PDF 文件")

    started_at = datetime.utcnow()
    total_bytes = 0
    file_count = len(files)

    try:
        features_list: list[dict] = []
        for file in files:
            filename = (file.filename or "").lower()
            data = await file.read()
            total_bytes += len(data)
            if not data:
                continue
            try:
                if filename.endswith(".docx"):
                    features_list.append(extract_docx_features(data))
                elif filename.endswith(".pdf"):
                    features_list.append(extract_pdf_features(data))
                else:
                    raise HTTPException(status_code=400, detail="仅支持 DOCX 或 PDF 文件")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

        rules, confidence = infer_topic_rules(features_list)
        latest = (
            db.query(TopicTemplateDraft)
            .filter(TopicTemplateDraft.topic_id == topic_id)
            .order_by(TopicTemplateDraft.version.desc())
            .first()
        )
        version = (latest.version + 1) if latest else 1

        draft = TopicTemplateDraft(
            topic_id=topic_id,
            version=version,
            status="draft",
            inferred_rules=rules,
            confidence_report=confidence,
            agent_summary="系统已基于上传材料生成初版模板草案。",
        )
        db.add(draft)
        db.add(
            DeletionAuditEvent(
                company_id=topic.company_id,
                topic_id=topic.id,
                file_count=file_count,
                total_bytes=total_bytes,
                status="success",
                error_code=None,
                started_at=started_at,
                ended_at=datetime.utcnow(),
            )
        )
        db.commit()
        db.refresh(draft)
        return TopicAnalyzeResponse(topicId=topic.id, draft=_draft_out(draft))
    except HTTPException as exc:
        db.rollback()
        db.add(
            DeletionAuditEvent(
                company_id=topic.company_id,
                topic_id=topic.id,
                file_count=file_count,
                total_bytes=total_bytes,
                status="failed",
                error_code=f"http_{exc.status_code}",
                started_at=started_at,
                ended_at=datetime.utcnow(),
            )
        )
        db.commit()
        raise
    except Exception as exc:
        db.rollback()
        db.add(
            DeletionAuditEvent(
                company_id=topic.company_id,
                topic_id=topic.id,
                file_count=file_count,
                total_bytes=total_bytes,
                status="failed",
                error_code=exc.__class__.__name__,
                started_at=started_at,
                ended_at=datetime.utcnow(),
            )
        )
        db.commit()
        raise HTTPException(status_code=500, detail="题材分析失败")


@router.get("/api/topics/{topic_id}/drafts/latest", response_model=TopicDraftOut)
def get_latest_draft(topic_id: str, db: Session = Depends(get_db)):
    draft = (
        db.query(TopicTemplateDraft)
        .filter(TopicTemplateDraft.topic_id == topic_id)
        .order_by(TopicTemplateDraft.version.desc())
        .first()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="草案不存在")
    return _draft_out(draft)


@router.post("/api/topics/{topic_id}/agent/revise", response_model=TopicDraftOut)
def revise_draft(topic_id: str, payload: TopicReviseRequest, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    latest = (
        db.query(TopicTemplateDraft)
        .filter(TopicTemplateDraft.topic_id == topic_id)
        .order_by(TopicTemplateDraft.version.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=400, detail="请先分析训练材料后再修订")

    new_rules = copy.deepcopy(latest.inferred_rules)
    patch = payload.patch or {}
    if not patch:
        if "宋体" in payload.instruction:
            patch = {"body": {"fontFamily": "宋体"}}
        elif "黑体" in payload.instruction:
            patch = {"body": {"fontFamily": "黑体"}}

    if patch:
        _merge_patch(new_rules, patch)

    new_draft = TopicTemplateDraft(
        topic_id=topic_id,
        version=latest.version + 1,
        status="draft",
        inferred_rules=new_rules,
        confidence_report=latest.confidence_report,
        agent_summary=payload.instruction,
    )
    db.add(new_draft)
    db.commit()
    db.refresh(new_draft)
    return _draft_out(new_draft)


@router.post("/api/topics/{topic_id}/confirm-template", response_model=TopicConfirmResponse)
def confirm_template(topic_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    latest_draft = (
        db.query(TopicTemplateDraft)
        .filter(TopicTemplateDraft.topic_id == topic_id)
        .order_by(TopicTemplateDraft.version.desc())
        .first()
    )
    if not latest_draft:
        raise HTTPException(status_code=400, detail="没有可确认的模板草案")

    db.query(TopicTemplate).filter(TopicTemplate.topic_id == topic_id).update(
        {"effective": False}, synchronize_session=False
    )

    latest_template = (
        db.query(TopicTemplate)
        .filter(TopicTemplate.topic_id == topic_id)
        .order_by(TopicTemplate.version.desc())
        .first()
    )
    next_version = (latest_template.version + 1) if latest_template else 1

    template = TopicTemplate(
        topic_id=topic_id,
        version=next_version,
        rules=latest_draft.inferred_rules,
        source_draft_id=latest_draft.id,
        effective=True,
    )
    latest_draft.status = "confirmed"
    db.add(template)
    db.commit()
    db.refresh(template)
    return TopicConfirmResponse(topicId=topic_id, template=_template_out(template))


@router.post("/api/topics/{topic_id}/docs", response_model=IdResponse)
def create_doc_from_topic(topic_id: str, payload: TopicCreateDocRequest, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    if payload.topicTemplateId:
        template = (
            db.query(TopicTemplate)
            .filter(TopicTemplate.id == payload.topicTemplateId, TopicTemplate.topic_id == topic_id)
            .first()
        )
        if not template:
            raise HTTPException(status_code=400, detail="指定题材模板无效")
    else:
        template = (
            db.query(TopicTemplate)
            .filter(TopicTemplate.topic_id == topic_id, TopicTemplate.effective.is_(True))
            .order_by(TopicTemplate.version.desc())
            .first()
        )
        if not template:
            template = (
                db.query(TopicTemplate)
                .filter(TopicTemplate.topic_id == topic_id)
                .order_by(TopicTemplate.version.desc())
                .first()
            )

    redhead_template_id = payload.redheadTemplateId
    if redhead_template_id:
        assigned = db.query(RedheadTemplate).filter(RedheadTemplate.id == redhead_template_id).first()
        if not assigned or assigned.unit_id != topic.company_id:
            raise HTTPException(status_code=400, detail="指定红头模板无效")
    else:
        assigned = (
            db.query(RedheadTemplate)
            .filter(RedheadTemplate.unit_id == topic.company_id, RedheadTemplate.is_default.is_(True))
            .first()
        )
        if not assigned:
            assigned = (
                db.query(RedheadTemplate)
                .filter(RedheadTemplate.unit_id == topic.company_id)
                .order_by(RedheadTemplate.created_at.asc())
                .first()
            )
        redhead_template_id = assigned.id if assigned else None

    title = (payload.title or "").strip() or f"{topic.name}（新建）"
    doc_type = _infer_doc_type(topic.name, payload.docType)

    structured_fields = {
        "title": "",
        "mainTo": "",
        "signOff": "",
        "docNo": "",
        "signatory": "",
        "copyNo": "",
        "date": "",
        "exportWithRedhead": True,
        "attachments": [],
        "topicId": topic.id,
        "topicName": topic.name,
        "topicTemplateId": template.id if template else None,
        "topicTemplateVersion": template.version if template else None,
        "topicTemplateRules": template.rules if template else None,
    }

    row = Document(
        title=title,
        doc_type=doc_type,
        unit_id=topic.company_id,
        redhead_template_id=redhead_template_id,
        status="draft",
        structured_fields=structured_fields,
        body={"type": "doc", "content": []},
        import_report=None,
    )
    db.add(row)
    db.commit()
    return IdResponse(id=row.id)


@router.get("/api/topics/{topic_id}/audit-events", response_model=list[DeletionAuditEventOut])
def list_topic_audit_events(topic_id: str, limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    rows = (
        db.query(DeletionAuditEvent)
        .filter(DeletionAuditEvent.topic_id == topic_id)
        .order_by(DeletionAuditEvent.ended_at.desc())
        .limit(limit)
        .all()
    )
    return [_audit_out(row) for row in rows]


@router.get("/api/topics/{topic_id}/templates", response_model=list[TopicTemplateOut])
def list_templates(topic_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(TopicTemplate)
        .filter(TopicTemplate.topic_id == topic_id)
        .order_by(TopicTemplate.version.desc())
        .all()
    )
    return [_template_out(row) for row in rows]
