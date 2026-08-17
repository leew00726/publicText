import io
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "test_knowledge_base.db"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_MODE"] = "local"
os.environ["EXPORT_DIR"] = str((ROOT / "test-storage").as_posix())

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import KnowledgeDocument  # noqa: E402
from app.services.knowledge_base import search_knowledge_documents  # noqa: E402


class KnowledgeBaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if DB_PATH.exists():
            DB_PATH.unlink()
        Base.metadata.create_all(bind=engine)
        cls._client_cm = TestClient(app)
        cls.client = cls._client_cm.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._client_cm.__exit__(None, None, None)
        engine.dispose()
        if DB_PATH.exists():
            DB_PATH.unlink()

    def setUp(self) -> None:
        with SessionLocal() as db:
            db.query(KnowledgeDocument).delete()
            db.commit()

    def test_upload_knowledge_document_extracts_and_lists_file(self) -> None:
        response = self.client.post(
            "/api/knowledge/docs",
            data={"title": "安全生产工作报告"},
            files={"file": ("safe.txt", io.BytesIO("安全生产整改措施和年度重点工作。".encode("utf-8")), "text/plain")},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["title"], "安全生产工作报告")
        self.assertEqual(body["fileName"], "safe.txt")
        self.assertEqual(body["fileType"], "txt")
        self.assertGreater(body["sourceChars"], 0)

        listed = self.client.get("/api/knowledge/docs")
        self.assertEqual(listed.status_code, 200)
        self.assertTrue(any(item["id"] == body["id"] for item in listed.json()))

    def test_search_knowledge_documents_prefers_query_matches(self) -> None:
        with SessionLocal() as db:
            db.add_all(
                [
                    KnowledgeDocument(
                        title="安全生产工作报告",
                        file_name="safe.txt",
                        file_type="txt",
                        object_name="knowledge/safe.txt",
                        content_text="安全生产整改措施、风险排查和年度重点工作安排。",
                        excerpt="安全生产整改措施、风险排查和年度重点工作安排。",
                        source_chars=23,
                    ),
                    KnowledgeDocument(
                        title="财务预算说明",
                        file_name="budget.txt",
                        file_type="txt",
                        object_name="knowledge/budget.txt",
                        content_text="年度预算、资金使用计划和成本控制。",
                        excerpt="年度预算、资金使用计划和成本控制。",
                        source_chars=17,
                    ),
                ]
            )
            db.commit()

            refs = search_knowledge_documents(db, "安全生产风险整改", limit=2)

        self.assertEqual(refs[0]["title"], "安全生产工作报告")
        self.assertIn("安全生产", refs[0]["excerpt"])
        self.assertLessEqual(len(refs), 2)

    @patch("app.routers.ai.draft_document_with_knowledge")
    def test_draft_with_knowledge_passes_references_to_deepseek(self, mock_draft) -> None:
        mock_draft.return_value = {
            "text": "关于安全生产整改工作的报告",
            "model": "deepseek-chat",
            "usage": {"total_tokens": 128},
        }
        with SessionLocal() as db:
            db.add(
                KnowledgeDocument(
                    title="安全生产工作报告",
                    file_name="safe.txt",
                    file_type="txt",
                    object_name="knowledge/safe.txt",
                    content_text="安全生产整改措施、风险排查和年度重点工作安排。",
                    excerpt="安全生产整改措施、风险排查和年度重点工作安排。",
                    source_chars=23,
                )
            )
            db.commit()

        response = self.client.post(
            "/api/layout/ai/draft-with-knowledge",
            json={"instruction": "写一份安全生产整改报告"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["summary"], "关于安全生产整改工作的报告")
        self.assertNotIn("summaryLength", body)
        self.assertEqual(body["source"]["fileName"], "云矩知识库")
        self.assertEqual(body["knowledgeReferences"][0]["title"], "安全生产工作报告")
        passed_refs = mock_draft.call_args.kwargs["knowledge_references"]
        self.assertIn("安全生产", passed_refs[0]["excerpt"])
        self.assertNotIn("summary_length", mock_draft.call_args.kwargs)


if __name__ == "__main__":
    unittest.main()
