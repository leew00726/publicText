from datetime import datetime
import uuid

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    templates: Mapped[list["RedheadTemplate"]] = relationship("RedheadTemplate", back_populates="unit")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="unit")
    topics: Mapped[list["Topic"]] = relationship("Topic", back_populates="company")
    deletion_audits: Mapped[list["DeletionAuditEvent"]] = relationship("DeletionAuditEvent", back_populates="company")


class RedheadTemplate(Base):
    __tablename__ = "redhead_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    unit_id: Mapped[str] = mapped_column(String(36), ForeignKey("units.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scope: Mapped[str] = mapped_column(String(50), default="firstPageOnly", nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    page: Mapped[dict] = mapped_column(JSON, nullable=False)
    elements: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    unit: Mapped[Unit] = relationship("Unit", back_populates="templates")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="redhead_template")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    unit_id: Mapped[str] = mapped_column(String(36), ForeignKey("units.id"), nullable=False, index=True)
    redhead_template_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("redhead_templates.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False)
    structured_fields: Mapped[dict] = mapped_column(JSON, nullable=False)
    body: Mapped[dict] = mapped_column(JSON, nullable=False)
    import_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    unit: Mapped[Unit] = relationship("Unit", back_populates="documents")
    redhead_template: Mapped[RedheadTemplate | None] = relationship("RedheadTemplate", back_populates="documents")


class DocumentFile(Base):
    __tablename__ = "document_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id"), nullable=False)
    file_kind: Mapped[str] = mapped_column(String(30), nullable=False)  # import_source | export_docx
    object_name: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_topics_company_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("units.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company: Mapped[Unit] = relationship("Unit", back_populates="topics")
    drafts: Mapped[list["TopicTemplateDraft"]] = relationship("TopicTemplateDraft", back_populates="topic")
    templates: Mapped[list["TopicTemplate"]] = relationship("TopicTemplate", back_populates="topic")
    deletion_audits: Mapped[list["DeletionAuditEvent"]] = relationship("DeletionAuditEvent", back_populates="topic")


class TopicTemplateDraft(Base):
    __tablename__ = "topic_template_drafts"
    __table_args__ = (UniqueConstraint("topic_id", "version", name="uq_topic_template_drafts_topic_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False)
    inferred_rules: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence_report: Mapped[dict] = mapped_column(JSON, nullable=False)
    agent_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    topic: Mapped[Topic] = relationship("Topic", back_populates="drafts")
    templates: Mapped[list["TopicTemplate"]] = relationship("TopicTemplate", back_populates="source_draft")


class TopicTemplate(Base):
    __tablename__ = "topic_templates"
    __table_args__ = (UniqueConstraint("topic_id", "version", name="uq_topic_templates_topic_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    rules: Mapped[dict] = mapped_column(JSON, nullable=False)
    source_draft_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("topic_template_drafts.id"), nullable=True)
    effective: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    topic: Mapped[Topic] = relationship("Topic", back_populates="templates")
    source_draft: Mapped[TopicTemplateDraft | None] = relationship("TopicTemplateDraft", back_populates="templates")


class DeletionAuditEvent(Base):
    __tablename__ = "deletion_audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("units.id"), nullable=False, index=True)
    topic_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("topics.id"), nullable=True, index=True)
    file_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    company: Mapped[Unit] = relationship("Unit", back_populates="deletion_audits")
    topic: Mapped[Topic | None] = relationship("Topic", back_populates="deletion_audits")
