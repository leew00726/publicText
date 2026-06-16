import re
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TopicTemplate
from app.services.ai_agent import (
    AgentConfigError,
    AgentUpstreamError,
    draft_document_with_knowledge,
    rewrite_with_deepseek,
    summarize_document_with_deepseek,
)
from app.services.document_summary import build_summary_docx, extract_text_from_uploaded_file, prepare_summary_source_text
from app.services.knowledge_base import build_knowledge_context, search_knowledge_documents

router = APIRouter(prefix="/api/ai", tags=["ai"])


class RewriteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    mode: Literal["formal", "concise", "polish"] = "formal"


class SummaryDocxExportRequest(BaseModel):
    title: str = Field(default="公文总结", min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=20000)
    sourceFileName: str | None = Field(default=None, max_length=255)
    topicTemplateId: str | None = Field(default=None, max_length=36)


class KnowledgeDraftRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=4000)
    summaryLength: Literal["short", "medium", "long"] = "medium"
    limit: int = Field(default=5, ge=1, le=10)


def _safe_filename_stem(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return "公文总结"
    text = re.sub(r"[\\/:*?\"<>|]+", "_", text)
    return text[:120]


@router.post("/rewrite")
def rewrite_api(payload: RewriteRequest):
    try:
        result = rewrite_with_deepseek(payload.text, payload.mode)
    except AgentConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "message": "ok",
        "provider": "deepseek",
        "model": result["model"],
        "usage": result["usage"],
        "mode": payload.mode,
        "original": payload.text,
        "rewritten": result["text"],
    }


@router.post("/summarize-document")
async def summarize_document_api(
    file: UploadFile | None = File(default=None),
    sourceText: str | None = Form(default=None),
    summaryLength: Literal["short", "medium", "long"] = Form(default="medium"),
    extraInstruction: str | None = Form(default=None),
):
    pasted_text = sourceText.strip() if isinstance(sourceText, str) else ""
    if file is None and not pasted_text:
        raise HTTPException(status_code=400, detail="请上传文件或粘贴文本")

    if file is not None:
        file_name = (file.filename or "").strip()
        if not file_name:
            raise HTTPException(status_code=400, detail="文件名不能为空")

        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="上传文件为空")

        try:
            extracted = extract_text_from_uploaded_file(file_name, raw)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    else:
        file_name = "直接粘贴文本"
        try:
            extracted = prepare_summary_source_text(pasted_text)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        result = summarize_document_with_deepseek(
            source_text=extracted["text"],
            summary_length=summaryLength,
            extra_instruction=extraInstruction,
        )
    except AgentConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "message": "ok",
        "provider": "deepseek",
        "model": result["model"],
        "usage": result["usage"],
        "summaryLength": summaryLength,
        "source": {
            "fileName": file_name,
            "fileType": extracted["fileType"],
            "originalChars": extracted["originalChars"],
            "usedChars": extracted["usedChars"],
            "truncated": extracted["truncated"],
        },
        "summary": result["text"],
    }


@router.post("/draft-with-knowledge")
def draft_with_knowledge_api(payload: KnowledgeDraftRequest, db: Session = Depends(get_db)):
    references = search_knowledge_documents(db, payload.instruction, limit=payload.limit)
    if not references:
        raise HTTPException(status_code=400, detail="知识库暂无可用文档，请先上传材料")

    try:
        result = draft_document_with_knowledge(
            instruction=payload.instruction,
            knowledge_references=references,
            summary_length=payload.summaryLength,
        )
    except AgentConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    context = build_knowledge_context(references)
    return {
        "message": "ok",
        "provider": "deepseek",
        "model": result["model"],
        "usage": result["usage"],
        "summaryLength": payload.summaryLength,
        "source": {
            "fileName": "云矩知识库",
            "fileType": "knowledge",
            "originalChars": sum(int(item.get("sourceChars") or 0) for item in references),
            "usedChars": len(context),
            "truncated": False,
        },
        "knowledgeReferences": references,
        "summary": result["text"],
    }


@router.post("/export-summary-docx")
def export_summary_docx_api(payload: SummaryDocxExportRequest, db: Session = Depends(get_db)):
    template_rules = None
    if payload.topicTemplateId:
        template = db.query(TopicTemplate).filter(TopicTemplate.id == payload.topicTemplateId).first()
        if not template:
            raise HTTPException(status_code=400, detail="指定导出模板不存在")
        template_rules = template.rules if isinstance(template.rules, dict) else None

    output = build_summary_docx(
        title=payload.title,
        summary_text=payload.summary,
        source_file_name=payload.sourceFileName,
        template_rules=template_rules,
    )
    stamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    filename = f"{_safe_filename_stem(payload.title)}_{stamp}.docx"
    return StreamingResponse(
        iter([output]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=summary.docx; filename*=UTF-8''{quote(filename)}"},
    )
