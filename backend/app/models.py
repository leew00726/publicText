from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, JSON
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
