from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.models import KnowledgeDocument


CJK_RE = re.compile(r"[\u4e00-\u9fff]+")
TOKEN_RE = re.compile(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]+")


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _query_terms(query: str) -> list[str]:
    tokens = TOKEN_RE.findall(query or "")
    terms: set[str] = set()
    for token in tokens:
        normalized = token.strip().lower()
        if not normalized:
            continue
        terms.add(normalized)
        if CJK_RE.fullmatch(token) and len(token) > 2:
            for size in (2, 3, 4):
                for index in range(0, max(len(token) - size + 1, 0)):
                    terms.add(token[index : index + size])

    return sorted(terms, key=lambda item: (-len(item), item))


def _score_document(row: KnowledgeDocument, terms: list[str]) -> int:
    if not terms:
        return 0

    title = (row.title or "").lower()
    body = (row.content_text or "").lower()
    score = 0
    for term in terms:
        if term in title:
            score += max(len(term) * 4, 6)
        if term in body:
            score += max(len(term), 2)
    return score


def _excerpt_for_terms(text: str, terms: list[str], max_chars: int) -> str:
    normalized = _normalize_text(text)
    if len(normalized) <= max_chars:
        return normalized

    lowered = normalized.lower()
    hit_index = -1
    for term in terms:
        hit_index = lowered.find(term.lower())
        if hit_index >= 0:
            break

    if hit_index < 0:
        return normalized[:max_chars].rstrip()

    prefix = max((max_chars - len(terms[0])) // 2, 0)
    start = max(hit_index - prefix, 0)
    end = min(start + max_chars, len(normalized))
    start = max(end - max_chars, 0)
    excerpt = normalized[start:end].strip()
    if start > 0:
        excerpt = f"...{excerpt}"
    if end < len(normalized):
        excerpt = f"{excerpt}..."
    return excerpt


def knowledge_document_to_out(row: KnowledgeDocument) -> dict[str, Any]:
    return {
        "id": row.id,
        "title": row.title,
        "fileName": row.file_name,
        "fileType": row.file_type,
        "excerpt": row.excerpt,
        "sourceChars": row.source_chars,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


def search_knowledge_documents(db: Session, query: str, limit: int = 5, max_excerpt_chars: int = 900) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 10)
    rows = db.query(KnowledgeDocument).order_by(KnowledgeDocument.updated_at.desc()).all()
    if not rows:
        return []

    terms = _query_terms(query)
    scored = [
        {
            "row": row,
            "score": _score_document(row, terms),
        }
        for row in rows
    ]
    scored.sort(key=lambda item: (item["score"], item["row"].updated_at), reverse=True)

    if terms and any(item["score"] > 0 for item in scored):
        selected = [item for item in scored if item["score"] > 0][:safe_limit]
    else:
        selected = scored[:safe_limit]

    references: list[dict[str, Any]] = []
    for item in selected:
        row = item["row"]
        references.append(
            {
                "id": row.id,
                "title": row.title,
                "fileName": row.file_name,
                "fileType": row.file_type,
                "excerpt": _excerpt_for_terms(row.content_text, terms, max_excerpt_chars),
                "sourceChars": row.source_chars,
                "score": item["score"],
            }
        )
    return references


def build_knowledge_context(references: list[dict[str, Any]], max_chars: int = 6000) -> str:
    chunks: list[str] = []
    used = 0
    for index, item in enumerate(references, start=1):
        chunk = (
            f"[{index}] 标题：{item.get('title') or '未命名材料'}\n"
            f"来源文件：{item.get('fileName') or ''}\n"
            f"参考片段：{item.get('excerpt') or ''}"
        ).strip()
        if not chunk:
            continue
        remaining = max_chars - used
        if remaining <= 0:
            break
        if len(chunk) > remaining:
            chunk = chunk[:remaining].rstrip()
        chunks.append(chunk)
        used += len(chunk)
    return "\n\n".join(chunks)
