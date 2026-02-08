from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from app.config import get_settings


@dataclass
class StoredObject:
    object_name: str
    uri: str


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.mode = self.settings.storage_mode
        self.bucket = self.settings.minio_bucket
        self.local_root = Path(self.settings.export_dir)
        self.local_root.mkdir(parents=True, exist_ok=True)
        self.client: Minio | None = None

        if self.mode == "minio":
            self.client = Minio(
                endpoint=self.settings.minio_endpoint,
                access_key=self.settings.minio_access_key,
                secret_key=self.settings.minio_secret_key,
                secure=self.settings.minio_secure,
            )
            try:
                exists = self.client.bucket_exists(self.bucket)
                if not exists:
                    self.client.make_bucket(self.bucket)
            except S3Error:
                # 启动时 MinIO 尚未就绪时，后续请求重试
                self.client = None

    def _ensure_minio(self) -> Minio:
        if self.client is not None:
            return self.client
        self.client = Minio(
            endpoint=self.settings.minio_endpoint,
            access_key=self.settings.minio_access_key,
            secret_key=self.settings.minio_secret_key,
            secure=self.settings.minio_secure,
        )
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)
        return self.client

    def save_bytes(self, object_name: str, data: bytes, content_type: str = "application/octet-stream") -> StoredObject:
        if self.mode == "minio":
            client = self._ensure_minio()
            bio = io.BytesIO(data)
            client.put_object(
                bucket_name=self.bucket,
                object_name=object_name,
                data=bio,
                length=len(data),
                content_type=content_type,
            )
            return StoredObject(object_name=object_name, uri=f"minio://{self.bucket}/{object_name}")

        # local fallback
        file_path = self.local_root / object_name
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        return StoredObject(object_name=object_name, uri=str(file_path))

    def load_bytes(self, object_name: str) -> bytes:
        if self.mode == "minio":
            client = self._ensure_minio()
            resp = client.get_object(self.bucket, object_name)
            try:
                return resp.read()
            finally:
                resp.close()
                resp.release_conn()

        return (self.local_root / object_name).read_bytes()

    def delete_object(self, object_name: str) -> None:
        if self.mode == "minio":
            client = self._ensure_minio()
            try:
                client.remove_object(self.bucket, object_name)
            except S3Error:
                # 对不存在对象容忍，避免影响主流程
                return
            return

        path = self.local_root / object_name
        if path.exists():
            path.unlink()


storage_service = StorageService()
