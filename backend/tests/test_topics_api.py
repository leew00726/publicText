import io
import os
import unittest
from pathlib import Path

from docx import Document
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "test_topics_api.db"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_MODE"] = "local"
os.environ["EXPORT_DIR"] = str((ROOT / "test-storage").as_posix())

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import DocumentFile  # noqa: E402


def _docx_bytes(text: str = "示例正文") -> bytes:
    doc = Document()
    doc.add_heading("一、总体要求", level=1)
    doc.add_paragraph(text)
    bio = io.BytesIO()
    doc.save(bio)
    return bio.getvalue()


class TopicApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if DB_PATH.exists():
            DB_PATH.unlink()
        cls._client_cm = TestClient(app)
        cls.client = cls._client_cm.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._client_cm.__exit__(None, None, None)
        engine.dispose()
        if DB_PATH.exists():
            DB_PATH.unlink()

    def test_topic_flow_endpoints(self) -> None:
        company_resp = self.client.post("/api/units", json={"name": "topic_api_company"})
        self.assertEqual(company_resp.status_code, 200)
        company_id = company_resp.json()["id"]

        created = self.client.post(
            "/api/topics",
            json={"companyId": company_id, "name": "周例会纪要", "description": "每周例会模板"},
        )
        self.assertEqual(created.status_code, 200)
        topic = created.json()
        self.assertEqual(topic["status"], "active")
        topic_id = topic["id"]

        listed = self.client.get("/api/topics", params={"companyId": company_id})
        self.assertEqual(listed.status_code, 200)
        self.assertTrue(any(item["id"] == topic_id for item in listed.json()))

        with SessionLocal() as session:
            before = session.query(DocumentFile).count()

        analyze = self.client.post(
            f"/api/topics/{topic_id}/analyze",
            files=[
                (
                    "files",
                    (
                        "sample-a.docx",
                        _docx_bytes("第一份样本"),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ),
                ),
                (
                    "files",
                    (
                        "sample-b.docx",
                        _docx_bytes("第二份样本"),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ),
                ),
            ],
        )
        self.assertEqual(analyze.status_code, 200)
        draft = analyze.json()["draft"]
        self.assertEqual(draft["status"], "draft")
        self.assertIn("body", draft["inferredRules"])

        with SessionLocal() as session:
            after = session.query(DocumentFile).count()
        self.assertEqual(before, after)

        revised = self.client.post(
            f"/api/topics/{topic_id}/agent/revise",
            json={"instruction": "正文改成宋体", "patch": {"body": {"fontFamily": "宋体"}}},
        )
        self.assertEqual(revised.status_code, 200)
        revised_draft = revised.json()
        self.assertEqual(revised_draft["version"], 2)
        self.assertEqual(revised_draft["inferredRules"]["body"]["fontFamily"], "宋体")

        confirmed = self.client.post(f"/api/topics/{topic_id}/confirm-template")
        self.assertEqual(confirmed.status_code, 200)
        template = confirmed.json()["template"]
        self.assertTrue(template["effective"])

        templates = self.client.get(f"/api/topics/{topic_id}/templates")
        self.assertEqual(templates.status_code, 200)
        self.assertTrue(any(item["effective"] for item in templates.json()))

        audits = self.client.get(f"/api/topics/{topic_id}/audit-events")
        self.assertEqual(audits.status_code, 200)
        self.assertGreaterEqual(len(audits.json()), 1)
        first_audit = audits.json()[0]
        self.assertEqual(first_audit["topicId"], topic_id)
        self.assertIn("fileCount", first_audit)
        self.assertIn("totalBytes", first_audit)
        self.assertNotIn("filename", first_audit)
        self.assertNotIn("content", first_audit)

        effective = next(item for item in templates.json() if item["effective"])
        create_doc = self.client.post(
            f"/api/topics/{topic_id}/docs",
            json={"title": "周例会纪要（新建）"},
        )
        self.assertEqual(create_doc.status_code, 200)
        created_doc_id = create_doc.json()["id"]
        created_doc = self.client.get(f"/api/docs/{created_doc_id}")
        self.assertEqual(created_doc.status_code, 200)
        sf = created_doc.json()["structuredFields"]
        self.assertEqual(created_doc.json()["unitId"], company_id)
        self.assertEqual(created_doc.json()["docType"], "jiyao")
        self.assertEqual(sf["topicId"], topic_id)
        self.assertEqual(sf["topicTemplateId"], effective["id"])
        self.assertEqual(sf["topicTemplateVersion"], effective["version"])


if __name__ == "__main__":
    unittest.main()
