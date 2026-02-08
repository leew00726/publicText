from __future__ import annotations

import io
import re
from typing import Any

from docx import Document

from app.services.checker import normalize_doc_no_brackets

RE_H1 = re.compile(r"^[一二三四五六七八九十百千]+、")
RE_H2 = re.compile(r"^（[一二三四五六七八九十百千]+）")
RE_H3 = re.compile(r"^\d+\.")
RE_H4 = re.compile(r"^（\d+）")


def _font_name(paragraph) -> str:
    for run in paragraph.runs:
        if run.font and run.font.name:
            return run.font.name
    return ""


def _looks_like_title_candidate(text: str) -> bool:
    return 4 <= len(text) <= 24 and not text.endswith("。")


def _detect_level(text: str, paragraph) -> int | None:
    if RE_H1.match(text):
        return 1
    if RE_H2.match(text):
        return 2
    if RE_H3.match(text):
        return 3
    if RE_H4.match(text):
        return 4

    font_name = _font_name(paragraph)
    if "黑体" in font_name:
        return 1
    if "楷体" in font_name:
        return 2
    if "仿宋" in font_name and _looks_like_title_candidate(text):
        return 3
    return None


def _make_text_node(text: str) -> dict[str, Any]:
    return {"type": "text", "text": text}


def _make_heading(level: int, text: str) -> dict[str, Any]:
    return {
        "type": "heading",
        "attrs": {"level": level},
        "content": [_make_text_node(text)],
    }


def _make_paragraph(text: str) -> dict[str, Any]:
    return {
        "type": "paragraph",
        "attrs": {"firstLineIndentChars": 2},
        "content": [_make_text_node(text)],
    }


def _table_to_node(table) -> dict[str, Any]:
    rows = []
    for row in table.rows:
        cells = []
        for cell in row.cells:
            cell_text = "\n".join(p.text.strip() for p in cell.paragraphs if p.text.strip())
            cells.append({"type": "tableCell", "content": [_make_text_node(cell_text)]})
        rows.append({"type": "tableRow", "content": cells})
    return {"type": "table", "content": rows}


def _parse_numbering_warning(headings: list[tuple[int, str]]) -> list[str]:
    warnings: list[str] = []

    expected = {1: 0, 2: 0, 3: 0, 4: 0}

    def zh_to_num(zh: str) -> int:
        m = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
        if zh == "十":
            return 10
        if zh.startswith("十"):
            return 10 + m.get(zh[1:], 0)
        if "十" in zh:
            left, _, right = zh.partition("十")
            return m.get(left, 0) * 10 + m.get(right, 0)
        return m.get(zh, 0)

    for i, (level, text) in enumerate(headings):
        for lv in range(level + 1, 5):
            expected[lv] = 0
        expected[level] += 1

        actual = None
        if level == 1:
            m = RE_H1.match(text)
            if m:
                actual = zh_to_num(m.group(0).replace("、", ""))
        elif level == 2:
            m = RE_H2.match(text)
            if m:
                actual = zh_to_num(m.group(0).replace("（", "").replace("）", ""))
        elif level == 3:
            m = RE_H3.match(text)
            if m:
                actual = int(m.group(0).replace(".", ""))
        else:
            m = RE_H4.match(text)
            if m:
                actual = int(m.group(0).replace("（", "").replace("）", ""))

        if actual is not None and actual != expected[level]:
            warnings.append(
                f"第{i+1}个标题编号疑似跳号/混用：层级 H{level} 当前 {actual}，期望 {expected[level]}"
            )

    return warnings


def import_docx(file_bytes: bytes) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    doc = Document(io.BytesIO(file_bytes))

    nodes: list[dict[str, Any]] = []
    unrecognized_title_count = 0
    headings: list[tuple[int, str]] = []
    table_warnings: list[str] = []

    for p in doc.paragraphs:
        text = (p.text or "").strip()
        if not text:
            continue

        level = _detect_level(text, p)
        if level:
            headings.append((level, text))
            nodes.append(_make_heading(level, text))
        else:
            nodes.append(_make_paragraph(text))
            if _looks_like_title_candidate(text):
                unrecognized_title_count += 1

    for idx, table in enumerate(doc.tables):
        try:
            nodes.append(_table_to_node(table))
        except Exception as exc:  # pragma: no cover
            table_warnings.append(f"表格 {idx+1} 解析失败: {exc}")

    body = {"type": "doc", "content": nodes}

    structured = {
        "title": "",
        "mainTo": "",
        "signOff": "",
        "docNo": "",
        "signatory": "",
        "copyNo": "",
        "date": "",
        "exportWithRedhead": True,
        "attachments": [],
    }

    # 从前几段尝试抽取文号并做括号归一
    for node in nodes[:8]:
        if node.get("type") in {"heading", "paragraph"}:
            t = node.get("content", [{}])[0].get("text", "")
            if re.search(r"\d{4}", t) and ("号" in t or "文" in t):
                structured["docNo"] = normalize_doc_no_brackets(t)
                break

    report = {
        "unrecognizedTitleCount": unrecognized_title_count,
        "numberingWarnings": _parse_numbering_warning(headings),
        "tableWarnings": table_warnings,
        "notes": [
            "导入时已忽略原 DOCX 页眉/红头（按系统红头模板重建）。",
            "已执行轻量套版：正文默认首行缩进2字。",
        ],
    }

    return body, structured, report
