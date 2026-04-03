from __future__ import annotations

import copy
import re
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, DeletionAuditEvent, Topic, TopicTemplate, TopicTemplateDraft, Unit
from app.schemas import (
    ApiMessage,
    DeletionAuditEventOut,
    IdResponse,
    TopicAnalyzeResponse,
    TopicConfirmResponse,
    TopicCreate,
    TopicCreateDocRequest,
    TopicDraftOut,
    TopicOut,
    TopicReviseRequest,
    TopicTemplateOut,
    UnitOut,
)
from app.services.ai_agent import AgentConfigError, AgentUpstreamError, revise_topic_rules_with_deepseek
from app.services.topic_inference import extract_docx_features, extract_pdf_features, infer_topic_rules

router = APIRouter(tags=["topics"])

_FONT_ALIASES: dict[str, str] = {
    "方正小标宋简体": "方正小标宋简",
    "方正小标宋简": "方正小标宋简",
    "方正小标宋": "方正小标宋简",
    "小标宋": "方正小标宋简",
    "仿宋_GB2312": "仿宋_GB2312",
    "仿宋": "仿宋_GB2312",
    "楷体_GB2312": "楷体_GB2312",
    "楷体": "楷体_GB2312",
    "黑体": "黑体",
    "宋体": "宋体",
}

_SORTED_FONT_KEYS = sorted(_FONT_ALIASES.keys(), key=len, reverse=True)
_FONT_NAME_RE = re.compile(r"^[A-Za-z0-9_\-\u4e00-\u9fa5]+$")
_FONT_KEYWORD_RE = re.compile(
    r"(方正|标宋|仿宋|楷体|黑体|宋体|GB2312|仿|楷|黑|宋|字体|微软雅黑|幼圆|隶书|魏碑|行楷|FangSong|KaiTi|HeiTi|SimSun|SimHei|Microsoft)"
)
_INVALID_FONT_TERMS = (
    "梯形",
    "菱形",
    "排列",
    "排版",
    "居中",
    "居左",
    "居右",
    "全角",
    "半角",
    "阿拉伯数字",
    "空一行",
    "左空",
    "右空",
    "两格",
    "缩进",
    "行距",
    "段前",
    "段后",
    "括号",
)
_TRAILING_SUFFIX_RE = re.compile(
    r"^(主\s*持(?:\s*人|\s*者)?|参\s*(?:加|会)(?:\s*人|\s*人员|\s*名单)?|列\s*席(?:\s*人|\s*人员)?|出\s*席(?:\s*人|\s*人员)?|记\s*录(?:\s*人|\s*员)?|发\s*(?:送|至|文)|主\s*送|抄\s*送|分\s*送)\s*[：:]"
)
_DOC_ISSUE_LINE_RE = re.compile(r"^(?:\d{4}\s*年第\s*[0-9一二三四五六七八九十百千]+\s*期|第\s*[0-9一二三四五六七八九十百千]+\s*期)$")
_TITLE_KEYWORD_RE = re.compile(
    r"(报告|纪要|请示|函|通知|方案|总结|通报|决定|公告|意见|办法|细则|规定|计划|说明|简报|要点|清单|材料)$"
)


def _normalize_font_name(raw: str) -> str | None:
    candidate = str(raw or "").strip().strip("：:；;，,。.")
    if not candidate:
        return None

    candidate = re.sub(r"(?:字体|字形)$", "", candidate).strip()
    if not candidate:
        return None

    if candidate in _FONT_ALIASES:
        return _FONT_ALIASES[candidate]

    for raw_key in _SORTED_FONT_KEYS:
        if raw_key in candidate:
            return _FONT_ALIASES[raw_key]

    if any(term in candidate for term in _INVALID_FONT_TERMS):
        return None
    if not _FONT_NAME_RE.match(candidate):
        return None
    if not _FONT_KEYWORD_RE.search(candidate):
        return None
    return candidate


def _extract_font_name(text: str) -> str | None:
    if not text:
        return None

    for raw in _SORTED_FONT_KEYS:
        if raw in text:
            return _FONT_ALIASES[raw]

    matched = re.search(r"(?:改为|改成|设为|设置为|调整为|变为|使用|用|字体为|为)\s*([A-Za-z0-9_\-\u4e00-\u9fa5]+)", text)
    if not matched:
        return None

    candidate = re.split(r"(并|且|保持|不变|不改|不调整|\s)", matched.group(1))[0]
    candidate = candidate.strip()
    if not candidate:
        return None
    return _normalize_font_name(candidate)


def _detect_font_targets(text: str) -> set[str]:
    targets: set[str] = set()
    if not text:
        return targets

    if re.search(r"(主标题|文件标题|文档标题|公文标题)", text):
        targets.add("title")

    if re.search(r"(一级标题|1级标题|1\s*级\s*标题|一\s*级\s*标题)", text):
        targets.add("level1")
    if re.search(r"(第一层级|第\s*一\s*层级|第一层标题|第\s*一\s*层标题|第一层级序号|第\s*一\s*层级序号)", text):
        targets.add("level1")
    if re.search(r"(二级标题|2级标题|2\s*级\s*标题|二\s*级\s*标题)", text):
        targets.add("level2")
    if re.search(r"(第二层级|第\s*二\s*层级|第二层标题|第\s*二\s*层标题|第二层级序号|第\s*二\s*层级序号)", text):
        targets.add("level2")
    if re.search(r"(三级标题|3级标题|3\s*级\s*标题|三\s*级\s*标题)", text):
        targets.add("level3")
    if re.search(r"(第三层级|第\s*三\s*层级|第三层标题|第\s*三\s*层标题|第三层级序号|第\s*三\s*层级序号)", text):
        targets.add("level3")
    if re.search(r"(四级标题|4级标题|4\s*级\s*标题|四\s*级\s*标题)", text):
        targets.add("level4")
    if re.search(r"(第四层级|第\s*四\s*层级|第四层标题|第\s*四\s*层标题|第四层级序号|第\s*四\s*层级序号)", text):
        targets.add("level4")

    if re.search(r"(正文字体|正文(?:字号|行距|首行缩进)?\s*(?:改为|改成|设为|设置为|调整为|变为|使用|用|统一使用))", text):
        targets.add("body")

    has_any_heading_level = any(level in targets for level in {"level1", "level2", "level3", "level4"})
    has_title = "title" in targets
    if (
        not has_any_heading_level
        and not has_title
        and (
            re.search(r"(各级标题|所有标题|全部标题)", text)
            or ("标题" in text and re.search(r"(字体|字号|样式|统一|改为|改成|设为|设置为|调整为|变为|使用|用)", text))
        )
        and not re.search(r"(标题排列|标题排版)", text)
    ):
        targets.update({"level1", "level2", "level3", "level4"})

    if "全文" in text:
        targets.update({"body", "title", "level1", "level2", "level3", "level4"})

    return targets


def _apply_font_patch(patch: dict, targets: set[str], font_name: str) -> None:
    if "title" in targets:
        patch.setdefault("title", {})["fontFamily"] = font_name

    if "body" in targets:
        patch.setdefault("body", {})["fontFamily"] = font_name

    heading_targets = [target for target in targets if target.startswith("level")]
    if heading_targets:
        headings = patch.setdefault("headings", {})
        for level_key in heading_targets:
            headings.setdefault(level_key, {})["fontFamily"] = font_name


def _build_patch_from_instruction(instruction: str) -> dict:
    patch: dict = {}
    segments = [seg.strip() for seg in re.split(r"[，,。；;\n]+", instruction or "") if seg.strip()]
    pending_targets: set[str] = set()

    for seg in segments:
        targets = _detect_font_targets(seg)
        font_name = _extract_font_name(seg)

        if not font_name:
            pending_targets = targets
            continue

        effective_targets = targets or pending_targets
        if not effective_targets:
            pending_targets = set()
            continue

        _apply_font_patch(patch, effective_targets, font_name)
        pending_targets = set()

    if patch:
        return patch

    fallback_font = _extract_font_name(instruction)
    if fallback_font:
        fallback_targets = _detect_font_targets(instruction)
        if fallback_targets:
            fallback_patch: dict = {}
            _apply_font_patch(fallback_patch, fallback_targets, fallback_font)
            if fallback_patch:
                return fallback_patch
        return {"body": {"fontFamily": fallback_font}}
    return {}


def _sanitize_rule_patch(value):
    if isinstance(value, dict):
        sanitized: dict = {}
        for key, item in value.items():
            if key == "fontFamily":
                normalized = _normalize_font_name(str(item or ""))
                if normalized:
                    sanitized[key] = normalized
                continue
            sanitized[key] = _sanitize_rule_patch(item)
        return sanitized
    if isinstance(value, list):
        return [_sanitize_rule_patch(item) for item in value]
    return value


def _topic_out(row: Topic) -> TopicOut:
    return TopicOut(
        id=row.id,
        companyId=row.company_id,
        name=row.name,
        code=row.code,
        description=row.description,
        status=row.status,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _draft_out(row: TopicTemplateDraft) -> TopicDraftOut:
    return TopicDraftOut(
        id=row.id,
        topicId=row.topic_id,
        version=row.version,
        status=row.status,
        inferredRules=row.inferred_rules,
        confidenceReport=row.confidence_report,
        agentSummary=row.agent_summary,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _template_out(row: TopicTemplate) -> TopicTemplateOut:
    return TopicTemplateOut(
        id=row.id,
        topicId=row.topic_id,
        version=row.version,
        rules=row.rules,
        sourceDraftId=row.source_draft_id,
        effective=row.effective,
        createdAt=row.created_at,
    )


def _audit_out(row: DeletionAuditEvent) -> DeletionAuditEventOut:
    return DeletionAuditEventOut(
        id=row.id,
        companyId=row.company_id,
        topicId=row.topic_id,
        fileCount=row.file_count,
        totalBytes=row.total_bytes,
        status=row.status,
        errorCode=row.error_code,
        startedAt=row.started_at,
        endedAt=row.ended_at,
    )


def _slugify_topic_name(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    if not slug:
        return "topic"
    return slug[:100]


def _generate_topic_code(db: Session, company_id: str, name: str) -> str:
    base = _slugify_topic_name(name)
    candidate = base
    index = 2
    while (
        db.query(Topic)
        .filter(Topic.company_id == company_id, Topic.code == candidate)
        .first()
        is not None
    ):
        suffix = f"-{index}"
        candidate = f"{base[: (120 - len(suffix))]}{suffix}"
        index += 1
    return candidate


def _merge_patch(target: dict, patch: dict) -> dict:
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _merge_patch(target[key], value)
            continue
        target[key] = value
    return target


def _node_text(node: dict) -> str:
    content = node.get("content")
    if not isinstance(content, list):
        return ""
    return "".join(str(part.get("text") or "") for part in content if isinstance(part, dict)).strip()


def _looks_like_title_template_node(node: dict) -> bool:
    if node.get("type") not in {"paragraph", "heading"}:
        return False

    text = _node_text(node).replace("\u00A0", " ").strip()
    if not text:
        return False
    if _TRAILING_SUFFIX_RE.match(text) or _DOC_ISSUE_LINE_RE.match(text):
        return False
    if re.search(r"签发人\s*[：:]", text):
        return False
    if any(keyword in text for keyword in ["有限公司", "有限责任公司", "集团", "公司", "委员会", "办公室", "政府"]):
        return False
    return bool(_TITLE_KEYWORD_RE.search(text))


def _sanitize_template_leading_nodes(leading_nodes: list[dict], content_template: dict[str, object]) -> list[dict]:
    title_mode = str(content_template.get("titleMode") or "").strip().lower()
    if title_mode == "fixed":
        return [copy.deepcopy(node) for node in leading_nodes if isinstance(node, dict)]

    sanitized: list[dict] = []
    for node in leading_nodes:
        if not isinstance(node, dict):
            continue
        if _looks_like_title_template_node(node):
            continue
        sanitized.append(copy.deepcopy(node))
    return sanitized


def _normalize_trailing_suffix_node(node: dict, body_style: dict, force: bool = False) -> dict:
    if node.get("type") not in {"paragraph", "heading"}:
        return node
    if not force and not _TRAILING_SUFFIX_RE.match(_node_text(node)):
        return node

    attrs = node.get("attrs")
    next_attrs = copy.deepcopy(attrs) if isinstance(attrs, dict) else {}

    body_font = body_style.get("fontFamily")
    if isinstance(body_font, str) and body_font.strip():
        next_attrs["fontFamily"] = body_font.strip()

    body_size = body_style.get("fontSizePt")
    if isinstance(body_size, (int, float)):
        next_attrs["fontSizePt"] = body_size

    body_line_spacing = body_style.get("lineSpacingPt")
    if isinstance(body_line_spacing, (int, float)):
        next_attrs["lineSpacingPt"] = body_line_spacing

    body_indent_pt = body_style.get("firstLineIndentPt")
    body_indent_chars = body_style.get("firstLineIndentChars")
    if isinstance(body_indent_pt, (int, float)):
        next_attrs["firstLineIndentPt"] = body_indent_pt
        next_attrs.pop("firstLineIndentChars", None)
    elif isinstance(body_indent_chars, (int, float)):
        next_attrs["firstLineIndentChars"] = body_indent_chars
        next_attrs.pop("firstLineIndentPt", None)
    elif "firstLineIndentPt" not in next_attrs and "firstLineIndentChars" not in next_attrs:
        next_attrs["firstLineIndentChars"] = 2

    next_attrs["textAlign"] = "left"
    next_attrs["bold"] = False
    node["attrs"] = next_attrs
    return node


def _build_doc_body_from_topic_rules(rules: dict[str, object] | None) -> dict:
    default_body = {"type": "doc", "content": []}
    if not isinstance(rules, dict):
        return default_body

    content_template = rules.get("contentTemplate")
    if not isinstance(content_template, dict):
        return default_body

    leading_nodes = content_template.get("leadingNodes")
    trailing_nodes = content_template.get("trailingNodes")

    if not isinstance(leading_nodes, list):
        leading_nodes = []
    if not isinstance(trailing_nodes, list):
        trailing_nodes = []

    if not leading_nodes and not trailing_nodes:
        return default_body

    body_style = rules.get("body") if isinstance(rules.get("body"), dict) else {}
    content: list[dict] = []
    content.extend(_sanitize_template_leading_nodes(leading_nodes, content_template))

    placeholder_text = str(content_template.get("bodyPlaceholder") or "（请在此输入正文）")
    content.append(
        {
            "type": "paragraph",
            "attrs": {"firstLineIndentChars": 2},
            "content": [{"type": "text", "text": placeholder_text}],
        }
    )

    in_suffix_block = False
    for node in trailing_nodes:
        if not isinstance(node, dict):
            continue
        cloned_node = copy.deepcopy(node)
        node_text = _node_text(cloned_node)
        if _TRAILING_SUFFIX_RE.match(node_text):
            in_suffix_block = True
        if in_suffix_block and node_text:
            content.append(_normalize_trailing_suffix_node(cloned_node, body_style, force=True))
        else:
            content.append(cloned_node)
    return {"type": "doc", "content": content}


def _infer_doc_type(topic_name: str, preferred_doc_type: str | None) -> str:
    if preferred_doc_type in {"qingshi", "jiyao", "han", "tongzhi"}:
        return preferred_doc_type

    name = topic_name or ""
    if "请示" in name:
        return "qingshi"
    if "纪要" in name:
        return "jiyao"
    if "函" in name:
        return "han"
    return "tongzhi"


def _resolve_initial_structured_title(template: TopicTemplate | None) -> str:
    if template is None or not isinstance(template.rules, dict):
        return ""

    title_rules = template.rules.get("title")
    if not isinstance(title_rules, dict):
        return ""

    content_template = template.rules.get("contentTemplate")
    if isinstance(content_template, dict) and content_template.get("titleMode") == "fixed":
        return ""

    template_text = title_rules.get("templateText")
    return str(template_text).strip() if isinstance(template_text, str) else ""


@router.get("/api/companies", response_model=list[UnitOut])
def list_companies(db: Session = Depends(get_db)):
    rows = db.query(Unit).order_by(Unit.created_at.asc()).all()
    return [UnitOut(id=row.id, name=row.name, code=row.code) for row in rows]


@router.get("/api/topics", response_model=list[TopicOut])
def list_topics(companyId: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Topic)
        .filter(Topic.company_id == companyId)
        .order_by(Topic.created_at.asc())
        .all()
    )
    return [_topic_out(row) for row in rows]


@router.get("/api/topics/{topic_id}", response_model=TopicOut)
def get_topic(topic_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")
    return _topic_out(topic)


@router.post("/api/topics", response_model=TopicOut)
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)):
    company = db.query(Unit).filter(Unit.id == payload.companyId).first()
    if not company:
        raise HTTPException(status_code=404, detail="公司不存在")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="题材名称不能为空")

    topic = Topic(
        company_id=payload.companyId,
        name=name,
        code=_generate_topic_code(db, payload.companyId, name),
        description=(payload.description or "").strip() or None,
        status="active",
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _topic_out(topic)


@router.delete("/api/topics/{topic_id}", response_model=ApiMessage)
def delete_topic(topic_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    db.query(TopicTemplate).filter(TopicTemplate.topic_id == topic_id).delete(synchronize_session=False)
    db.query(TopicTemplateDraft).filter(TopicTemplateDraft.topic_id == topic_id).delete(synchronize_session=False)
    db.query(DeletionAuditEvent).filter(DeletionAuditEvent.topic_id == topic_id).delete(synchronize_session=False)
    db.delete(topic)
    db.commit()
    return ApiMessage(message="ok")


@router.post("/api/topics/{topic_id}/analyze", response_model=TopicAnalyzeResponse)
async def analyze_topic(topic_id: str, files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一个 DOCX 或 PDF 文件")

    started_at = datetime.utcnow()
    total_bytes = 0
    file_count = len(files)

    try:
        features_list: list[dict] = []
        for file in files:
            filename = (file.filename or "").lower()
            data = await file.read()
            total_bytes += len(data)
            if not data:
                continue
            try:
                if filename.endswith(".docx"):
                    features_list.append(extract_docx_features(data))
                elif filename.endswith(".pdf"):
                    features_list.append(extract_pdf_features(data))
                else:
                    raise HTTPException(status_code=400, detail="仅支持 DOCX 或 PDF 文件")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

        rules, confidence = infer_topic_rules(features_list)
        latest = (
            db.query(TopicTemplateDraft)
            .filter(TopicTemplateDraft.topic_id == topic_id)
            .order_by(TopicTemplateDraft.version.desc())
            .first()
        )
        version = (latest.version + 1) if latest else 1

        draft = TopicTemplateDraft(
            topic_id=topic_id,
            version=version,
            status="draft",
            inferred_rules=rules,
            confidence_report=confidence,
            agent_summary="系统已基于上传材料生成初版模板草案。",
        )
        db.add(draft)
        db.add(
            DeletionAuditEvent(
                company_id=topic.company_id,
                topic_id=topic.id,
                file_count=file_count,
                total_bytes=total_bytes,
                status="success",
                error_code=None,
                started_at=started_at,
                ended_at=datetime.utcnow(),
            )
        )
        db.commit()
        db.refresh(draft)
        return TopicAnalyzeResponse(topicId=topic.id, draft=_draft_out(draft))
    except HTTPException as exc:
        db.rollback()
        db.add(
            DeletionAuditEvent(
                company_id=topic.company_id,
                topic_id=topic.id,
                file_count=file_count,
                total_bytes=total_bytes,
                status="failed",
                error_code=f"http_{exc.status_code}",
                started_at=started_at,
                ended_at=datetime.utcnow(),
            )
        )
        db.commit()
        raise
    except Exception as exc:
        db.rollback()
        db.add(
            DeletionAuditEvent(
                company_id=topic.company_id,
                topic_id=topic.id,
                file_count=file_count,
                total_bytes=total_bytes,
                status="failed",
                error_code=exc.__class__.__name__,
                started_at=started_at,
                ended_at=datetime.utcnow(),
            )
        )
        db.commit()
        raise HTTPException(status_code=500, detail="题材分析失败")


@router.get("/api/topics/{topic_id}/drafts/latest", response_model=TopicDraftOut)
def get_latest_draft(topic_id: str, db: Session = Depends(get_db)):
    draft = (
        db.query(TopicTemplateDraft)
        .filter(TopicTemplateDraft.topic_id == topic_id)
        .order_by(TopicTemplateDraft.version.desc())
        .first()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="草案不存在")
    return _draft_out(draft)


@router.post("/api/topics/{topic_id}/agent/revise", response_model=TopicDraftOut)
def revise_draft(topic_id: str, payload: TopicReviseRequest, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    latest = (
        db.query(TopicTemplateDraft)
        .filter(TopicTemplateDraft.topic_id == topic_id)
        .order_by(TopicTemplateDraft.version.desc())
        .first()
    )
    new_rules = copy.deepcopy(latest.inferred_rules) if latest else {}
    patch = _sanitize_rule_patch(copy.deepcopy(payload.patch or {}))
    agent_summary = payload.instruction
    instruction_patch = _sanitize_rule_patch(_build_patch_from_instruction(payload.instruction))

    if payload.useDeepSeek:
        conversation = [{"role": msg.role, "content": msg.content} for msg in payload.conversation]
        try:
            ai_result = revise_topic_rules_with_deepseek(
                current_rules=new_rules,
                instruction=payload.instruction,
                conversation=conversation,
            )
        except AgentConfigError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except AgentUpstreamError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        ai_patch = _sanitize_rule_patch(copy.deepcopy(ai_result.get("patch") or {}))
        if instruction_patch:
            _merge_patch(ai_patch, instruction_patch)
        if patch:
            _merge_patch(ai_patch, patch)
        patch = _sanitize_rule_patch(ai_patch)
        agent_summary = (
            ai_result.get("assistantReply")
            or ai_result.get("summary")
            or payload.instruction
        )
    elif not patch:
        patch = instruction_patch

    if patch:
        _merge_patch(new_rules, _sanitize_rule_patch(patch))

    new_draft = TopicTemplateDraft(
        topic_id=topic_id,
        version=(latest.version + 1) if latest else 1,
        status="draft",
        inferred_rules=new_rules,
        confidence_report=copy.deepcopy(latest.confidence_report) if latest else {},
        agent_summary=agent_summary,
    )
    db.add(new_draft)
    db.commit()
    db.refresh(new_draft)
    return _draft_out(new_draft)


@router.post("/api/topics/{topic_id}/confirm-template", response_model=TopicConfirmResponse)
def confirm_template(topic_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    latest_draft = (
        db.query(TopicTemplateDraft)
        .filter(TopicTemplateDraft.topic_id == topic_id)
        .order_by(TopicTemplateDraft.version.desc())
        .first()
    )
    if not latest_draft:
        raise HTTPException(status_code=400, detail="没有可确认的模板草案")

    db.query(TopicTemplate).filter(TopicTemplate.topic_id == topic_id).update(
        {"effective": False}, synchronize_session=False
    )

    latest_template = (
        db.query(TopicTemplate)
        .filter(TopicTemplate.topic_id == topic_id)
        .order_by(TopicTemplate.version.desc())
        .first()
    )
    next_version = (latest_template.version + 1) if latest_template else 1

    template = TopicTemplate(
        topic_id=topic_id,
        version=next_version,
        rules=latest_draft.inferred_rules,
        source_draft_id=latest_draft.id,
        effective=True,
    )
    latest_draft.status = "confirmed"
    db.add(template)
    db.commit()
    db.refresh(template)
    return TopicConfirmResponse(topicId=topic_id, template=_template_out(template))


@router.post("/api/topics/{topic_id}/docs", response_model=IdResponse)
def create_doc_from_topic(topic_id: str, payload: TopicCreateDocRequest, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    if payload.topicTemplateId:
        template = (
            db.query(TopicTemplate)
            .filter(TopicTemplate.id == payload.topicTemplateId, TopicTemplate.topic_id == topic_id)
            .first()
        )
        if not template:
            raise HTTPException(status_code=400, detail="指定题材模板无效")
    else:
        template = (
            db.query(TopicTemplate)
            .filter(TopicTemplate.topic_id == topic_id, TopicTemplate.effective.is_(True))
            .order_by(TopicTemplate.version.desc())
            .first()
        )
        if not template:
            template = (
                db.query(TopicTemplate)
                .filter(TopicTemplate.topic_id == topic_id)
                .order_by(TopicTemplate.version.desc())
                .first()
            )

    title = (payload.title or "").strip() or f"{topic.name}（新建）"
    doc_type = _infer_doc_type(topic.name, payload.docType)

    structured_fields = {
        "title": _resolve_initial_structured_title(template),
        "mainTo": "",
        "signOff": "",
        "docNo": "",
        "signatory": "",
        "copyNo": "",
        "date": "",
        "exportWithRedhead": False,
        "attachments": [],
        "topicId": topic.id,
        "topicName": topic.name,
        "topicTemplateId": template.id if template else None,
        "topicTemplateVersion": template.version if template else None,
        "topicTemplateRules": template.rules if template else None,
    }

    row = Document(
        title=title,
        doc_type=doc_type,
        unit_id=topic.company_id,
        redhead_template_id=None,
        status="draft",
        structured_fields=structured_fields,
        body=_build_doc_body_from_topic_rules(template.rules if template else None),
        import_report=None,
    )
    db.add(row)
    db.commit()
    return IdResponse(id=row.id)


@router.get("/api/topics/{topic_id}/audit-events", response_model=list[DeletionAuditEventOut])
def list_topic_audit_events(topic_id: str, limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    rows = (
        db.query(DeletionAuditEvent)
        .filter(DeletionAuditEvent.topic_id == topic_id)
        .order_by(DeletionAuditEvent.ended_at.desc())
        .limit(limit)
        .all()
    )
    return [_audit_out(row) for row in rows]


@router.get("/api/topics/{topic_id}/templates", response_model=list[TopicTemplateOut])
def list_templates(topic_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(TopicTemplate)
        .filter(TopicTemplate.topic_id == topic_id)
        .order_by(TopicTemplate.version.desc())
        .all()
    )
    return [_template_out(row) for row in rows]


@router.delete("/api/topics/{topic_id}/templates/{template_id}", response_model=ApiMessage)
def delete_topic_template(topic_id: str, template_id: str, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="题材不存在")

    template = (
        db.query(TopicTemplate)
        .filter(TopicTemplate.id == template_id, TopicTemplate.topic_id == topic_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    was_effective = bool(template.effective)
    db.delete(template)
    db.flush()

    if was_effective:
        replacement = (
            db.query(TopicTemplate)
            .filter(TopicTemplate.topic_id == topic_id)
            .order_by(TopicTemplate.version.desc())
            .first()
        )
        if replacement:
            replacement.effective = True

    db.commit()
    return ApiMessage(message="ok")
