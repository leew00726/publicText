from __future__ import annotations

import base64
from typing import Any

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn


_EMU_PER_CM = 360000


def _paragraph_alignment(paragraph) -> str:
    alignment = paragraph.alignment
    if alignment == WD_ALIGN_PARAGRAPH.CENTER:
        return "center"
    if alignment == WD_ALIGN_PARAGRAPH.RIGHT:
        return "right"
    return "left"


def extract_paragraph_image_nodes(paragraph) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    extents = paragraph._p.xpath(".//wp:extent")

    for index, blip in enumerate(paragraph._p.xpath(".//a:blip")):
        relationship_id = blip.get(qn("r:embed"))
        if not relationship_id:
            continue
        image_part = paragraph.part.related_parts.get(relationship_id)
        blob = getattr(image_part, "blob", None)
        content_type = str(getattr(image_part, "content_type", "") or "")
        if not blob or not content_type.startswith("image/"):
            continue

        width_cm = 3.0
        height_cm = 1.0
        if index < len(extents):
            extent = extents[index]
            try:
                width_cm = round(float(extent.get("cx")) / _EMU_PER_CM, 3)
                height_cm = round(float(extent.get("cy")) / _EMU_PER_CM, 3)
            except (TypeError, ValueError):
                pass

        data_url = f"data:{content_type};base64,{base64.b64encode(blob).decode('ascii')}"
        nodes.append(
            {
                "type": "paragraph",
                "attrs": {
                    "templateImageDataUrl": data_url,
                    "templateImageWidthCm": width_cm,
                    "templateImageHeightCm": height_cm,
                    "textAlign": _paragraph_alignment(paragraph),
                    "firstLineIndentChars": 0,
                },
                "content": [],
            }
        )
    return nodes


def extract_header_image_nodes(document) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    seen_images: set[str] = set()

    headers: list[Any] = []
    for section in document.sections:
        headers.extend([section.header, section.first_page_header, section.even_page_header])

    for header in headers:
        for paragraph in header.paragraphs:
            for node in extract_paragraph_image_nodes(paragraph):
                data_url = str((node.get("attrs") or {}).get("templateImageDataUrl") or "")
                if not data_url or data_url in seen_images:
                    continue
                seen_images.add(data_url)
                nodes.append(node)
    return nodes
