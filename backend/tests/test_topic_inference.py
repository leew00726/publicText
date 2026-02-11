import io
import unittest
from unittest.mock import MagicMock, patch

from docx import Document
from docx.shared import Pt

from app.services.topic_inference import extract_docx_features, extract_pdf_features, infer_topic_rules


def _build_docx_bytes(body_font: str, heading_font: str, heading_size_pt: float, body_size_pt: float) -> bytes:
    doc = Document()

    heading = doc.add_paragraph("一、总体要求")
    heading.style = doc.styles["Heading 1"]
    heading_run = heading.runs[0]
    heading_run.font.name = heading_font
    heading_run.font.size = Pt(heading_size_pt)

    body = doc.add_paragraph("这是正文第一段。")
    body_run = body.runs[0]
    body_run.font.name = body_font
    body_run.font.size = Pt(body_size_pt)
    body.paragraph_format.space_before = Pt(0)
    body.paragraph_format.space_after = Pt(0)
    body.paragraph_format.line_spacing = Pt(28)

    bio = io.BytesIO()
    doc.save(bio)
    return bio.getvalue()


class TopicInferenceTests(unittest.TestCase):
    def test_extract_docx_features_reads_basic_styles(self) -> None:
        content = _build_docx_bytes("仿宋_GB2312", "黑体", 16, 16)
        features = extract_docx_features(content)

        self.assertEqual(features["body"]["fontFamily"], "仿宋_GB2312")
        self.assertEqual(features["headings"]["level1"]["fontFamily"], "黑体")
        self.assertGreater(features["page"]["marginsCm"]["top"], 0)

    def test_infer_topic_rules_computes_mode_and_confidence(self) -> None:
        f1 = extract_docx_features(_build_docx_bytes("仿宋_GB2312", "黑体", 16, 16))
        f2 = extract_docx_features(_build_docx_bytes("仿宋_GB2312", "黑体", 16, 16))
        f3 = extract_docx_features(_build_docx_bytes("宋体", "黑体", 16, 16))

        rules, confidence = infer_topic_rules([f1, f2, f3])

        self.assertEqual(rules["body"]["fontFamily"], "仿宋_GB2312")
        self.assertAlmostEqual(confidence["body.fontFamily"]["confidence"], 2 / 3, places=2)
        self.assertEqual(rules["headings"]["level1"]["fontFamily"], "黑体")

    def test_infer_topic_rules_rejects_empty_features(self) -> None:
        with self.assertRaises(ValueError):
            infer_topic_rules([])

    @patch("app.services.topic_inference.PdfReader")
    def test_extract_pdf_features_reads_font_and_size(self, mock_reader) -> None:
        page = MagicMock()

        def fake_extract_text(visitor_text=None):
            if visitor_text:
                visitor_text("标题", None, None, {"/BaseFont": "/ABCDEE+SimHei"}, 16)
                visitor_text("正文", None, None, {"/BaseFont": "/ABCDEE+FangSong_GB2312"}, 14)
                visitor_text("正文2", None, None, {"/BaseFont": "/ABCDEE+FangSong_GB2312"}, 14)
            return "标题 正文 正文2"

        page.extract_text.side_effect = fake_extract_text
        mock_reader.return_value.pages = [page]

        features = extract_pdf_features(b"%PDF-1.4")
        self.assertEqual(features["body"]["fontFamily"], "FangSong_GB2312")
        self.assertEqual(features["body"]["fontSizePt"], 14)

    @patch("app.services.topic_inference.PdfReader")
    def test_extract_pdf_features_rejects_scanned_pdf(self, mock_reader) -> None:
        page = MagicMock()
        page.extract_text.return_value = ""
        mock_reader.return_value.pages = [page]

        with self.assertRaises(ValueError):
            extract_pdf_features(b"%PDF-1.4")


if __name__ == "__main__":
    unittest.main()
