from __future__ import annotations

from typing import Any

SAFE_TOP_CM = 3.7
SAFE_BUFFER_CM = 0.2


def _text_height_cm(size_pt: float) -> float:
    return (size_pt / 72.0) * 2.54 * 1.2


def validate_publish_payload(payload: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    elements = payload.get("elements") or []
    enabled = [e for e in elements if e.get("enabled", True)]

    has_unit_name = False
    doc_no_elem = None
    signatory_elem = None

    for elem in enabled:
        elem_id = elem.get("id", "unknown")
        y_cm = float(elem.get("yCm", 0))

        if y_cm < 0 or y_cm >= SAFE_TOP_CM:
            errors.append(f"元素 {elem_id} 的 yCm={y_cm} 超出允许范围 [0, 3.7)。")
            continue

        if elem.get("type") == "text":
            bind = elem.get("bind")
            if bind == "unitName":
                has_unit_name = True
                anchor = ((elem.get("x") or {}).get("anchor"))
                if anchor != "center":
                    warnings.append("unitName 建议使用 center 锚点。")
            if bind == "docNo":
                doc_no_elem = elem
            if bind == "signatory":
                signatory_elem = elem

            font_size = float((((elem.get("text") or {}).get("font") or {}).get("sizePt", 16)))
            est = _text_height_cm(font_size)
            if y_cm + est > SAFE_TOP_CM - SAFE_BUFFER_CM:
                errors.append(
                    f"元素 {elem_id} 超出顶部安全区：yCm({y_cm}) + estimatedHeightCm({est:.3f}) > 3.5。"
                )
        elif elem.get("type") == "line":
            thickness_pt = float(((elem.get("line") or {}).get("thicknessPt", 1.5)))
            est = (thickness_pt / 72.0) * 2.54
            if y_cm + est > SAFE_TOP_CM - SAFE_BUFFER_CM:
                errors.append(
                    f"线条 {elem_id} 超出顶部安全区：yCm({y_cm}) + estimatedHeightCm({est:.3f}) > 3.5。"
                )

    if not has_unit_name:
        errors.append("必须至少包含一个 bind=unitName 的文本元素。")

    if doc_no_elem and signatory_elem:
        diff = abs(float(doc_no_elem.get("yCm", 0)) - float(signatory_elem.get("yCm", 0)))
        if diff > 0.05:
            warnings.append(f"docNo 与 signatory 的 yCm 差值为 {diff:.3f}cm，建议 <= 0.05cm。")

    return errors, warnings
