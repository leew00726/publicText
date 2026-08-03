from __future__ import annotations

import copy
import math
from typing import Any


TEMPLATE_RULES_SCHEMA_VERSION = 1
DEFAULT_PAGE_MARGINS_CM = {
    "top": 3.7,
    "bottom": 3.5,
    "left": 2.7,
    "right": 2.5,
}

_MARGIN_ALIASES = {
    "top": ("top", "topCm"),
    "bottom": ("bottom", "bottomCm"),
    "left": ("left", "leftCm"),
    "right": ("right", "rightCm"),
}


def _finite_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def _read_margin(source: Any, side: str) -> float | None:
    if not isinstance(source, dict):
        return None
    for key in _MARGIN_ALIASES[side]:
        number = _finite_number(source.get(key))
        if number is not None and 0 <= number <= 10:
            return round(number, 3)
    return None


def normalize_template_rules(
    value: Any,
    *,
    include_schema_version: bool = True,
    include_page_defaults: bool = False,
) -> dict[str, Any]:
    """Migrate known legacy rule shapes into the canonical v1 contract.

    The function intentionally preserves non-layout rule sections such as
    contentTemplate, references, attachments, and signature.
    """

    rules = copy.deepcopy(value) if isinstance(value, dict) else {}
    legacy_page_margins = rules.pop("pageMargins", None)
    page = rules.get("page")
    page = copy.deepcopy(page) if isinstance(page, dict) else {}
    canonical_margins = page.get("marginsCm")
    canonical_margins = copy.deepcopy(canonical_margins) if isinstance(canonical_margins, dict) else {}

    migrated_margins: dict[str, float] = {}
    for side in DEFAULT_PAGE_MARGINS_CM:
        number = _read_margin(canonical_margins, side)
        if number is None:
            number = _read_margin(page, side)
        if number is None:
            number = _read_margin(legacy_page_margins, side)
        if number is None and include_page_defaults:
            number = DEFAULT_PAGE_MARGINS_CM[side]
        if number is not None:
            migrated_margins[side] = number

    for aliases in _MARGIN_ALIASES.values():
        for key in aliases:
            page.pop(key, None)

    if migrated_margins or include_page_defaults:
        page["marginsCm"] = migrated_margins
        rules["page"] = page
    elif "page" in rules and page:
        rules["page"] = page
    elif "page" in rules:
        rules.pop("page", None)

    if include_schema_version:
        rules["schemaVersion"] = TEMPLATE_RULES_SCHEMA_VERSION
    else:
        rules.pop("schemaVersion", None)
    return rules


def resolve_layout_spec(value: Any, fallback_page: Any = None) -> dict[str, Any]:
    """Return the effective layout consumed by preview, checker, and export."""

    rules = normalize_template_rules(value, include_page_defaults=False)
    fallback_rules = normalize_template_rules(
        {"page": fallback_page} if isinstance(fallback_page, dict) else {},
        include_schema_version=False,
        include_page_defaults=False,
    )
    rule_margins = ((rules.get("page") or {}).get("marginsCm") or {})
    fallback_margins = ((fallback_rules.get("page") or {}).get("marginsCm") or {})
    margins = {
        side: rule_margins.get(side, fallback_margins.get(side, default_value))
        for side, default_value in DEFAULT_PAGE_MARGINS_CM.items()
    }

    return {
        "schemaVersion": TEMPLATE_RULES_SCHEMA_VERSION,
        "page": {"paper": "A4", "marginsCm": margins},
        "title": copy.deepcopy(rules.get("title") or {}),
        "body": copy.deepcopy(rules.get("body") or {}),
        "headings": copy.deepcopy(rules.get("headings") or {}),
    }
