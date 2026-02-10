import io
import unittest

from docx import Document
from docx.shared import Pt

from app.services.topic_inference import extract_docx_features, infer_topic_rules


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


if __name__ == "__main__":
    unittest.main()
