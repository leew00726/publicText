from __future__ import annotations

import copy
import json
from collections import Counter
from typing import Any

from app.config import Settings, get_settings
from app.services.ai_agent import (
    AgentConfigError,
    AgentUpstreamError,
    DeepSeekAgent,
    _deepseek_chat_endpoint,
    _deepseek_require_api_key,
    _extract_json_object,
)
from app.services.topic_inference import infer_topic_rules


TEMPLATE_LAYOUT_SYSTEM_PROMPT = (
    "你是中文公文 DOCX 模板排版识别助手。"
    " 你的任务是根据每段文本和本地解析出的真实样式，判断段落角色。"
    " 只返回严格 JSON，不要返回 markdown。"
    " 不要编造字体、字号、行距；字体字号由后端按段落索引从本地样式读取。"
)

TITLE_RULE_KEYS = {"fontFamily", "fontSizePt", "bold", "colorHex", "textAlign", "lineSpacingPt"}
ENGINE_RULES = "rules"
ENGINE_HYBRID = "hybrid"
ENGINE_DEEPSEEK = "deepseek"


def _normalize_engine(value: str | None) -> str:
    engine = str(value or "").strip().lower()
    if engine in {ENGINE_RULES, ENGINE_HYBRID, ENGINE_DEEPSEEK}:
        return engine
    return ENGINE_RULES


def _normalize_value(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 2)
    return value


def _summarize_samples(samples: list[dict[str, Any]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    if not samples:
        return summary

    keys = set().union(*(sample.keys() for sample in samples))
    for key in keys:
        values = [_normalize_value(sample.get(key)) for sample in samples if sample.get(key) is not None]
        if values:
            summary[key] = Counter(values).most_common(1)[0][0]
    return summary


def _node_attrs(paragraph: dict[str, Any]) -> dict[str, Any]:
    node = paragraph.get("node")
    attrs = node.get("attrs") if isinstance(node, dict) else None
    return copy.deepcopy(attrs) if isinstance(attrs, dict) else {}


def _title_rules_from_paragraph(paragraph: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(paragraph, dict):
        return {}
    attrs = _node_attrs(paragraph)
    return {key: attrs[key] for key in TITLE_RULE_KEYS if key in attrs and attrs[key] is not None}


def _coerce_index_list(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    indexes: list[int] = []
    for item in value:
        if isinstance(item, bool):
            continue
        if isinstance(item, int):
            indexes.append(item)
        elif isinstance(item, str) and item.strip().isdigit():
            indexes.append(int(item.strip()))
    return indexes


def _paragraph_by_index(feature: dict[str, Any]) -> dict[int, dict[str, Any]]:
    paragraphs = feature.get("_paragraphs")
    if not isinstance(paragraphs, list):
        return {}

    by_index: dict[int, dict[str, Any]] = {}
    for paragraph in paragraphs:
        if not isinstance(paragraph, dict):
            continue
        index = paragraph.get("index")
        if isinstance(index, int) and not isinstance(index, bool):
            by_index[index] = paragraph
    return by_index


def _node_for_paragraph(paragraph: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(paragraph, dict):
        return None
    node = paragraph.get("node")
    return copy.deepcopy(node) if isinstance(node, dict) else None


def _build_content_template_from_roles(
    feature: dict[str, Any],
    role_file: dict[str, Any],
    by_index: dict[int, dict[str, Any]],
) -> dict[str, Any] | None:
    has_explicit_template_roles = "leadingIndexes" in role_file or "trailingIndexes" in role_file
    if not has_explicit_template_roles:
        existing = feature.get("contentTemplate")
        return copy.deepcopy(existing) if isinstance(existing, dict) else None

    leading_nodes = [
        node
        for node in (_node_for_paragraph(by_index.get(index)) for index in _coerce_index_list(role_file.get("leadingIndexes")))
        if node is not None
    ]
    trailing_nodes = [
        node
        for node in (_node_for_paragraph(by_index.get(index)) for index in _coerce_index_list(role_file.get("trailingIndexes")))
        if node is not None
    ]
    if not leading_nodes and not trailing_nodes:
        return None

    return {
        "leadingNodes": leading_nodes,
        "trailingNodes": trailing_nodes,
        "bodyPlaceholder": "（请在此输入正文）",
        "titleMode": "dynamic",
    }


def _feature_from_ai_roles(feature: dict[str, Any], role_file: dict[str, Any]) -> dict[str, Any]:
    by_index = _paragraph_by_index(feature)
    if not by_index:
        raise AgentUpstreamError("DOCX paragraph details are unavailable for DeepSeek template inference.")

    body_samples = [
        paragraph.get("sample") or {}
        for paragraph in (by_index.get(index) for index in _coerce_index_list(role_file.get("bodyIndexes")))
        if isinstance(paragraph, dict)
    ]

    heading_samples: dict[int, list[dict[str, Any]]] = {}
    headings = role_file.get("headings")
    if isinstance(headings, list):
        for item in headings:
            if not isinstance(item, dict):
                continue
            index = item.get("index")
            level = item.get("level")
            if isinstance(index, str) and index.strip().isdigit():
                index = int(index.strip())
            if isinstance(level, str) and level.strip().isdigit():
                level = int(level.strip())
            if not isinstance(index, int) or not isinstance(level, int) or not 1 <= level <= 4:
                continue
            paragraph = by_index.get(index)
            if not isinstance(paragraph, dict):
                continue
            sample = paragraph.get("sample")
            if isinstance(sample, dict):
                heading_samples.setdefault(level, []).append(sample)

    title_index = role_file.get("titleIndex")
    if isinstance(title_index, str) and title_index.strip().isdigit():
        title_index = int(title_index.strip())
    title_paragraph = by_index.get(title_index) if isinstance(title_index, int) else None

    next_feature: dict[str, Any] = {
        "body": _summarize_samples([sample for sample in body_samples if isinstance(sample, dict)]),
        "headings": {f"level{level}": _summarize_samples(samples) for level, samples in heading_samples.items()},
        "page": copy.deepcopy(feature.get("page") or {"marginsCm": {}}),
    }

    title_rules = _title_rules_from_paragraph(title_paragraph)
    if title_rules:
        next_feature["title"] = title_rules

    content_template = _build_content_template_from_roles(feature, role_file, by_index)
    if content_template:
        next_feature["contentTemplate"] = content_template

    if not next_feature["body"] and not next_feature["headings"] and "title" not in next_feature:
        raise AgentUpstreamError("DeepSeek did not identify usable template roles.")
    return next_feature


def apply_deepseek_layout_roles(features_list: list[dict[str, Any]], layout_result: dict[str, Any]) -> list[dict[str, Any]]:
    role_files = layout_result.get("files")
    if not isinstance(role_files, list):
        raise AgentUpstreamError("DeepSeek layout result missing files list.")

    by_file_index: dict[int, dict[str, Any]] = {}
    for role_file in role_files:
        if not isinstance(role_file, dict):
            continue
        file_index = role_file.get("fileIndex")
        if isinstance(file_index, str) and file_index.strip().isdigit():
            file_index = int(file_index.strip())
        if isinstance(file_index, int) and not isinstance(file_index, bool):
            by_file_index[file_index] = role_file

    assisted_features: list[dict[str, Any]] = []
    for file_index, feature in enumerate(features_list):
        role_file = by_file_index.get(file_index)
        if role_file is None:
            assisted_features.append(copy.deepcopy(feature))
            continue
        assisted_features.append(_feature_from_ai_roles(feature, role_file))

    if not assisted_features:
        raise AgentUpstreamError("DeepSeek layout result did not match uploaded files.")
    return assisted_features


def _trim_text(text: Any, max_chars: int = 500) -> str:
    value = str(text or "").strip()
    if len(value) <= max_chars:
        return value
    return f"{value[:max_chars]}..."


def _layout_prompt_payload(features_list: list[dict[str, Any]], max_paragraphs: int) -> dict[str, Any]:
    files: list[dict[str, Any]] = []
    for file_index, feature in enumerate(features_list):
        paragraphs = feature.get("_paragraphs")
        if not isinstance(paragraphs, list):
            paragraphs = []

        payload_paragraphs: list[dict[str, Any]] = []
        for paragraph in paragraphs[:max(max_paragraphs, 1)]:
            if not isinstance(paragraph, dict):
                continue
            sample = paragraph.get("sample") if isinstance(paragraph.get("sample"), dict) else {}
            node = paragraph.get("node") if isinstance(paragraph.get("node"), dict) else {}
            attrs = node.get("attrs") if isinstance(node.get("attrs"), dict) else {}
            payload_paragraphs.append(
                {
                    "index": paragraph.get("index"),
                    "text": _trim_text(paragraph.get("text")),
                    "detectedLevel": paragraph.get("detectedLevel"),
                    "style": {
                        "fontFamily": sample.get("fontFamily"),
                        "fontSizePt": sample.get("fontSizePt"),
                        "lineSpacingPt": sample.get("lineSpacingPt"),
                        "firstLineIndentPt": sample.get("firstLineIndentPt"),
                        "textAlign": attrs.get("textAlign"),
                    },
                }
            )
        files.append({"fileIndex": file_index, "paragraphs": payload_paragraphs})
    return {"files": files}


def classify_template_layout_with_deepseek(
    features_list: list[dict[str, Any]],
    settings: Settings | None = None,
) -> dict[str, Any]:
    cfg = settings or get_settings()
    endpoint = _deepseek_chat_endpoint(cfg.deepseek_base_url)
    agent = DeepSeekAgent(
        api_key=cfg.deepseek_api_key,
        endpoint=endpoint,
        model=cfg.deepseek_model,
        timeout_sec=cfg.deepseek_timeout_sec,
        temperature=min(cfg.deepseek_temperature, 0.2),
        system_prompt=TEMPLATE_LAYOUT_SYSTEM_PROMPT,
        require_api_key=_deepseek_require_api_key(cfg),
    )

    payload = _layout_prompt_payload(features_list, cfg.template_inference_ai_max_paragraphs)
    response = agent.chat(
        messages=[
            {"role": "system", "content": TEMPLATE_LAYOUT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "请判断上传 DOCX 的模板段落角色。返回 JSON 对象，格式如下：\n"
                    "{\n"
                    '  "summary": "简短说明",\n'
                    '  "files": [\n'
                    "    {\n"
                    '      "fileIndex": 0,\n'
                    '      "titleIndex": 1,\n'
                    '      "bodyIndexes": [3, 5],\n'
                    '      "headings": [{"index": 4, "level": 1}],\n'
                    '      "leadingIndexes": [0, 2],\n'
                    '      "trailingIndexes": [6]\n'
                    "    }\n"
                    "  ]\n"
                    "}\n"
                    "规则：\n"
                    "1) titleIndex 是主标题，不是单位名称、密级、期号或签发人行。\n"
                    "2) bodyIndexes 是正文段落，不含标题、期号、主持/参加/发送等尾部名单。\n"
                    "3) headings 用 level 1-4 标明正文内层级标题；会议纪要的“议题一：”“专题A：”通常是 level 1。\n"
                    "4) leadingIndexes 是正文前需要固定保留的模板段落，不含动态主标题。\n"
                    "5) trailingIndexes 是正文后需要固定保留的模板段落。\n"
                    "6) 只能返回段落索引，不要返回或猜测字体字号。\n\n"
                    f"本地解析出的段落和样式：\n{json.dumps(payload, ensure_ascii=False)}"
                ),
            },
        ],
        temperature=0,
    )

    result = _extract_json_object(response["content"])
    files = result.get("files")
    if not isinstance(files, list):
        raise AgentUpstreamError("DeepSeek layout JSON missing valid files list.")
    result["_model"] = response.get("model")
    result["_usage"] = response.get("usage") or {}
    return result


def _copy_base_title_template(ai_rules: dict[str, Any], base_rules: dict[str, Any]) -> None:
    base_title = base_rules.get("title") if isinstance(base_rules.get("title"), dict) else {}
    ai_title = ai_rules.setdefault("title", {})
    if not isinstance(ai_title, dict):
        return

    template_text = base_title.get("templateText") if isinstance(base_title, dict) else None
    if isinstance(template_text, str) and template_text.strip() and not ai_title.get("templateText"):
        ai_title["templateText"] = template_text


def infer_topic_rules_with_optional_deepseek(
    features_list: list[dict[str, Any]],
    settings: Settings | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    cfg = settings or get_settings()
    engine = _normalize_engine(cfg.template_inference_engine)
    base_rules, base_confidence = infer_topic_rules(features_list)

    if engine == ENGINE_RULES:
        base_confidence["templateInference"] = {"engine": ENGINE_RULES, "aiStatus": "disabled"}
        return base_rules, base_confidence

    try:
        layout_result = classify_template_layout_with_deepseek(features_list, settings=cfg)
        assisted_features = apply_deepseek_layout_roles(features_list, layout_result)
        ai_rules, ai_confidence = infer_topic_rules(assisted_features)
        _copy_base_title_template(ai_rules, base_rules)
        ai_confidence["templateInference"] = {
            "engine": ENGINE_DEEPSEEK,
            "aiStatus": "applied",
            "summary": str(layout_result.get("summary") or "").strip(),
            "model": layout_result.get("_model"),
            "usage": layout_result.get("_usage") or {},
        }
        return ai_rules, ai_confidence
    except (AgentConfigError, AgentUpstreamError, ValueError, TypeError, KeyError) as exc:
        if engine == ENGINE_DEEPSEEK:
            if isinstance(exc, (AgentConfigError, AgentUpstreamError)):
                raise
            raise AgentUpstreamError(str(exc)) from exc
        base_confidence["templateInference"] = {
            "engine": ENGINE_RULES,
            "aiStatus": "fallback",
            "fallbackReason": str(exc),
        }
        return base_rules, base_confidence
