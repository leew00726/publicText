import re
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.ai_agent import (
    AgentConfigError,
    AgentUpstreamError,
    rewrite_with_deepseek,
    summarize_document_with_deepseek,
)
from app.services.document_summary import build_summary_docx, extract_text_from_uploaded_file

router = APIRouter(prefix="/api/ai", tags=["ai"])


class RewriteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    mode: Literal["formal", "concise", "polish"] = "formal"


class SummaryDocxExportRequest(BaseModel):
    title: str = Field(default="公文总结", min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=20000)
    sourceFileName: str | None = Field(default=None, max_length=255)


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
    file: UploadFile = File(...),
    summaryLength: Literal["short", "medium", "long"] = Form(default="medium"),
    extraInstruction: str | None = Form(default=None),
):
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


@router.post("/export-summary-docx")
def export_summary_docx_api(payload: SummaryDocxExportRequest):
    output = build_summary_docx(
        title=payload.title,
        summary_text=payload.summary,
        source_file_name=payload.sourceFileName,
    )
    stamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    filename = f"{_safe_filename_stem(payload.title)}_{stamp}.docx"
    return StreamingResponse(
        iter([output]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=summary.docx; filename*=UTF-8''{quote(filename)}"},
    )
