from __future__ import annotations

import io
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from docx import Document
from pypdf import PdfReader

SUPPORTED_EXTENSIONS = {".docx", ".pdf", ".txt"}


def _normalize_text(raw_text: str) -> str:
    text = (raw_text or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in text.split("\n")]

    normalized: list[str] = []
    last_blank = False
    for line in lines:
        if line:
            normalized.append(line)
            last_blank = False
            continue
        if not last_blank:
            normalized.append("")
        last_blank = True

    return "\n".join(normalized).strip()


def _extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))

    chunks: list[str] = []
    for paragraph in doc.paragraphs:
        value = (paragraph.text or "").strip()
        if value:
            chunks.append(value)

    for table in doc.tables:
        for row in table.rows:
            cells = []
            for cell in row.cells:
                cell_text = "\n".join(p.text.strip() for p in cell.paragraphs if p.text.strip())
                if cell_text:
                    cells.append(cell_text)
            if cells:
                chunks.append(" | ".join(cells))

    return "\n".join(chunks)


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    chunks: list[str] = []
    for page in reader.pages:
        value = (page.extract_text() or "").strip()
        if value:
            chunks.append(value)
    return "\n".join(chunks)


def _extract_text_from_txt(file_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="ignore")


def extract_text_from_uploaded_file(file_name: str, file_bytes: bytes, max_chars: int = 12000) -> dict[str, Any]:
    ext = Path(file_name or "").suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError("仅支持 DOCX、PDF、TXT 文件")

    if ext == ".docx":
        raw_text = _extract_text_from_docx(file_bytes)
    elif ext == ".pdf":
        raw_text = _extract_text_from_pdf(file_bytes)
    else:
        raw_text = _extract_text_from_txt(file_bytes)

    normalized = _normalize_text(raw_text)
    if not normalized:
        raise ValueError("文档内容为空，无法生成总结")

    original_chars = len(normalized)
    truncated = original_chars > max_chars
    text = normalized[:max_chars] if truncated else normalized

    return {
        "text": text,
        "truncated": truncated,
        "originalChars": original_chars,
        "usedChars": len(text),
        "fileType": ext.replace(".", ""),
    }


def build_summary_docx(title: str, summary_text: str, source_file_name: str | None = None, generated_at: datetime | None = None) -> bytes:
    doc = Document()
    actual_title = (title or "").strip() or "公文总结"
    doc.add_heading(actual_title, level=0)

    now = generated_at or datetime.now(UTC)
    meta_line = f"生成时间：{now.strftime('%Y-%m-%d %H:%M:%S')} UTC"
    if source_file_name:
        meta_line = f"来源文件：{source_file_name}    {meta_line}"
    doc.add_paragraph(meta_line)
    doc.add_paragraph("")

    lines = summary_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    wrote = False
    for line in lines:
        value = line.strip()
        if not value:
            continue
        doc.add_paragraph(value)
        wrote = True

    if not wrote:
        doc.add_paragraph("（无总结内容）")

    stream = io.BytesIO()
    doc.save(stream)
    return stream.getvalue()
