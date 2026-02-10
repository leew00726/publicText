from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class UnitOut(BaseModel):
    id: str
    name: str
    code: str


class UnitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)


class UnitUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class RedheadTextFont(BaseModel):
    family: str
    sizePt: float
    bold: bool = False
    color: str = "#FF0000"
    letterSpacingPt: float = 0


class RedheadTextConfig(BaseModel):
    align: Literal["left", "center", "right"] = "left"
    font: RedheadTextFont


class RedheadLineConfig(BaseModel):
    lengthMode: Literal["contentWidth", "custom"] = "contentWidth"
    lengthCm: float | None = None
    thicknessPt: float = 1.5
    color: str = "#FF0000"


class RedheadXConfig(BaseModel):
    anchor: Literal["marginLeft", "center", "marginRight"] = "marginLeft"
    offsetCm: float = 0


class RedheadElement(BaseModel):
    id: str
    enabled: bool = True
    type: Literal["text", "line"]
    bind: Literal["unitName", "docNo", "signatory", "copyNo", "fixedText"]
    fixedText: str | None = None
    visibleIfEmpty: bool = False
    x: RedheadXConfig
    yCm: float
    text: RedheadTextConfig | None = None
    line: RedheadLineConfig | None = None


class RedheadTemplatePage(BaseModel):
    paper: Literal["A4"] = "A4"
    marginsCm: dict[str, float] = Field(default_factory=lambda: {"top": 3.7, "bottom": 3.5, "left": 2.7, "right": 2.5})


class RedheadTemplateBase(BaseModel):
    unitId: str
    name: str
    version: int = 1
    status: Literal["draft", "published", "disabled"] = "draft"
    isDefault: bool = False
    scope: Literal["firstPageOnly"] = "firstPageOnly"
    note: str | None = None
    page: RedheadTemplatePage
    elements: list[RedheadElement]


class RedheadTemplateCreate(RedheadTemplateBase):
    pass


class RedheadTemplateUpdate(BaseModel):
    name: str | None = None
    note: str | None = None
    status: Literal["draft", "published", "disabled"] | None = None
    isDefault: bool | None = None
    page: RedheadTemplatePage | None = None
    elements: list[RedheadElement] | None = None


class RedheadValidationResult(BaseModel):
    errors: list[str]
    warnings: list[str]


class RedheadTemplateOut(RedheadTemplateBase):
    id: str
    createdAt: datetime
    updatedAt: datetime


class AttachmentItem(BaseModel):
    index: int
    name: str


class StructuredFields(BaseModel):
    title: str = ""
    mainTo: str = ""
    signOff: str = ""
    docNo: str = ""
    signatory: str = ""
    copyNo: str = ""
    date: str = ""
    exportWithRedhead: bool = True
    attachments: list[AttachmentItem] = Field(default_factory=list)
    topicId: str | None = None
    topicName: str | None = None
    topicTemplateId: str | None = None
    topicTemplateVersion: int | None = None
    topicTemplateRules: dict[str, Any] | None = None


class DocumentBase(BaseModel):
    title: str
    docType: Literal["qingshi", "jiyao", "han", "tongzhi"]
    unitId: str
    redheadTemplateId: str | None = None
    status: str = "draft"
    structuredFields: StructuredFields = Field(default_factory=StructuredFields)
    body: dict[str, Any] = Field(default_factory=lambda: {"type": "doc", "content": []})


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: str | None = None
    docType: Literal["qingshi", "jiyao", "han", "tongzhi"] | None = None
    unitId: str | None = None
    redheadTemplateId: str | None = None
    status: str | None = None
    structuredFields: StructuredFields | None = None
    body: dict[str, Any] | None = None


class DocumentOut(DocumentBase):
    id: str
    importReport: dict[str, Any] | None = None
    createdAt: datetime
    updatedAt: datetime


class CheckIssue(BaseModel):
    code: str
    type: Literal["A", "B"]
    message: str
    path: str
    level: Literal["error", "warning"] = "error"


class CheckResponse(BaseModel):
    issues: list[CheckIssue]


class ImportReport(BaseModel):
    unrecognizedTitleCount: int
    numberingWarnings: list[str]
    tableWarnings: list[str]
    notes: list[str] = Field(default_factory=list)


class ImportResponse(BaseModel):
    docId: str
    importReport: ImportReport


class IdResponse(BaseModel):
    id: str


class ApiMessage(BaseModel):
    message: str


class TopicCreate(BaseModel):
    companyId: str
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class TopicOut(BaseModel):
    id: str
    companyId: str
    name: str
    code: str
    description: str | None = None
    status: str
    createdAt: datetime
    updatedAt: datetime


class TopicDraftOut(BaseModel):
    id: str
    topicId: str
    version: int
    status: str
    inferredRules: dict[str, Any]
    confidenceReport: dict[str, Any]
    agentSummary: str | None = None
    createdAt: datetime
    updatedAt: datetime


class TopicTemplateOut(BaseModel):
    id: str
    topicId: str
    version: int
    rules: dict[str, Any]
    sourceDraftId: str | None = None
    effective: bool
    createdAt: datetime


class TopicAnalyzeResponse(BaseModel):
    topicId: str
    draft: TopicDraftOut


class TopicReviseRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=500)
    patch: dict[str, Any] | None = None


class TopicConfirmResponse(BaseModel):
    topicId: str
    template: TopicTemplateOut


class TopicCreateDocRequest(BaseModel):
    title: str | None = None
    docType: Literal["qingshi", "jiyao", "han", "tongzhi"] | None = None
    redheadTemplateId: str | None = None


class DeletionAuditEventOut(BaseModel):
    id: str
    companyId: str
    topicId: str | None = None
    fileCount: int
    totalBytes: int
    status: str
    errorCode: str | None = None
    startedAt: datetime
    endedAt: datetime
