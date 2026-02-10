import os
import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "test_topics_api.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["STORAGE_MODE"] = "local"
os.environ["EXPORT_DIR"] = str((ROOT / "test-storage").as_posix())

from app.database import Base
from app.models import DeletionAuditEvent, Topic, TopicTemplate, TopicTemplateDraft, Unit


class TopicModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)()

        self.company = Unit(name="测试公司", code="company-test")
        self.session.add(self.company)
        self.session.commit()

    def tearDown(self) -> None:
        self.session.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_topic_default_status_and_unique_code_in_company(self) -> None:
        topic = Topic(company_id=self.company.id, name="请示", code="qingshi")
        self.session.add(topic)
        self.session.commit()

        self.assertEqual(topic.status, "active")

        duplicate = Topic(company_id=self.company.id, name="请示副本", code="qingshi")
        self.session.add(duplicate)
        with self.assertRaises(IntegrityError):
            self.session.commit()
        self.session.rollback()

    def test_draft_template_and_audit_models_persist(self) -> None:
        topic = Topic(company_id=self.company.id, name="周例会纪要", code="zhou-li-hui-ji-yao")
        self.session.add(topic)
        self.session.commit()

        draft = TopicTemplateDraft(
            topic_id=topic.id,
            version=1,
            status="draft",
            inferred_rules={"body": {"fontFamily": "仿宋_GB2312"}},
            confidence_report={"body.fontFamily": {"confidence": 0.9}},
            agent_summary="生成初版草案",
        )
        self.session.add(draft)
        self.session.commit()

        template = TopicTemplate(
            topic_id=topic.id,
            version=1,
            rules=draft.inferred_rules,
            source_draft_id=draft.id,
            effective=True,
        )
        self.session.add(template)
        self.session.commit()

        audit = DeletionAuditEvent(
            company_id=self.company.id,
            topic_id=topic.id,
            file_count=3,
            total_bytes=10240,
            status="success",
            error_code=None,
        )
        self.session.add(audit)
        self.session.commit()

        self.assertEqual(template.effective, True)
        self.assertEqual(audit.file_count, 3)
        self.assertEqual(audit.total_bytes, 10240)


if __name__ == "__main__":
    unittest.main()
