import io
import unittest

from docx import Document

from app.services.document_summary import build_summary_docx, extract_text_from_uploaded_file


class DocumentSummaryServiceTests(unittest.TestCase):
    def test_extract_text_from_txt_trims_and_truncates(self) -> None:
        payload = ("第一段。\n\n第二段。" * 2000).encode("utf-8")
        result = extract_text_from_uploaded_file("report.txt", payload, max_chars=200)

        self.assertEqual(result["fileType"], "txt")
        self.assertEqual(result["originalChars"] > 200, True)
        self.assertEqual(result["truncated"], True)
        self.assertEqual(len(result["text"]) <= 200, True)
        self.assertIn("第一段。", result["text"])

    def test_extract_text_rejects_unsupported_extension(self) -> None:
        with self.assertRaises(ValueError):
            extract_text_from_uploaded_file("report.png", b"binary")

    def test_build_summary_docx_contains_title_and_summary(self) -> None:
        raw = build_summary_docx(
            title="会议纪要总结",
            summary_text="一、核心结论\n二、后续动作",
            source_file_name="meeting.docx",
        )

        doc = Document(io.BytesIO(raw))
        texts = [p.text for p in doc.paragraphs if p.text]
        self.assertIn("会议纪要总结", texts)
        self.assertTrue(any("meeting.docx" in line for line in texts))
        self.assertTrue(any("核心结论" in line for line in texts))


if __name__ == "__main__":
    unittest.main()
