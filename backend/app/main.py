from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routers import ai, docs, redhead_templates, topics, units
from app.seed import seed_data

settings = get_settings()


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

app.include_router(units.router)
app.include_router(redhead_templates.router)
app.include_router(docs.router)
app.include_router(ai.router)
app.include_router(topics.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


assets_path = Path(__file__).resolve().parent.parent / "assets"
app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")
