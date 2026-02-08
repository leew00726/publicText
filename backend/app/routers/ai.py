from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/ai", tags=["ai"])


class RewriteRequest(BaseModel):
    text: str
    mode: str = "formal"


@router.post("/rewrite")
def rewrite_api(payload: RewriteRequest):
    return {
        "message": "MVP 预留接口，当前未接入内网模型。",
        "original": payload.text,
        "rewritten": payload.text,
    }
