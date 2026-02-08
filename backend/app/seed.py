from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Document, RedheadTemplate, Unit
from app.services.constants import default_redhead_template_a, default_redhead_template_b


def _sample_body(doc_type: str) -> dict:
    base_title = {
        "qingshi": "关于开展年度专项整治工作的请示",
        "jiyao": "第三季度重点工作推进会纪要",
        "han": "关于协助提供数据的函",
    }[doc_type]

    return {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 1},
                "content": [{"type": "text", "text": "一、总体要求"}],
            },
            {
                "type": "paragraph",
                "attrs": {"firstLineIndentChars": 2},
                "content": [{"type": "text", "text": f"{base_title}，请审阅。"}],
            },
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "（一）工作目标"}],
            },
            {
                "type": "heading",
                "attrs": {"level": 3},
                "content": [{"type": "text", "text": "1. 统一规范执行。"}],
            },
            {
                "type": "heading",
                "attrs": {"level": 4},
                "content": [{"type": "text", "text": "（1）严格落实排版要求。"}],
            },
            {
                "type": "table",
                "content": [
                    {
                        "type": "tableRow",
                        "content": [
                            {"type": "tableCell", "content": [{"type": "text", "text": "事项"}]},
                            {"type": "tableCell", "content": [{"type": "text", "text": "责任部门"}]},
                        ],
                    },
                    {
                        "type": "tableRow",
                        "content": [
                            {"type": "tableCell", "content": [{"type": "text", "text": "规范检查"}]},
                            {"type": "tableCell", "content": [{"type": "text", "text": "办公室"}]},
                        ],
                    },
                ],
            },
        ],
    }


def seed_data(db: Session):
    if db.query(Unit).count() > 0:
        return

    unit_a = Unit(name="市政府办公室", code="UNIT_GOV_OFFICE")
    unit_b = Unit(name="市发展改革委", code="UNIT_NDRC")
    db.add_all([unit_a, unit_b])
    db.flush()

    templates = []
    for unit in [unit_a, unit_b]:
        t_a = default_redhead_template_a(unit.id, unit.name)
        t_b = default_redhead_template_b(unit.id, unit.name)

        templates.append(
            RedheadTemplate(
                unit_id=unit.id,
                name=t_a["name"],
                version=t_a["version"],
                status=t_a["status"],
                is_default=t_a["isDefault"],
                scope=t_a["scope"],
                note=t_a["note"],
                page=t_a["page"],
                elements=t_a["elements"],
            )
        )
        templates.append(
            RedheadTemplate(
                unit_id=unit.id,
                name=t_b["name"],
                version=t_b["version"],
                status=t_b["status"],
                is_default=t_b["isDefault"],
                scope=t_b["scope"],
                note=t_b["note"],
                page=t_b["page"],
                elements=t_b["elements"],
            )
        )

    db.add_all(templates)
    db.flush()

    default_template_a = next(t for t in templates if t.unit_id == unit_a.id and t.is_default)
    default_template_b = next(t for t in templates if t.unit_id == unit_b.id and t.is_default)

    docs = [
        Document(
            title="关于开展年度专项整治工作的请示",
            doc_type="qingshi",
            unit_id=unit_a.id,
            redhead_template_id=default_template_a.id,
            status="draft",
            structured_fields={
                "title": "关于开展年度专项整治工作的请示",
                "mainTo": "市委：",
                "docNo": "市政办〔2026〕3号",
                "signatory": "办公室",
                "copyNo": "份号001",
                "date": "2026-02-07",
                "attachments": [{"index": 1, "name": "年度专项整治方案.docx"}],
            },
            body=_sample_body("qingshi"),
            import_report=None,
        ),
        Document(
            title="第三季度重点工作推进会纪要",
            doc_type="jiyao",
            unit_id=unit_b.id,
            redhead_template_id=default_template_b.id,
            status="draft",
            structured_fields={
                "title": "第三季度重点工作推进会纪要",
                "mainTo": "各处室：",
                "docNo": "发改办〔2026〕11号",
                "signatory": "综合处",
                "copyNo": "",
                "date": "2026-02-05",
                "attachments": [],
            },
            body=_sample_body("jiyao"),
            import_report=None,
        ),
        Document(
            title="关于协助提供数据的函",
            doc_type="han",
            unit_id=unit_a.id,
            redhead_template_id=default_template_a.id,
            status="draft",
            structured_fields={
                "title": "关于协助提供数据的函",
                "mainTo": "市统计局：",
                "docNo": "市政办函〔2026〕5号",
                "signatory": "办公室",
                "copyNo": "",
                "date": "2026-02-06",
                "attachments": [{"index": 1, "name": "数据口径说明.docx"}],
            },
            body=_sample_body("han"),
            import_report=None,
        ),
    ]

    db.add_all(docs)
    db.commit()
