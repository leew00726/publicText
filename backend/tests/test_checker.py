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


if __name__ == "__main__":
    unittest.main()
