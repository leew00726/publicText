from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Public Text MVP"
    database_url: str = "postgresql+psycopg2://postgres:postgres@postgres:5432/public_text"
    cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174"
    cors_origin_regex: str = r"^https?://(localhost|127\.0\.0\.1):5174$"
    seed_demo_data: bool = False
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket: str = "public-text"
    storage_mode: str = "minio"  # minio | local
    export_dir: str = "/tmp/public-text-exports"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"
    deepseek_timeout_sec: float = 45
    deepseek_temperature: float = 0.2
    deepseek_system_prompt: str = "You are an assistant for Chinese official-document rewriting. Return only rewritten text."

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
