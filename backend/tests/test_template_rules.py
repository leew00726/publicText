import io
import unittest

from docx import Document

from app.services.docx_export import export_docx
from app.services.template_rules import normalize_template_rules, resolve_layout_spec


class TemplateRulesTests(unittest.TestCase):
    def test_legacy_ai_page_margins_are_migrated_to_canonical_contract(self) -> None:
        rules = normalize_template_rules(
            {
                "body": {"fontFamily": "仿宋_GB2312"},
                "pageMargins": {
                    "topCm": 3.7,
                    "bottomCm": 3.5,
                    "leftCm": 2.8,
                    "rightCm": 2.6,
                },
            }
        )

        self.assertEqual(rules["schemaVersion"], 1)
        self.assertNotIn("pageMargins", rules)
        self.assertEqual(
            rules["page"]["marginsCm"],
            {"top": 3.7, "bottom": 3.5, "left": 2.8, "right": 2.6},
        )

    def test_resolved_layout_uses_defaults_only_for_missing_margin_sides(self) -> None:
        spec = resolve_layout_spec({"page": {"marginsCm": {"left": 2.8, "right": 2.6}}})

        self.assertEqual(
            spec["page"]["marginsCm"],
            {"top": 3.7, "bottom": 3.5, "left": 2.8, "right": 2.6},
        )

    def test_docx_export_consumes_topic_template_page_margins(self) -> None:
        payload = {
            "title": "版式一致性测试",
            "structuredFields": {
                "title": "版式一致性测试",
                "topicTemplateRules": {
                    "page": {
                        "marginsCm": {
                            "top": 3.1,
                            "bottom": 3.2,
                            "left": 2.8,
                            "right": 2.6,
                        }
                    }
                },
            },
            "body": {
                "type": "doc",
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": "正文"}]}],
            },
        }

        raw = export_docx(payload, "测试单位", {"elements": [], "page": {}}, include_redhead=False)
        section = Document(io.BytesIO(raw)).sections[0]

        self.assertAlmostEqual(section.top_margin.cm, 3.1, places=1)
        self.assertAlmostEqual(section.bottom_margin.cm, 3.2, places=1)
        self.assertAlmostEqual(section.left_margin.cm, 2.8, places=1)
        self.assertAlmostEqual(section.right_margin.cm, 2.6, places=1)


if __name__ == "__main__":
    unittest.main()
