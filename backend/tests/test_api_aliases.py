import os
import unittest
import uuid
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "test_api_aliases.db"

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_MODE"] = "local"
os.environ["EXPORT_DIR"] = str((ROOT / "test-storage").as_posix())

from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402


class ApiAliasTests(unittest.TestCase):
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

    def test_management_alias_supports_unit_and_company_endpoints(self) -> None:
        unit_name = f"alias_company_{uuid.uuid4().hex[:8]}"
        create_resp = self.client.post("/api/management/units", json={"name": unit_name})
        self.assertEqual(create_resp.status_code, 200)

        list_resp = self.client.get("/api/management/companies")
        self.assertEqual(list_resp.status_code, 200)
        self.assertTrue(any(item["name"] == unit_name for item in list_resp.json()))

    def test_management_alias_supports_topic_endpoints(self) -> None:
        unit = self.client.post("/api/management/units", json={"name": f"alias_topic_unit_{uuid.uuid4().hex[:8]}"}).json()
        company_id = unit["id"]

        created = self.client.post(
            "/api/management/topics",
            json={"companyId": company_id, "name": "别名题材", "description": "alias"},
        )
        self.assertEqual(created.status_code, 200)
        topic_id = created.json()["id"]

        listed = self.client.get("/api/management/topics", params={"companyId": company_id})
        self.assertEqual(listed.status_code, 200)
        self.assertTrue(any(item["id"] == topic_id for item in listed.json()))

    def test_layout_alias_supports_docs_and_ai_endpoints(self) -> None:
        docs_resp = self.client.get("/api/layout/docs")
        self.assertEqual(docs_resp.status_code, 200)

        export_resp = self.client.post(
            "/api/layout/ai/export-summary-docx",
            json={"title": "测试总结", "summary": "一、结论", "sourceFileName": "demo.txt"},
        )
        self.assertEqual(export_resp.status_code, 200)
        self.assertEqual(
            export_resp.headers.get("content-type"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    def test_alias_audit_tracks_alias_and_legacy_hits(self) -> None:
        baseline = self.client.get("/api/management/alias-audit")
        self.assertEqual(baseline.status_code, 200)
        baseline_data = baseline.json()

        alias_before = baseline_data["totals"]["aliasHits"]
        legacy_before = baseline_data["totals"]["legacyHits"]
        docs_alias_before = baseline_data["prefixes"]["/api/layout/docs"]["aliasHits"]
        docs_legacy_before = baseline_data["prefixes"]["/api/layout/docs"]["legacyHits"]

        self.client.get("/api/layout/docs")
        self.client.get("/api/docs")

        after = self.client.get("/api/management/alias-audit")
        self.assertEqual(after.status_code, 200)
        after_data = after.json()

        self.assertGreaterEqual(after_data["totals"]["aliasHits"], alias_before + 1)
        self.assertGreaterEqual(after_data["totals"]["legacyHits"], legacy_before + 1)
        self.assertGreaterEqual(after_data["prefixes"]["/api/layout/docs"]["aliasHits"], docs_alias_before + 1)
        self.assertGreaterEqual(after_data["prefixes"]["/api/layout/docs"]["legacyHits"], docs_legacy_before + 1)

    def test_redhead_management_alias_is_removed(self) -> None:
        resp = self.client.get("/api/management/redheadTemplates")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
