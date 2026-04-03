from __future__ import annotations

import copy
import io
import json
import re
from collections import Counter
from difflib import SequenceMatcher
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
RE_DOC_ISSUE_LINE = re.compile(r"^(?:\d{4}\s*年第\s*[0-9一二三四五六七八九十百千]+\s*期|第\s*[0-9一二三四五六七八九十百千]+\s*期)$")
RE_SECRET_MARKER = re.compile(r"(秘密|机密|绝密|商密)")
RE_TITLE_KEYWORD = re.compile(
    r"(报告|纪要|请示|函|通知|方案|总结|通报|决定|公告|意见|办法|细则|规定|计划|说明|简报|要点|清单|材料)$"
)


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


def _looks_like_company_line(text: str) -> bool:
    value = (text or "").replace("\u00A0", " ").strip()
    if not value:
        return False
    return any(keyword in value for keyword in ["有限公司", "有限责任公司", "集团", "公司", "委员会", "办公室", "政府", "人民法院"])


def _looks_like_issue_line(text: str) -> bool:
    value = (text or "").replace("\u00A0", " ").strip()
    if not value:
        return False
    return bool(RE_DOC_ISSUE_LINE.match(value))


def _extract_title_rules_from_node(node: dict[str, Any]) -> dict[str, Any]:
    attrs = node.get("attrs")
    if not isinstance(attrs, dict):
        return {}

    allowed_keys = ["fontFamily", "fontSizePt", "bold", "colorHex", "textAlign", "lineSpacingPt"]
    result: dict[str, Any] = {}
    for key in allowed_keys:
        value = attrs.get(key)
        if value is not None:
            result[key] = value
    return result


def _match_title_candidate(leading_nodes: list[dict[str, Any]]) -> dict[str, Any] | None:
    best_candidate: dict[str, Any] | None = None
    best_score = float("-inf")

    for idx, node in enumerate(leading_nodes):
        if not isinstance(node, dict):
            continue
        if node.get("type") not in {"paragraph", "heading"}:
            continue

        text = _node_text(node).replace("\u00A0", " ").strip()
        if not text:
            continue
        if _looks_like_header_meta_line(text) or RE_SUFFIX_MARKER.match(text) or _looks_like_issue_line(text):
            continue
        if RE_SECRET_MARKER.search(text):
            continue

        attrs = node.get("attrs") if isinstance(node.get("attrs"), dict) else {}
        font_size = attrs.get("fontSizePt")
        font_size_num = float(font_size) if isinstance(font_size, (int, float)) else 0.0

        score = 0.0
        if RE_TITLE_KEYWORD.search(text):
            score += 6
        if str(attrs.get("textAlign") or "").strip().lower() == "center":
            score += 2
        if font_size_num:
            score += min(font_size_num / 10, 3)
        if _looks_like_company_line(text):
            score -= 5
        if len(text) < 4:
            score -= 3
        if len(text) > 40:
            score -= 2

        if score > best_score:
            best_score = score
            best_candidate = {
                "insertIndex": idx,
                "text": text,
                "node": node,
                "rules": _extract_title_rules_from_node(node),
            }

    if best_score <= 0 or not best_candidate:
        return None
    return best_candidate


def _extract_title_candidate_from_content_template(content_template: dict[str, Any]) -> dict[str, Any] | None:
    leading_nodes = content_template.get("leadingNodes")
    if not isinstance(leading_nodes, list) or not leading_nodes:
        return None

    matched = _match_title_candidate([node for node in leading_nodes if isinstance(node, dict)])
    if not matched:
        return None

    insert_index = int(matched["insertIndex"])
    stripped_leading_nodes = [node for idx, node in enumerate(leading_nodes) if idx != insert_index]
    content_template["leadingNodes"] = stripped_leading_nodes
    content_template["titleMode"] = "dynamic"
    return matched


def _normalize_title_similarity_text(text: str) -> str:
    return re.sub(r"\s+", "", (text or "").strip())


def _titles_are_similar_enough(title_texts: list[str], threshold: float = 0.9) -> bool:
    normalized = [_normalize_title_similarity_text(text) for text in title_texts if _normalize_title_similarity_text(text)]
    if len(normalized) < 2:
        return False

    for idx, left in enumerate(normalized):
        for right in normalized[idx + 1 :]:
            if SequenceMatcher(a=left, b=right).ratio() < threshold:
                return False
    return True


def _titles_match_exactly(title_texts: list[str]) -> bool:
    normalized = [_normalize_title_similarity_text(text) for text in title_texts if _normalize_title_similarity_text(text)]
    return len(normalized) >= 2 and len(set(normalized)) == 1


def _tokenize_title_text(text: str) -> list[str]:
    normalized = _normalize_title_similarity_text(text)
    if not normalized:
        return []
    return re.findall(r"\d+|[A-Za-z]+|[\u4e00-\u9fff]|[^\w\s]", normalized)


def _build_title_template_text(title_texts: list[str]) -> str | None:
    tokenized_titles = [_tokenize_title_text(text) for text in title_texts if _normalize_title_similarity_text(text)]
    if len(tokenized_titles) < 2 or not tokenized_titles[0]:
        return None

    first_tokens = tokenized_titles[0]
    token_is_variable = [False] * len(first_tokens)
    gap_has_variable = [False] * (len(first_tokens) + 1)

    for other_tokens in tokenized_titles[1:]:
        matcher = SequenceMatcher(a=first_tokens, b=other_tokens)
        for tag, a1, a2, _b1, _b2 in matcher.get_opcodes():
            if tag == "equal":
                continue
            if tag == "insert":
                gap_has_variable[a1] = True
                continue
            for idx in range(a1, a2):
                token_is_variable[idx] = True

    template_parts: list[str] = []
    placeholder_index = 1

    def append_placeholder() -> None:
        nonlocal placeholder_index
        if template_parts and re.fullmatch(r"\{\{变量\d+\}\}", template_parts[-1]):
            return
        template_parts.append(f"{{{{变量{placeholder_index}}}}}")
        placeholder_index += 1

    idx = 0
    while idx < len(first_tokens):
        if gap_has_variable[idx]:
            append_placeholder()
        if token_is_variable[idx]:
            while idx < len(first_tokens) and token_is_variable[idx]:
                idx += 1
            append_placeholder()
            continue
        template_parts.append(first_tokens[idx])
        idx += 1

    if gap_has_variable[len(first_tokens)]:
        append_placeholder()

    template_text = "".join(template_parts)
    if not template_text or "{{变量" not in template_text:
        return None
    if re.fullmatch(r"\{\{变量\d+\}\}", template_text):
        return None
    return template_text


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
    if _looks_like_issue_line(text):
        return False
    if _detect_heading_level_from_text(text) is not None:
        return True
    if len(text) >= 6 and ("。" in text or "！" in text or "？" in text):
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
    title_candidate = None
    if content_template:
        title_candidate = _extract_title_candidate_from_content_template(content_template)
        if title_candidate and title_candidate.get("rules"):
            result["title"] = title_candidate["rules"]
        result["contentTemplate"] = content_template
    if title_candidate:
        result["_titleCandidate"] = {
            "insertIndex": title_candidate["insertIndex"],
            "text": title_candidate["text"],
            "node": copy.deepcopy(title_candidate["node"]),
        }
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
        "title.fontFamily",
        "title.fontSizePt",
        "title.bold",
        "title.colorHex",
        "title.textAlign",
        "title.lineSpacingPt",
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

    rules: dict[str, Any] = {"title": {}, "body": {}, "headings": {}, "page": {"marginsCm": {}}}
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

    selected_template: dict[str, Any] | None = None
    if template_candidates:
        key_counter = Counter(key for key, _ in template_candidates)
        selected_key, selected_count = key_counter.most_common(1)[0]
        selected_template = copy.deepcopy(next(template for key, template in template_candidates if key == selected_key))
        confidence_report["contentTemplate"] = {
            "confidence": round(selected_count / len(template_candidates), 4),
            "samples": len(template_candidates),
        }

    title_candidates = [
        candidate
        for candidate in (feature.get("_titleCandidate") for feature in features_list)
        if isinstance(candidate, dict) and isinstance(candidate.get("node"), dict) and isinstance(candidate.get("text"), str)
    ]
    title_texts = [str(candidate.get("text") or "") for candidate in title_candidates]
    fixed_title_enabled = _titles_match_exactly(title_texts)
    if fixed_title_enabled and title_candidates:
        selected_title = title_candidates[0]
        selected_template = selected_template or {
            "leadingNodes": [],
            "trailingNodes": [],
            "bodyPlaceholder": "（请在此输入正文）",
        }
        leading_nodes = selected_template.get("leadingNodes")
        if not isinstance(leading_nodes, list):
            leading_nodes = []
        insert_index = int(selected_title.get("insertIndex") or 0)
        insert_index = max(0, min(insert_index, len(leading_nodes)))
        leading_nodes.insert(insert_index, copy.deepcopy(selected_title["node"]))
        selected_template["leadingNodes"] = leading_nodes
        selected_template["titleMode"] = "fixed"
    elif selected_template:
        selected_template["titleMode"] = "dynamic"

    title_template_text = _build_title_template_text(title_texts)
    if title_template_text:
        rules.setdefault("title", {})["templateText"] = title_template_text

    if selected_template and (
        (isinstance(selected_template.get("leadingNodes"), list) and selected_template.get("leadingNodes"))
        or (isinstance(selected_template.get("trailingNodes"), list) and selected_template.get("trailingNodes"))
    ):
        rules["contentTemplate"] = selected_template

    _normalize_content_template_suffix_styles(rules)
    return rules, confidence_report
