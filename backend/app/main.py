from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routers import ai, docs, topics, units
from app.seed import seed_data

settings = get_settings()

API_DOMAIN_ALIAS_PREFIXES: list[tuple[str, str]] = [
    ("/api/layout/docs", "/api/docs"),
    ("/api/layout/ai", "/api/ai"),
    ("/api/management/units", "/api/units"),
    ("/api/management/companies", "/api/companies"),
    ("/api/management/topics", "/api/topics"),
]

API_ALIAS_AUDIT_LOCK = Lock()
API_ALIAS_AUDIT = {
    "totals": {"aliasHits": 0, "legacyHits": 0},
    "prefixes": {
        alias_prefix: {"actualPrefix": actual_prefix, "aliasHits": 0, "legacyHits": 0}
        for alias_prefix, actual_prefix in API_DOMAIN_ALIAS_PREFIXES
    },
}


def _match_api_alias_prefix(path: str) -> tuple[str, str] | None:
    for alias_prefix, actual_prefix in API_DOMAIN_ALIAS_PREFIXES:
        if path == alias_prefix or path.startswith(f"{alias_prefix}/"):
            return alias_prefix, "aliasHits"
        if path == actual_prefix or path.startswith(f"{actual_prefix}/"):
            return alias_prefix, "legacyHits"
    return None


def _record_api_alias_audit(path: str) -> None:
    if not path.startswith("/api/"):
        return

    matched = _match_api_alias_prefix(path)
    if not matched:
        return

    alias_prefix, hit_type = matched
    with API_ALIAS_AUDIT_LOCK:
        API_ALIAS_AUDIT["totals"][hit_type] += 1
        API_ALIAS_AUDIT["prefixes"][alias_prefix][hit_type] += 1


def _remap_api_domain_path(path: str) -> str:
    for alias_prefix, actual_prefix in API_DOMAIN_ALIAS_PREFIXES:
        if path == alias_prefix or path.startswith(f"{alias_prefix}/"):
            return f"{actual_prefix}{path[len(alias_prefix):]}"
    return path


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_data(db, enabled=settings.seed_demo_data)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def api_domain_alias_middleware(request, call_next):
    original_path = request.scope.get("path", "")
    _record_api_alias_audit(original_path)
    remapped_path = _remap_api_domain_path(original_path)
    if remapped_path != original_path:
        request.scope["path"] = remapped_path
        request.scope["raw_path"] = remapped_path.encode("utf-8")
    return await call_next(request)


app.include_router(units.router)
app.include_router(docs.router)
app.include_router(ai.router)
app.include_router(topics.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/management/alias-audit")
def get_alias_audit():
    with API_ALIAS_AUDIT_LOCK:
        return {
            "totals": {
                "aliasHits": API_ALIAS_AUDIT["totals"]["aliasHits"],
                "legacyHits": API_ALIAS_AUDIT["totals"]["legacyHits"],
            },
            "prefixes": {
                alias_prefix: {
                    "actualPrefix": prefix_state["actualPrefix"],
                    "aliasHits": prefix_state["aliasHits"],
                    "legacyHits": prefix_state["legacyHits"],
                }
                for alias_prefix, prefix_state in API_ALIAS_AUDIT["prefixes"].items()
            },
        }


assets_path = Path(__file__).resolve().parent.parent / "assets"
app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")
