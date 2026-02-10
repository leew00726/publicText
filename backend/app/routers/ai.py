from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ai_agent import AgentConfigError, AgentUpstreamError, rewrite_with_deepseek

router = APIRouter(prefix="/api/ai", tags=["ai"])


class RewriteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    mode: Literal["formal", "concise", "polish"] = "formal"


@router.post("/rewrite")
def rewrite_api(payload: RewriteRequest):
    try:
        result = rewrite_with_deepseek(payload.text, payload.mode)
    except AgentConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "message": "ok",
        "provider": "deepseek",
        "model": result["model"],
        "usage": result["usage"],
        "mode": payload.mode,
        "original": payload.text,
        "rewritten": result["text"],
    }
