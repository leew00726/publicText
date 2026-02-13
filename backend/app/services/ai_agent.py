from __future__ import annotations

import json
import re
import socket
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Any

from app.config import Settings, get_settings


class AgentConfigError(RuntimeError):
    """Raised when runtime config is incomplete for upstream agent calls."""


class AgentUpstreamError(RuntimeError):
    """Raised when upstream agent returns invalid/failed responses."""


MODE_GUIDANCE: dict[str, str] = {
    "formal": "Keep a formal government-writing tone and do not change the original meaning.",
    "concise": "Reduce redundancy while preserving all key information and formal tone.",
    "polish": "Improve sentence flow and clarity while preserving formal tone and meaning.",
}

TOPIC_REVISION_SYSTEM_PROMPT = (
    "You are an assistant for Chinese official-document template styling."
    " Convert user intent into a minimal JSON patch for template rules."
    " Return strict JSON only, no markdown."
)

_REQUEST_EXECUTOR = ThreadPoolExecutor(max_workers=8)


def _send_request(req: urllib.request.Request, timeout_sec: float) -> str:
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        return resp.read().decode("utf-8")


class DeepSeekAgent:
    def __init__(
        self,
        api_key: str,
        endpoint: str,
        model: str,
        timeout_sec: float,
        temperature: float = 0.2,
        system_prompt: str | None = None,
    ):
        self.api_key = api_key.strip()
        self.endpoint = endpoint
        self.model = model
        self.timeout_sec = timeout_sec
        self.temperature = temperature
        self.system_prompt = (
            system_prompt
            or "You are an assistant for Chinese official-document rewriting. Return only the final rewritten text."
        )

    def rewrite(self, text: str, mode: str) -> dict[str, Any]:
        if not self.api_key:
            raise AgentConfigError("DeepSeek API key is missing. Set DEEPSEEK_API_KEY.")
        if not text.strip():
            raise AgentConfigError("Rewrite text cannot be empty.")

        mode_guide = MODE_GUIDANCE.get(mode, MODE_GUIDANCE["formal"])
        response = self.chat(
            messages=[
                {"role": "system", "content": self.system_prompt},
                {
                    "role": "user",
                    "content": f"Rewrite mode: {mode}\nRequirements: {mode_guide}\n\nSource text:\n{text}",
                },
            ],
            temperature=self.temperature,
        )
        return {
            "text": response["content"],
            "model": response["model"],
            "usage": response["usage"],
        }

    def chat(self, messages: list[dict[str, str]], temperature: float | None = None) -> dict[str, Any]:
        if not self.api_key:
            raise AgentConfigError("DeepSeek API key is missing. Set DEEPSEEK_API_KEY.")
        if not messages:
            raise AgentConfigError("DeepSeek chat messages cannot be empty.")

        payload = {
            "model": self.model,
            "temperature": self.temperature if temperature is None else temperature,
            "messages": messages,
            "stream": False,
        }

        req = urllib.request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )

        try:
            future = _REQUEST_EXECUTOR.submit(_send_request, req, self.timeout_sec)
            raw = future.result(timeout=self.timeout_sec + 2)
        except FutureTimeoutError as exc:
            future.cancel()
            raise AgentUpstreamError(
                f"DeepSeek request timed out after {self.timeout_sec:.0f}s. "
                "Please check backend network/proxy reachability."
            ) from exc
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise AgentUpstreamError(f"DeepSeek HTTP {exc.code}: {detail or exc.reason}") from exc
        except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
            raise AgentUpstreamError(f"DeepSeek request failed: {exc}") from exc

        try:
            body = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AgentUpstreamError("DeepSeek returned non-JSON payload.") from exc

        choices = body.get("choices") or []
        if not choices:
            raise AgentUpstreamError("DeepSeek returned empty choices.")

        msg = choices[0].get("message") or {}
        content = (msg.get("content") or "").strip()
        if not content:
            raise AgentUpstreamError("DeepSeek returned empty content.")

        return {
            "content": content,
            "model": body.get("model") or self.model,
            "usage": body.get("usage") or {},
        }


def rewrite_with_deepseek(text: str, mode: str, settings: Settings | None = None) -> dict[str, Any]:
    cfg = settings or get_settings()
    base_url = cfg.deepseek_base_url.rstrip("/")
    endpoint = f"{base_url}/chat/completions"
    agent = DeepSeekAgent(
        api_key=cfg.deepseek_api_key,
        endpoint=endpoint,
        model=cfg.deepseek_model,
        timeout_sec=cfg.deepseek_timeout_sec,
        temperature=cfg.deepseek_temperature,
        system_prompt=cfg.deepseek_system_prompt,
    )
    return agent.rewrite(text=text, mode=mode)


def _extract_json_object(raw_content: str) -> dict[str, Any]:
    content = (raw_content or "").strip()
    if not content:
        raise AgentUpstreamError("DeepSeek returned empty content.")

    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", content, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        content = fenced.group(1).strip()

    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    first = content.find("{")
    last = content.rfind("}")
    if first == -1 or last <= first:
        raise AgentUpstreamError("DeepSeek did not return valid JSON object.")

    try:
        parsed = json.loads(content[first : last + 1])
    except json.JSONDecodeError as exc:
        raise AgentUpstreamError("DeepSeek returned malformed JSON for template patch.") from exc

    if not isinstance(parsed, dict):
        raise AgentUpstreamError("DeepSeek JSON payload must be an object.")
    return parsed


def revise_topic_rules_with_deepseek(
    current_rules: dict[str, Any],
    instruction: str,
    conversation: list[dict[str, str]] | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    cfg = settings or get_settings()
    base_url = cfg.deepseek_base_url.rstrip("/")
    endpoint = f"{base_url}/chat/completions"
    agent = DeepSeekAgent(
        api_key=cfg.deepseek_api_key,
        endpoint=endpoint,
        model=cfg.deepseek_model,
        timeout_sec=cfg.deepseek_timeout_sec,
        temperature=cfg.deepseek_temperature,
        system_prompt=cfg.deepseek_system_prompt,
    )

    cleaned_history: list[dict[str, str]] = []
    for item in conversation or []:
        role = (item.get("role") or "").strip()
        content = (item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        cleaned_history.append({"role": role, "content": content})

    messages = [{"role": "system", "content": TOPIC_REVISION_SYSTEM_PROMPT}]
    messages.extend(cleaned_history[-12:])

    messages.append(
        {
            "role": "user",
            "content": (
                "请根据当前模板规则和最新修订指令，给出最小变更补丁。\n"
                "输出必须是 JSON 对象，且仅包含以下字段：\n"
                '{\n  "assistantReply": "给用户的简短回复",\n  "summary": "用于草稿摘要的简短文本",\n  "patch": { ... }\n}\n'
                "要求：\n"
                "1) patch 仅包含需要修改的字段（diff），不要返回完整规则。\n"
                "2) 未提及的字段不要改。\n"
                "3) 无法确定时 patch 返回空对象 {} 并在 assistantReply 说明原因。\n"
                f"当前模板规则（JSON）:\n{json.dumps(current_rules, ensure_ascii=False)}\n\n"
                f"最新指令:\n{instruction.strip()}"
            ),
        }
    )

    chat_result = agent.chat(messages=messages, temperature=0.1)
    payload = _extract_json_object(chat_result["content"])

    patch = payload.get("patch")
    if not isinstance(patch, dict):
        raise AgentUpstreamError("DeepSeek JSON payload missing valid 'patch' object.")

    assistant_reply = str(payload.get("assistantReply") or "").strip()
    summary = str(payload.get("summary") or "").strip()

    return {
        "patch": patch,
        "assistantReply": assistant_reply,
        "summary": summary,
        "model": chat_result.get("model"),
        "usage": chat_result.get("usage") or {},
        "raw": payload,
    }
