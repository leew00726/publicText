from __future__ import annotations

import io
import json
import re
from collections import Counter
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - runtime dependency fallback
    PdfReader = None

RE_H1 = re.compile(r"^[一二三四五六七八九十百千]+、")
RE_H2 = re.compile(r"^（[一二三四五六七八九十百千]+）")
RE_H3 = re.compile(r"^\d+[\.．、]")
RE_H4 = re.compile(r"^（\d+）")
RE_SUFFIX_MARKER = re.compile(
    r"^(主\s*持(?:\s*人|\s*者)?|参\s*(?:加|会)(?:\s*人|\s*人员|\s*名单)?|列\s*席(?:\s*人|\s*人员)?|出\s*席(?:\s*人|\s*人员)?|记\s*录(?:\s*人|\s*员)?|发\s*(?:送|至|文)|主\s*送|抄\s*送|分\s*送)\s*[：:]"
)
RE_SEND_LINE = re.compile(r"^发\s*(?:送|至|文)\s*[：:]")
RE_HEADER_SIGNATORY = re.compile(r"签发人\s*[：:]")
RE_ZH_DATE = re.compile(r"\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日")


def _normalize_value(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 2)
    return value


def _resolve_line_spacing_pt(paragraph) -> float | None:
    line_spacing = paragraph.paragraph_format.line_spacing
    if line_spacing is None:
        return None
    if hasattr(line_spacing, "pt"):
        return float(line_spacing.pt)
    if isinstance(line_spacing, (int, float)):
        return float(line_spacing)
    return None


def _resolve_pt(value: Any) -> float | None:
    if value is None:
        return None
    if hasattr(value, "pt"):
        return float(value.pt)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _first_run_style(paragraph) -> tuple[str | None, float | None]:
    for run in paragraph.runs:
        text = (run.text or "").strip()
        if not text:
            continue
        font_name = run.font.name
        font_size = _resolve_pt(run.font.size)
        if font_name or font_size:
            return font_name, font_size

    style = paragraph.style
    if style is None or style.font is None:
        return None, None
    return style.font.name, _resolve_pt(style.font.size)


def _detect_heading_level(paragraph) -> int | None:
    style_name = (paragraph.style.name if paragraph.style else "").strip().lower()
    if style_name.startswith("heading "):
        suffix = style_name.split("heading ", 1)[1]
        if suffix.isdigit():
            return int(suffix)
    if style_name.startswith("标题 "):
        suffix = style_name.split("标题 ", 1)[1]
        if suffix.isdigit():
            return int(suffix)
    return None


def _detect_heading_level_from_text(text: str) -> int | None:
    if RE_H1.match(text):
        return 1
    if RE_H2.match(text):
        return 2
    if RE_H3.match(text):
        return 3
    if RE_H4.match(text):
        return 4
    return None


def _make_text_node(text: str) -> dict[str, Any]:
    return {"type": "text", "text": text}


def _normalize_color_hex(value: str | None) -> str | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.startswith("#"):
        return raw.upper()
    return f"#{raw.upper()}"


def _resolve_text_align(paragraph) -> str | None:
    align = paragraph.alignment
    if align is None:
        return None
    if align == WD_ALIGN_PARAGRAPH.CENTER:
        return "center"
    if align == WD_ALIGN_PARAGRAPH.RIGHT:
        return "right"
    if align == WD_ALIGN_PARAGRAPH.JUSTIFY:
        return "justify"
    return "left"


def _extract_run_render_style(paragraph) -> dict[str, Any]:
    for run in paragraph.runs:
        text = (run.text or "").strip()
        if not text:
            continue

        color = None
        if run.font.color is not None and run.font.color.rgb is not None:
            color = _normalize_color_hex(str(run.font.color.rgb))

        bold = run.bold if run.bold is not None else run.font.bold
        style = {
            "fontFamily": run.font.name,
            "fontSizePt": _normalize_value(_resolve_pt(run.font.size)),
            "bold": bool(bold) if bold is not None else None,
            "colorHex": color,
        }
        return {k: v for k, v in style.items() if v is not None}

    style_font = paragraph.style.font if paragraph.style is not None and paragraph.style.font is not None else None
    if style_font is None:
        return {}
    style = {
        "fontFamily": style_font.name,
        "fontSizePt": _normalize_value(_resolve_pt(style_font.size)),
        "bold": bool(style_font.bold) if style_font.bold is not None else None,
        "colorHex": _normalize_color_hex(str(style_font.color.rgb)) if style_font.color and style_font.color.rgb else None,
    }
    return {k: v for k, v in style.items() if v is not None}


def _build_node_attrs(paragraph, run_style: dict[str, Any]) -> dict[str, Any]:
    attrs: dict[str, Any] = {}
    attrs.update(run_style)

    text_align = _resolve_text_align(paragraph)
    if text_align:
        attrs["textAlign"] = text_align

    line_spacing_pt = _normalize_value(_resolve_line_spacing_pt(paragraph))
    if line_spacing_pt is not None:
        attrs["lineSpacingPt"] = line_spacing_pt

    first_indent_pt = _normalize_value(_resolve_pt(paragraph.paragraph_format.first_line_indent))
    if first_indent_pt is not None:
        attrs["firstLineIndentPt"] = first_indent_pt
        font_size = run_style.get("fontSizePt")
        if isinstance(font_size, (int, float)) and font_size > 0:
            attrs["firstLineIndentChars"] = round(float(first_indent_pt) / float(font_size), 2)
    else:
        attrs["firstLineIndentChars"] = 0

    return attrs


def _make_paragraph_node(text: str, attrs: dict[str, Any]) -> dict[str, Any]:
    return {"type": "paragraph", "attrs": attrs, "content": [_make_text_node(text)]}


def _make_heading_node(level: int, text: str, attrs: dict[str, Any]) -> dict[str, Any]:
    merged_attrs = dict(attrs)
    merged_attrs["level"] = level
    return {"type": "heading", "attrs": merged_attrs, "content": [_make_text_node(text)]}


def _make_red_divider_node() -> dict[str, Any]:
    return {
        "type": "paragraph",
        "attrs": {
            "dividerRed": True,
            "textAlign": "left",
            "firstLineIndentChars": 0,
        },
        "content": [],
    }


def _node_text(node: dict[str, Any]) -> str:
    return "".join(part.get("text", "") for part in (node.get("content") or []) if isinstance(part, dict))


def _looks_like_header_meta_line(text: str) -> bool:
    value = (text or "").replace("\u00A0", " ").strip()
    if not value:
        return False

    if RE_HEADER_SIGNATORY.search(value):
        return True

    if RE_ZH_DATE.search(value) and (value.endswith("：") or value.endswith(":")):
        return True

    return False


def _looks_like_body_start(node: dict[str, Any]) -> bool:
    if node.get("type") == "heading":
        return True

    text = _node_text(node).strip()
    if not text:
        return False
    if _looks_like_header_meta_line(text):
        return False
    if RE_SUFFIX_MARKER.match(text):
        return False
    if _detect_heading_level_from_text(text) is not None:
        return True
    if len(text) >= 20 and (text.endswith("：") or text.endswith(":")):
        return True
    if len(text) >= 10 and ("。" in text or "！" in text or "？" in text):
        return True
    if len(text) >= 16 and "，" in text:
        return True
    return False


def _locate_content_template_bounds(nodes: list[dict[str, Any]]) -> tuple[int, int | None]:
    suffix_start: int | None = None
    search_from = max(0, len(nodes) - 20)
    for idx in range(search_from, len(nodes)):
        text = _node_text(nodes[idx]).strip()
        if RE_SUFFIX_MARKER.match(text):
            suffix_start = idx
            break

    prefix_cut = 0
    found_body_start = False
    for idx, node in enumerate(nodes):
        if _looks_like_body_start(node):
            prefix_cut = idx
            found_body_start = True
            break

    used_suffix_fallback = False
    if not found_body_start:
        # 回退策略：当正文未被解析到（如正文落在文本框）时，至少保留尾部名单前的固定前置区块。
        if suffix_start is not None and suffix_start > 0:
            prefix_cut = suffix_start
            used_suffix_fallback = True
        else:
            prefix_cut = 0

    if suffix_start is not None and suffix_start <= prefix_cut and not used_suffix_fallback:
        suffix_start = None

    return prefix_cut, suffix_start


def _extract_content_template_from_nodes(nodes: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not nodes:
        return None

    prefix_cut, suffix_start = _locate_content_template_bounds(nodes)

    leading_nodes = [node for node in nodes[:prefix_cut] if isinstance(node, dict)]
    if len(leading_nodes) > 20:
        leading_nodes = leading_nodes[:20]
    leading_nodes = _ensure_signatory_divider(leading_nodes)

    trailing_nodes: list[dict[str, Any]] = []
    if suffix_start is not None:
        trailing_nodes = [node for node in nodes[suffix_start:] if isinstance(node, dict)]
        if len(trailing_nodes) > 20:
            trailing_nodes = trailing_nodes[-20:]
        trailing_nodes = _ensure_suffix_dividers(trailing_nodes)

    if not leading_nodes and not trailing_nodes:
        return None

    return {
        "leadingNodes": leading_nodes,
        "trailingNodes": trailing_nodes,
        "bodyPlaceholder": "（请在此输入正文）",
    }


def _ensure_signatory_divider(leading_nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not leading_nodes:
        return leading_nodes

    for node in leading_nodes:
        attrs = node.get("attrs") if isinstance(node, dict) else None
        if isinstance(attrs, dict) and attrs.get("dividerRed"):
            return leading_nodes

    signatory_index: int | None = None
    for idx, node in enumerate(leading_nodes):
        if not isinstance(node, dict):
            continue
        text = _node_text(node).replace("\u00A0", " ").strip()
        if RE_HEADER_SIGNATORY.search(text):
            signatory_index = idx
            break

    if signatory_index is None:
        return leading_nodes

    next_nodes = leading_nodes[signatory_index + 1 : signatory_index + 3]
    for node in next_nodes:
        text = _node_text(node).strip()
        if re.fullmatch(r"[-—_]{6,}", text):
            return leading_nodes

    return [
        *leading_nodes[: signatory_index + 1],
        _make_red_divider_node(),
        *leading_nodes[signatory_index + 1 :],
    ]


def _is_divider_node(node: dict[str, Any]) -> bool:
    attrs = node.get("attrs")
    if isinstance(attrs, dict) and attrs.get("dividerRed"):
        return True
    text = _node_text(node).strip()
    return bool(re.fullmatch(r"[-—_]{6,}", text))


def _ensure_suffix_dividers(trailing_nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not trailing_nodes:
        return trailing_nodes

    result = list(trailing_nodes)
    send_index: int | None = None
    for idx, node in enumerate(result):
        if not isinstance(node, dict):
            continue
        text = _node_text(node).replace("\u00A0", " ").strip()
        if RE_SEND_LINE.match(text):
            send_index = idx
            break

    if send_index is None:
        return result

    if send_index > 0:
        prev = result[send_index - 1]
        if isinstance(prev, dict) and not _is_divider_node(prev):
            result.insert(send_index, _make_red_divider_node())
            send_index += 1

    if send_index + 1 < len(result):
        next_node = result[send_index + 1]
        if isinstance(next_node, dict) and not _is_divider_node(next_node):
            result.insert(send_index + 1, _make_red_divider_node())
    else:
        result.append(_make_red_divider_node())

    return result


def _normalize_suffix_line_node(node: dict[str, Any], body_style: dict[str, Any], force: bool = False) -> dict[str, Any]:
    if node.get("type") not in {"paragraph", "heading"}:
        return node
    text = _node_text(node).strip()
    if not force and not RE_SUFFIX_MARKER.match(text):
        return node

    attrs = node.get("attrs")
    next_attrs = dict(attrs) if isinstance(attrs, dict) else {}

    body_font = body_style.get("fontFamily")
    if isinstance(body_font, str) and body_font.strip():
        next_attrs["fontFamily"] = body_font.strip()

    body_size = body_style.get("fontSizePt")
    if isinstance(body_size, (int, float)):
        next_attrs["fontSizePt"] = _normalize_value(float(body_size))

    body_line = body_style.get("lineSpacingPt")
    if isinstance(body_line, (int, float)):
        next_attrs["lineSpacingPt"] = _normalize_value(float(body_line))

    body_indent_pt = body_style.get("firstLineIndentPt")
    body_indent_chars = body_style.get("firstLineIndentChars")
    if isinstance(body_indent_pt, (int, float)):
        next_attrs["firstLineIndentPt"] = _normalize_value(float(body_indent_pt))
        next_attrs.pop("firstLineIndentChars", None)
    elif isinstance(body_indent_chars, (int, float)):
        next_attrs["firstLineIndentChars"] = _normalize_value(float(body_indent_chars))
        next_attrs.pop("firstLineIndentPt", None)

    next_attrs["textAlign"] = "left"
    next_attrs["bold"] = False
    node["attrs"] = next_attrs
    return node


def _normalize_content_template_suffix_styles(rules: dict[str, Any]) -> None:
    content_template = rules.get("contentTemplate")
    if not isinstance(content_template, dict):
        return

    trailing_nodes = content_template.get("trailingNodes")
    if not isinstance(trailing_nodes, list):
        return

    body_style = rules.get("body") if isinstance(rules.get("body"), dict) else {}
    if not body_style:
        return

    normalized_nodes: list[dict[str, Any]] = []
    in_suffix_block = False
    for node in trailing_nodes:
        if not isinstance(node, dict):
            continue
        node_copy = dict(node)
        text = _node_text(node_copy).strip()
        if RE_SUFFIX_MARKER.match(text):
            in_suffix_block = True
        if in_suffix_block and text:
            normalized_nodes.append(_normalize_suffix_line_node(node_copy, body_style, force=True))
        else:
            normalized_nodes.append(node_copy)
    content_template["trailingNodes"] = normalized_nodes


def extract_docx_features(data: bytes) -> dict[str, Any]:
    doc = Document(io.BytesIO(data))

    body_samples: list[dict[str, Any]] = []
    heading_samples: dict[int, list[dict[str, Any]]] = {}
    template_nodes: list[dict[str, Any]] = []
    paragraph_entries: list[dict[str, Any]] = []

    for paragraph in doc.paragraphs:
        text = (paragraph.text or "").strip()
        if not text:
            continue

        font_name, font_size = _first_run_style(paragraph)
        run_style = _extract_run_render_style(paragraph)
        node_attrs = _build_node_attrs(paragraph, run_style)
        sample = {
            "fontFamily": font_name,
            "fontSizePt": _normalize_value(font_size),
            "lineSpacingPt": _normalize_value(_resolve_line_spacing_pt(paragraph)),
            "spaceBeforePt": _normalize_value(_resolve_pt(paragraph.paragraph_format.space_before)),
            "spaceAfterPt": _normalize_value(_resolve_pt(paragraph.paragraph_format.space_after)),
            "firstLineIndentPt": _normalize_value(_resolve_pt(paragraph.paragraph_format.first_line_indent)),
        }

        level = _detect_heading_level(paragraph)
        if level is None:
            level = _detect_heading_level_from_text(text)

        if level is not None and 1 <= level <= 4:
            template_nodes.append(_make_heading_node(level, text, node_attrs))
            paragraph_entries.append({"level": level, "sample": sample})
        else:
            template_nodes.append(_make_paragraph_node(text, node_attrs))
            paragraph_entries.append({"level": None, "sample": sample})

    prefix_cut, suffix_start = _locate_content_template_bounds(template_nodes)
    excluded_body_indexes = set(range(0, prefix_cut))
    if suffix_start is not None:
        excluded_body_indexes.update(range(suffix_start, len(template_nodes)))

    fallback_body_samples: list[dict[str, Any]] = []
    for idx, entry in enumerate(paragraph_entries):
        level = entry.get("level")
        sample = entry.get("sample")
        if not isinstance(sample, dict):
            continue
        if isinstance(level, int) and 1 <= level <= 4:
            heading_samples.setdefault(level, []).append(sample)
            continue

        fallback_body_samples.append(sample)
        if idx not in excluded_body_indexes:
            body_samples.append(sample)

    if not body_samples:
        body_samples = fallback_body_samples

    section = doc.sections[0]
    margins = {
        "top": round(section.top_margin.cm, 2),
        "bottom": round(section.bottom_margin.cm, 2),
        "left": round(section.left_margin.cm, 2),
        "right": round(section.right_margin.cm, 2),
    }

    body = _summarize_samples(body_samples) if body_samples else {}
    headings = {f"level{level}": _summarize_samples(samples) for level, samples in heading_samples.items()}
    result = {"body": body, "headings": headings, "page": {"marginsCm": margins}}
    content_template = _extract_content_template_from_nodes(template_nodes)
    if content_template:
        result["contentTemplate"] = content_template
    return result


def _normalize_pdf_font_name(raw_name: Any) -> str | None:
    if raw_name is None:
        return None
    value = str(raw_name).strip()
    if not value:
        return None
    if value.startswith("/"):
        value = value[1:]
    if "+" in value:
        value = value.split("+", 1)[1]
    return value or None


def extract_pdf_features(data: bytes) -> dict[str, Any]:
    if PdfReader is None:
        raise ValueError("当前环境缺少 PDF 解析依赖，请安装 pypdf。")

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:  # pragma: no cover - parser dependent
        raise ValueError("PDF 解析失败，请确认文件未损坏。") from exc

    body_samples: list[dict[str, Any]] = []
    text_parts: list[str] = []

    for page in reader.pages:
        page_has_visitor = {"called": False}

        def visitor_text(text, _cm, _tm, font_dict, font_size):
            page_has_visitor["called"] = True
            text_value = (text or "").strip()
            if not text_value:
                return
            text_parts.append(text_value)
            sample = {
                "fontFamily": _normalize_pdf_font_name((font_dict or {}).get("/BaseFont") if isinstance(font_dict, dict) else None),
                "fontSizePt": _normalize_value(font_size if isinstance(font_size, (int, float)) else None),
            }
            if sample["fontFamily"] is not None or sample["fontSizePt"] is not None:
                body_samples.append(sample)

        try:
            text = page.extract_text(visitor_text=visitor_text)
            if isinstance(text, str) and text.strip():
                text_parts.append(text.strip())
        except TypeError:
            text = page.extract_text()
            if isinstance(text, str) and text.strip():
                text_parts.append(text.strip())
        except Exception as exc:  # pragma: no cover - parser dependent
            raise ValueError("PDF 文本提取失败，请尝试转换为 DOCX 后再训练。") from exc

        if not page_has_visitor["called"] and not text_parts:
            fallback = page.extract_text()
            if isinstance(fallback, str) and fallback.strip():
                text_parts.append(fallback.strip())

    if not "".join(text_parts).strip():
        raise ValueError("未能从 PDF 提取到正文文本，可能是扫描件。请先 OCR 或上传 DOCX。")

    body = _summarize_samples(body_samples) if body_samples else {}
    return {"body": body, "headings": {}, "page": {"marginsCm": {}}}


def _summarize_samples(samples: list[dict[str, Any]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    if not samples:
        return summary

    keys = set().union(*(sample.keys() for sample in samples))
    for key in keys:
        values = [_normalize_value(sample.get(key)) for sample in samples if sample.get(key) is not None]
        if not values:
            continue
        summary[key] = Counter(values).most_common(1)[0][0]
    return summary


def _read_path(data: dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _mode_with_confidence(values: list[Any]) -> tuple[Any, float]:
    normalized = [_normalize_value(v) for v in values if v is not None]
    if not normalized:
        return None, 0.0
    counter = Counter(normalized)
    value, count = counter.most_common(1)[0]
    return value, count / len(normalized)


def infer_topic_rules(features_list: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    if not features_list:
        raise ValueError("features_list is empty")

    rule_paths = [
        "body.fontFamily",
        "body.fontSizePt",
        "body.lineSpacingPt",
        "body.spaceBeforePt",
        "body.spaceAfterPt",
        "body.firstLineIndentPt",
        "page.marginsCm.top",
        "page.marginsCm.bottom",
        "page.marginsCm.left",
        "page.marginsCm.right",
        "headings.level1.fontFamily",
        "headings.level1.fontSizePt",
        "headings.level2.fontFamily",
        "headings.level2.fontSizePt",
        "headings.level3.fontFamily",
        "headings.level3.fontSizePt",
        "headings.level4.fontFamily",
        "headings.level4.fontSizePt",
    ]

    rules: dict[str, Any] = {"body": {}, "headings": {}, "page": {"marginsCm": {}}}
    confidence_report: dict[str, Any] = {}

    for path in rule_paths:
        values = [_read_path(feature, path) for feature in features_list]
        chosen, confidence = _mode_with_confidence(values)
        if chosen is None:
            continue

        confidence_report[path] = {"confidence": round(confidence, 4), "samples": len([v for v in values if v is not None])}

        parts = path.split(".")
        cursor = rules
        for part in parts[:-1]:
            cursor = cursor.setdefault(part, {})
        cursor[parts[-1]] = chosen

    template_candidates: list[tuple[str, dict[str, Any]]] = []
    for feature in features_list:
        template = feature.get("contentTemplate")
        if not isinstance(template, dict):
            continue
        try:
            key = json.dumps(template, ensure_ascii=False, sort_keys=True)
        except TypeError:
            continue
        template_candidates.append((key, template))

    if template_candidates:
        key_counter = Counter(key for key, _ in template_candidates)
        selected_key, selected_count = key_counter.most_common(1)[0]
        selected_template = next(template for key, template in template_candidates if key == selected_key)
        rules["contentTemplate"] = selected_template
        confidence_report["contentTemplate"] = {
            "confidence": round(selected_count / len(template_candidates), 4),
            "samples": len(template_candidates),
        }

    _normalize_content_template_suffix_styles(rules)
    return rules, confidence_report
