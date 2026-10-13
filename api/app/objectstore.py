"""Supabase Storage backend.

Audio and cover art live in a Supabase bucket so they survive deploys, while the
ephemeral Render disk is only a scratch area. The REST API is used directly, so
no extra SDK is needed.

When `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` are unset the store reports itself
as disabled and everything falls back to the local disk, which is what local
development uses.
"""
from __future__ import annotations

import logging

import httpx

from . import config

log = logging.getLogger("openbeats.storage")

_TIMEOUT = httpx.Timeout(60.0, connect=15.0)


class ObjectStore:
    def __init__(self, url: str, service_key: str, bucket: str) -> None:
        self.url = url.rstrip("/")
        self.service_key = service_key
        self.bucket = bucket

    @property
    def enabled(self) -> bool:
        return bool(self.url and self.service_key)

    def _headers(self, content_type: str | None = None) -> dict[str, str]:
        """Auth headers for the Storage REST API.

        Supabase accepts the key on `apikey`, and legacy JWT keys on
        `Authorization: Bearer`. New `sb_secret_…` keys are *not* JWTs, so both
        headers are sent — that way either key type works.
        """
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def ensure_bucket(self) -> bool:
        """Create the bucket once, if it does not exist. Never raises."""
        if not self.enabled:
            return False

        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                existing = client.get(
                    f"{self.url}/storage/v1/bucket/{self.bucket}",
                    headers=self._headers(),
                )
                if existing.status_code == 200:
                    return True

                created = client.post(
                    f"{self.url}/storage/v1/bucket",
                    headers=self._headers("application/json"),
                    json={"id": self.bucket, "name": self.bucket, "public": True},
                )
                if created.status_code in (200, 201):
                    log.info("Created Supabase bucket %r", self.bucket)
                    return True

                log.warning(
                    "Could not create bucket %r: %s %s",
                    self.bucket,
                    created.status_code,
                    created.text[:200],
                )
        except httpx.HTTPError as exc:
            log.warning("Supabase unreachable while ensuring bucket: %s", exc)

        return False

    def put(self, path: str, data: bytes, content_type: str) -> bool:
        """Upload (or overwrite) an object. Returns True on success."""
        if not self.enabled:
            return False

        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                response = client.post(
                    f"{self.url}/storage/v1/object/{self.bucket}/{path}",
                    headers={**self._headers(content_type), "x-upsert": "true"},
                    content=data,
                )
            if response.status_code in (200, 201):
                return True
            log.warning(
                "Supabase upload failed for %s: %s %s",
                path,
                response.status_code,
                response.text[:200],
            )
        except httpx.HTTPError as exc:
            log.warning("Supabase upload error for %s: %s", path, exc)

        return False

    def delete(self, path: str) -> None:
        if not self.enabled:
            return
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                client.delete(
                    f"{self.url}/storage/v1/object/{self.bucket}/{path}",
                    headers=self._headers(),
                )
        except httpx.HTTPError as exc:
            log.warning("Supabase delete error for %s: %s", path, exc)

    def public_url(self, path: str) -> str:
        return f"{self.url}/storage/v1/object/public/{self.bucket}/{path}"

    def status(self) -> dict[str, object]:
        if not self.enabled:
            return {"backend": "local", "configured": False}
        return {
            "backend": "supabase",
            "configured": True,
            "url": self.url,
            "bucket": self.bucket,
        }


store = ObjectStore(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, config.SUPABASE_BUCKET)


def audio_key(name: str) -> str:
    """Object key for an audio file."""
    return f"audio/{name}"


def artwork_key(name: str) -> str:
    """Object key for a cover image."""
    return f"artwork/{name}"
