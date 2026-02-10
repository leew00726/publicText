from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
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
        payload = {
            "model": self.model,
            "temperature": self.temperature,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {
                    "role": "user",
                    "content": f"Rewrite mode: {mode}\nRequirements: {mode_guide}\n\nSource text:\n{text}",
                },
            ],
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
            with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
                raw = resp.read().decode("utf-8")
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
            "text": content,
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
