from __future__ import annotations

import io
from collections import Counter
from typing import Any

from docx import Document


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


def extract_docx_features(data: bytes) -> dict[str, Any]:
    doc = Document(io.BytesIO(data))

    body_samples: list[dict[str, Any]] = []
    heading_samples: dict[int, list[dict[str, Any]]] = {}

    for paragraph in doc.paragraphs:
        text = (paragraph.text or "").strip()
        if not text:
            continue

        font_name, font_size = _first_run_style(paragraph)
        sample = {
            "fontFamily": font_name,
            "fontSizePt": _normalize_value(font_size),
            "lineSpacingPt": _normalize_value(_resolve_line_spacing_pt(paragraph)),
            "spaceBeforePt": _normalize_value(_resolve_pt(paragraph.paragraph_format.space_before)),
            "spaceAfterPt": _normalize_value(_resolve_pt(paragraph.paragraph_format.space_after)),
            "firstLineIndentPt": _normalize_value(_resolve_pt(paragraph.paragraph_format.first_line_indent)),
        }

        level = _detect_heading_level(paragraph)
        if level is not None and 1 <= level <= 4:
            heading_samples.setdefault(level, []).append(sample)
        else:
            body_samples.append(sample)

    section = doc.sections[0]
    margins = {
        "top": round(section.top_margin.cm, 2),
        "bottom": round(section.bottom_margin.cm, 2),
        "left": round(section.left_margin.cm, 2),
        "right": round(section.right_margin.cm, 2),
    }

    body = _summarize_samples(body_samples) if body_samples else {}
    headings = {f"level{level}": _summarize_samples(samples) for level, samples in heading_samples.items()}

    return {"body": body, "headings": headings, "page": {"marginsCm": margins}}


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

    return rules, confidence_report
