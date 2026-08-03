import unittest

from app.services.checker import check_document


def _heading(level: int, text: str) -> dict:
    return {
        "type": "heading",
        "attrs": {"level": level},
        "content": [{"type": "text", "text": text}],
    }


class CheckerTests(unittest.TestCase):
    def test_numeric_dunhao_second_level_heading_numbering_is_checked(self) -> None:
        body = {
            "type": "doc",
            "content": [
                _heading(1, "一、标准制定流程"),
                _heading(2, "2、改革发展局牵头提出供应链金融标准需求与框架。"),
            ],
        }

        issues = check_document(body)

        numbering_messages = [issue.message for issue in issues if issue.code == "B_NUMBERING"]
        self.assertEqual(numbering_messages, ["编号疑似异常，当前 2、，期望 1、"])

    def test_blank_document_does_not_report_false_success(self) -> None:
        issues = check_document(
            {"type": "doc", "content": []},
            {"title": "", "topicTemplateRules": {}},
            "版式一致性审计",
        )

        self.assertEqual(
            {issue.code for issue in issues},
            {"A_DOCUMENT_EMPTY", "A_TITLE_EMPTY"},
        )

    def test_explicit_body_style_override_is_compared_with_template(self) -> None:
        issues = check_document(
            {
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "attrs": {"fontFamily": "宋体", "fontSizePt": 14},
                        "content": [{"type": "text", "text": "正文内容"}],
                    }
                ],
            },
            {
                "title": "测试",
                "topicTemplateRules": {
                    "body": {"fontFamily": "仿宋_GB2312", "fontSizePt": 16},
                },
            },
            "测试",
        )

        self.assertIn("A_BODY_FONTFAMILY", {issue.code for issue in issues})
        self.assertIn("A_BODY_FONTSIZEPT", {issue.code for issue in issues})


if __name__ == "__main__":
    unittest.main()
