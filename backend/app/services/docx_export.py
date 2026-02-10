from __future__ import annotations

import io
import os
import re
from collections import defaultdict
from typing import Any

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from app.services.checker import normalize_doc_no_brackets


def _set_run_font(run, family: str, size_pt: float, bold: bool = False, color_hex: str | None = None):
    run.font.name = family
    run._element.rPr.rFonts.set(qn("w:eastAsia"), family)
    run.font.size = Pt(size_pt)
    run.bold = bold
    if color_hex:
        hex_color = color_hex.replace("#", "")
        if len(hex_color) == 6:
            run.font.color.rgb = RGBColor.from_string(hex_color)


def _insert_page_number(paragraph):
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")

    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"

    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")

    run = paragraph.add_run()
    run._r.append(fld_begin)
    run._r.append(instr_text)
    run._r.append(fld_end)


def _add_paragraph_border(paragraph, color: str = "D40000", size_eighth_point: int = 12):
    p = paragraph._p
    pPr = p.get_or_add_pPr()
    pbdr = pPr.find(qn("w:pBdr"))
    if pbdr is None:
        pbdr = OxmlElement("w:pBdr")
        pPr.append(pbdr)
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size_eighth_point))
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), color.replace("#", ""))
    pbdr.append(bottom)


def _node_text(node: dict[str, Any]) -> str:
    if not node:
        return ""
    if node.get("type") == "text":
        return node.get("text", "")
    return "".join(_node_text(c) for c in (node.get("content") or []))


def _strip_attachment_ext(name: str) -> str:
    return os.path.splitext(name)[0]


def _format_zh_date(date_text: str) -> str:
    value = (date_text or "").strip()
    if not value:
        return ""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", value)
    if not m:
        return value
    year = int(m.group(1))
    month = int(m.group(2))
    day = int(m.group(3))
    return f"{year}年{month}月{day}日"


def _extract_bind_map(structured_fields: dict[str, Any], unit_name: str) -> dict[str, str]:
    return {
        "unitName": unit_name,
        "docNo": normalize_doc_no_brackets(structured_fields.get("docNo", "")),
        "signatory": structured_fields.get("signatory", ""),
        "copyNo": structured_fields.get("copyNo", ""),
        "fixedText": "",
    }


def _group_elements_by_y(elements: list[dict[str, Any]], tolerance: float = 0.05) -> list[list[dict[str, Any]]]:
    enabled = [e for e in elements if e.get("enabled", True)]
    enabled.sort(key=lambda x: float(x.get("yCm", 0)))

    groups: list[list[dict[str, Any]]] = []
    for elem in enabled:
        y = float(elem.get("yCm", 0))
        if not groups:
            groups.append([elem])
            continue
        prev_y = float(groups[-1][0].get("yCm", 0))
        if abs(y - prev_y) <= tolerance:
            groups[-1].append(elem)
        else:
            groups.append([elem])
    return groups


def _apply_header_template(doc: Document, template: dict[str, Any], structured_fields: dict[str, Any], unit_name: str):
    section = doc.sections[0]
    section.different_first_page_header_footer = True
    section.header_distance = Cm(0)

    header = section.first_page_header
    for p in list(header.paragraphs):
        p._element.getparent().remove(p._element)

    bind_map = _extract_bind_map(structured_fields, unit_name)
    groups = _group_elements_by_y(template.get("elements", []))
    content_width_cm = 21 - 2.7 - 2.5

    prev_y = 0.0
    prev_height = 0.0

    for group in groups:
        y_cm = float(group[0].get("yCm", 0))
        paragraph = header.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(0)
        delta = max(y_cm - (prev_y + prev_height), 0)
        paragraph.paragraph_format.space_before = Cm(delta)

        has_line = any(e.get("type") == "line" for e in group)
        text_elems = [e for e in group if e.get("type") == "text"]

        doc_no = next((e for e in text_elems if e.get("bind") == "docNo"), None)
        signatory = next((e for e in text_elems if e.get("bind") == "signatory"), None)

        if has_line and not text_elems:
            _add_paragraph_border(paragraph, color="D40000", size_eighth_point=12)
            paragraph.paragraph_format.space_before = Cm(delta)
            prev_height = 0.08
            prev_y = y_cm
            continue

        if doc_no and signatory:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
            tab_stops = paragraph.paragraph_format.tab_stops
            tab_stops.add_tab_stop(Cm(content_width_cm), WD_TAB_ALIGNMENT.RIGHT)
            left_text = bind_map.get("docNo", "")
            right_text = bind_map.get("signatory", "")
            r1 = paragraph.add_run(left_text)
            _set_run_font(r1, "仿宋_GB2312", 16)
            paragraph.add_run("\t")
            r2 = paragraph.add_run(right_text)
            _set_run_font(r2, "仿宋_GB2312", 16)
            prev_height = (16 / 72) * 2.54 * 1.2
            prev_y = y_cm
            continue

        for elem in text_elems:
            bind = elem.get("bind")
            value = elem.get("fixedText") if bind == "fixedText" else bind_map.get(bind, "")
            if not value and not elem.get("visibleIfEmpty", False):
                continue

            align = ((elem.get("text") or {}).get("align")) or "left"
            anchor = ((elem.get("x") or {}).get("anchor")) or "marginLeft"
            if align == "center" or anchor == "center":
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif align == "right" or anchor == "marginRight":
                paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            else:
                paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT

            font_conf = ((elem.get("text") or {}).get("font")) or {}
            family = font_conf.get("family", "仿宋_GB2312")
            size_pt = float(font_conf.get("sizePt", 16))
            bold = bool(font_conf.get("bold", False))
            color = font_conf.get("color", "#000000")

            run = paragraph.add_run(str(value))
            _set_run_font(run, family, size_pt, bold=bold, color_hex=color)
            prev_height = (size_pt / 72) * 2.54 * 1.2

        if has_line:
            _add_paragraph_border(paragraph, color="D40000", size_eighth_point=12)

        prev_y = y_cm


def _safe_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _resolve_topic_style_rules(structured_fields: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    rules = structured_fields.get("topicTemplateRules")
    if not isinstance(rules, dict):
        return {}, {}

    body = rules.get("body") if isinstance(rules.get("body"), dict) else {}
    headings = rules.get("headings") if isinstance(rules.get("headings"), dict) else {}
    return body, headings


def _apply_body_paragraph_style(paragraph, body_style: dict[str, Any]):
    paragraph.paragraph_format.line_spacing = Pt(_safe_float(body_style.get("lineSpacingPt"), 28))
    paragraph.paragraph_format.first_line_indent = Pt(_safe_float(body_style.get("firstLineIndentPt"), 32))
    paragraph.paragraph_format.space_before = Pt(_safe_float(body_style.get("spaceBeforePt"), 0))
    paragraph.paragraph_format.space_after = Pt(_safe_float(body_style.get("spaceAfterPt"), 0))


def _apply_heading_style(paragraph, level: int, heading_styles: dict[str, Any]):
    level_key = f"level{level}"
    level_style = heading_styles.get(level_key) if isinstance(heading_styles.get(level_key), dict) else {}

    paragraph.paragraph_format.line_spacing = Pt(_safe_float(level_style.get("lineSpacingPt"), 28))
    paragraph.paragraph_format.first_line_indent = Pt(_safe_float(level_style.get("firstLineIndentPt"), 32))
    paragraph.paragraph_format.space_before = Pt(_safe_float(level_style.get("spaceBeforePt"), 0))
    paragraph.paragraph_format.space_after = Pt(_safe_float(level_style.get("spaceAfterPt"), 0))

    default_style_map = {
        1: ("黑体", 16, False),
        2: ("黑体", 16, False),
        3: ("仿宋_GB2312", 16, False),
        4: ("仿宋_GB2312", 16, False),
    }
    default_family, default_size, default_bold = default_style_map.get(level, ("仿宋_GB2312", 16, False))

    family = level_style.get("fontFamily") or default_family
    size = _safe_float(level_style.get("fontSizePt"), default_size)
    bold = bool(level_style.get("bold", default_bold))
    return family, size, bold


def _iter_nodes(doc_json: dict[str, Any]) -> list[dict[str, Any]]:
    return list((doc_json or {}).get("content") or [])


def export_docx(
    document_data: dict[str, Any],
    unit_name: str,
    redhead_template: dict[str, Any],
    include_redhead: bool = True,
) -> bytes:
    doc = Document()
    section = doc.sections[0]

    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(3.7)
    section.bottom_margin = Cm(3.5)
    section.left_margin = Cm(2.7)
    section.right_margin = Cm(2.5)

    footer = section.footer
    footer_para = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _insert_page_number(footer_para)

    structured_fields = document_data.get("structuredFields", {})
    body_style, heading_styles = _resolve_topic_style_rules(structured_fields)
    if include_redhead:
        _apply_header_template(doc, redhead_template, structured_fields, unit_name)

    title = structured_fields.get("title") or document_data.get("title") or ""
    if title:
        p_title = doc.add_paragraph()
        p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_title.paragraph_format.line_spacing = Pt(28)
        run = p_title.add_run(title)
        _set_run_font(run, "方正小标宋简", 22)

    main_to = structured_fields.get("mainTo", "").strip()
    if main_to:
        p_main = doc.add_paragraph()
        p_main.paragraph_format.line_spacing = Pt(28)
        p_main.paragraph_format.first_line_indent = Pt(0)
        run = p_main.add_run(main_to)
        _set_run_font(run, "仿宋_GB2312", 16)

    for node in _iter_nodes(document_data.get("body", {})):
        ntype = node.get("type")

        if ntype == "heading":
            level = int((node.get("attrs") or {}).get("level", 1))
            p = doc.add_paragraph()
            family, size, bold = _apply_heading_style(p, level, heading_styles)
            text = _node_text(node)
            r = p.add_run(text)
            _set_run_font(r, family, size, bold)
            continue

        if ntype == "paragraph":
            p = doc.add_paragraph()
            _apply_body_paragraph_style(p, body_style)
            text = _node_text(node)
            r = p.add_run(text)
            _set_run_font(
                r,
                body_style.get("fontFamily", "仿宋_GB2312"),
                _safe_float(body_style.get("fontSizePt"), 16),
                bool(body_style.get("bold", False)),
            )
            continue

        if ntype == "table":
            rows = node.get("content") or []
            matrix: list[list[str]] = []
            for row in rows:
                row_cells = []
                for cell in (row.get("content") or []):
                    row_cells.append(_node_text(cell).strip())
                if row_cells:
                    matrix.append(row_cells)

            if not matrix:
                continue

            col_count = max(len(r) for r in matrix)
            table = doc.add_table(rows=len(matrix), cols=col_count)
            table.autofit = False
            for r_idx, row in enumerate(matrix):
                for c_idx in range(col_count):
                    value = row[c_idx] if c_idx < len(row) else ""
                    cell_para = table.cell(r_idx, c_idx).paragraphs[0]
                    cell_para.paragraph_format.line_spacing = Pt(28)
                    rr = cell_para.add_run(value)
                    _set_run_font(rr, "仿宋_GB2312", 16)

    sign_off = (structured_fields.get("signOff", "") or "").strip()
    date_text = _format_zh_date(structured_fields.get("date", ""))
    if sign_off or date_text:
        for _ in range(2):
            p_blank = doc.add_paragraph()
            p_blank.paragraph_format.line_spacing = Pt(28)
            p_blank.paragraph_format.first_line_indent = Pt(0)
            p_blank.paragraph_format.space_before = Pt(0)
            p_blank.paragraph_format.space_after = Pt(0)

        if sign_off:
            p_sign = doc.add_paragraph()
            p_sign.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_sign.paragraph_format.line_spacing = Pt(28)
            p_sign.paragraph_format.first_line_indent = Pt(0)
            r_sign = p_sign.add_run(sign_off)
            _set_run_font(r_sign, "仿宋_GB2312", 16)

        if date_text:
            p_date = doc.add_paragraph()
            p_date.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_date.paragraph_format.line_spacing = Pt(28)
            p_date.paragraph_format.first_line_indent = Pt(0)
            r_date = p_date.add_run(date_text)
            _set_run_font(r_date, "仿宋_GB2312", 16)

    attachments = structured_fields.get("attachments") or []
    if attachments:
        doc.add_paragraph("")
        attach_label = doc.add_paragraph()
        attach_label.paragraph_format.line_spacing = Pt(28)
        attach_label.paragraph_format.first_line_indent = Pt(32)
        r = attach_label.add_run("附件：")
        _set_run_font(r, "仿宋_GB2312", 16)

        for item in attachments:
            idx = item.get("index")
            name = _strip_attachment_ext(item.get("name", ""))
            p_attach = doc.add_paragraph()
            p_attach.paragraph_format.line_spacing = Pt(28)
            p_attach.paragraph_format.first_line_indent = Pt(32)
            rr = p_attach.add_run(f"{idx}. {name}")
            _set_run_font(rr, "仿宋_GB2312", 16)

        for item in attachments:
            doc.add_page_break()
            idx = item.get("index")
            title_text = _strip_attachment_ext(item.get("name", ""))

            p_mark = doc.add_paragraph()
            p_mark.paragraph_format.line_spacing = Pt(28)
            p_mark.paragraph_format.first_line_indent = Pt(0)
            r_mark = p_mark.add_run(f"附件{idx}")
            _set_run_font(r_mark, "黑体", 16)

            p_title = doc.add_paragraph()
            p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_title.paragraph_format.line_spacing = Pt(28)
            r_title = p_title.add_run(title_text)
            _set_run_font(r_title, "方正小标宋简", 22)

            p_body = doc.add_paragraph()
            _apply_body_paragraph_style(p_body)
            r_body = p_body.add_run("（附件正文请在此处编辑）")
            _set_run_font(r_body, "仿宋_GB2312", 16)

    stream = io.BytesIO()
    doc.save(stream)
    return stream.getvalue()
