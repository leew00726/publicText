import re
from typing import Any

from app.schemas import CheckIssue
from app.services.template_rules import resolve_layout_spec

PUNCTUATION_END = "。！？；："


def _get_text(node: dict[str, Any]) -> str:
    if not node:
        return ""
    if node.get("type") == "text":
        return node.get("text", "")
    parts = []
    for child in node.get("content", []) or []:
        parts.append(_get_text(child))
    return "".join(parts)


def _strip_prefix(level: int, text: str) -> tuple[str | None, str]:
    patterns = {
        1: r"^([一二三四五六七八九十百千]+、)",
        2: r"^((?:（[一二三四五六七八九十百千]+）)|(?:\d+、))",
        3: r"^(\d+\.)",
        4: r"^(（\d+）)",
    }
    m = re.match(patterns[level], text)
    if not m:
        return None, text
    return m.group(1), text[m.end() :].strip()


def _num_to_zh(num: int) -> str:
    mapping = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九", 10: "十"}
    if num in mapping:
        return mapping[num]
    if num < 20:
        return "十" + mapping[num - 10]
    tens = num // 10
    rem = num % 10
    result = mapping.get(tens, str(tens)) + "十"
    if rem:
        result += mapping.get(rem, str(rem))
    return result


def _expected_prefix(level: int, counters: dict[int, int], current_prefix: str | None = None) -> str:
    if level == 1:
        return f"{_num_to_zh(counters[1])}、"
    if level == 2:
        if current_prefix and re.match(r"^\d+、$", current_prefix):
            return f"{counters[2]}、"
        return f"（{_num_to_zh(counters[2])}）"
    if level == 3:
        return f"{counters[3]}."
    return f"（{counters[4]}）"


def _style_issue(
    issues: list[CheckIssue],
    *,
    code: str,
    label: str,
    path: str,
    actual: Any,
    expected: Any,
) -> None:
    if actual is None or expected is None:
        return
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        matches = abs(float(actual) - float(expected)) < 0.01
    else:
        matches = str(actual).strip().lower() == str(expected).strip().lower()
    if matches:
        return
    issues.append(
        CheckIssue(
            code=code,
            type="A",
            message=f"{label}与模板不一致，当前 {actual}，模板要求 {expected}。",
            path=path,
            level="warning",
        )
    )


def check_document(
    body: dict[str, Any],
    structured_fields: dict[str, Any] | None = None,
    document_title: str | None = None,
) -> list[CheckIssue]:
    issues: list[CheckIssue] = []

    content = body.get("content", []) if isinstance(body, dict) else []
    structured_fields = structured_fields if isinstance(structured_fields, dict) else {}
    template_rules = structured_fields.get("topicTemplateRules")
    layout_spec = resolve_layout_spec(template_rules)
    body_rules = layout_spec["body"]
    heading_rules = layout_spec["headings"]
    content_template = template_rules.get("contentTemplate") if isinstance(template_rules, dict) else {}
    has_fixed_title = isinstance(content_template, dict) and content_template.get("titleMode") == "fixed"

    has_meaningful_content = any(
        node.get("type") == "table" or bool(_get_text(node).strip())
        for node in content
        if isinstance(node, dict)
    )
    if not has_meaningful_content:
        issues.append(
            CheckIssue(
                code="A_DOCUMENT_EMPTY",
                type="A",
                message="正文尚未填写。",
                path="body",
                level="error",
            )
        )

    structured_title = str(structured_fields.get("title") or "").strip()
    if not has_fixed_title and not structured_title:
        issues.append(
            CheckIssue(
                code="A_TITLE_EMPTY",
                type="A",
                message=f"公文主标题尚未填写（当前文档名称：{document_title or '未命名'}）。",
                path="structuredFields.title",
                level="error",
            )
        )

    counters = {1: 0, 2: 0, 3: 0, 4: 0}

    for idx, node in enumerate(content):
        node_type = node.get("type")
        path = f"body.content[{idx}]"

        if node_type not in {"paragraph", "heading", "table"}:
            issues.append(
                CheckIssue(
                    code="A_NODE_TYPE",
                    type="A",
                    message=f"不支持的节点类型: {node_type}",
                    path=path,
                    level="warning",
                )
            )
            continue

        if node_type == "heading":
            level = int((node.get("attrs") or {}).get("level", 1))
            if level < 1 or level > 4:
                issues.append(
                    CheckIssue(
                        code="B_LEVEL_RANGE",
                        type="B",
                        message="标题层级必须在 H1-H4 范围内。",
                        path=path,
                        level="error",
                    )
                )
                continue

            text = _get_text(node).strip()
            if not text:
                continue

            attrs = node.get("attrs") or {}
            expected_heading = heading_rules.get(f"level{level}") if isinstance(heading_rules, dict) else {}
            expected_heading = expected_heading if isinstance(expected_heading, dict) else {}
            for key, label in (
                ("fontFamily", "标题字体"),
                ("fontSizePt", "标题字号"),
                ("lineSpacingPt", "标题行距"),
                ("textAlign", "标题对齐方式"),
            ):
                _style_issue(
                    issues,
                    code=f"A_HEADING_{key.upper()}",
                    label=label,
                    path=f"{path}.attrs.{key}",
                    actual=attrs.get(key),
                    expected=expected_heading.get(key),
                )

            for deeper in range(level + 1, 5):
                counters[deeper] = 0
            counters[level] += 1

            prefix, remainder = _strip_prefix(level, text)
            expected = _expected_prefix(level, counters, prefix)
            if prefix and prefix != expected:
                issues.append(
                    CheckIssue(
                        code="B_NUMBERING",
                        type="B",
                        message=f"编号疑似异常，当前 {prefix}，期望 {expected}",
                        path=path,
                        level="warning",
                    )
                )

            tail_text = remainder if prefix else text
            if tail_text:
                ends_punc = tail_text[-1] in PUNCTUATION_END
                if level == 1 and ends_punc:
                    issues.append(
                        CheckIssue(
                            code="B_PUNC_H1",
                            type="B",
                            message="H1 句末不应有标点。",
                            path=path,
                            level="error",
                        )
                    )
                if level in {3, 4} and not ends_punc:
                    issues.append(
                        CheckIssue(
                            code=f"B_PUNC_H{level}",
                            type="B",
                            message=f"H{level} 句末必须有标点。",
                            path=path,
                            level="error",
                        )
                    )

        if node_type == "paragraph":
            attrs = node.get("attrs") or {}
            indent = attrs.get("firstLineIndentChars")
            if indent is not None and indent != 2:
                issues.append(
                    CheckIssue(
                        code="A_INDENT",
                        type="A",
                        message="正文首行应缩进2字。",
                        path=path,
                        level="warning",
                    )
                )
            if _get_text(node).strip():
                for key, label in (
                    ("fontFamily", "正文字体"),
                    ("fontSizePt", "正文字号"),
                    ("lineSpacingPt", "正文行距"),
                    ("textAlign", "正文对齐方式"),
                ):
                    _style_issue(
                        issues,
                        code=f"A_BODY_{key.upper()}",
                        label=label,
                        path=f"{path}.attrs.{key}",
                        actual=attrs.get(key),
                        expected=body_rules.get(key) if isinstance(body_rules, dict) else None,
                    )

    return issues


def normalize_doc_no_brackets(text: str) -> str:
    # 将年份或文号中的半角括号替换为〔〕，避免出现（2026）格式
    text = re.sub(r"\(([0-9]{2,4})\)", r"〔\1〕", text)
    text = re.sub(r"（([0-9]{2,4})）", r"〔\1〕", text)
    return text
