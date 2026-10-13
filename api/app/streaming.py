"""Byte-range aware audio delivery.

The app always plays ``/api/stream/{id}``. That URL either:

* streams a file that was **uploaded** to this server (from ``MUSIC_DIR``), or
* **proxies** a remote ``source_url`` (the demo catalogue lives on Wikimedia
  Commons), forwarding the ``Range`` header upstream so seeking still works and
  so the browser never has to deal with third-party CORS rules.
"""
from __future__ import annotations

import asyncio
import mimetypes
import re
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import httpx
from fastapi import HTTPException
from fastapi.responses import Response, StreamingResponse

CHUNK_SIZE = 512 * 1024
_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")

# Headers we pass through from the upstream host, mapped to canonical casing.
_PASSTHROUGH = {
    "content-length": "Content-Length",
    "content-range": "Content-Range",
    "accept-ranges": "Accept-Ranges",
    "cache-control": "Cache-Control",
    "last-modified": "Last-Modified",
    "etag": "ETag",
}


def guess_mime(path: str | Path, fallback: str = "audio/mpeg") -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or fallback


def parse_range(range_header: str | None, size: int) -> tuple[int, int] | None:
    """Return an inclusive ``(start, end)`` tuple, or ``None`` for a full body."""
    if not range_header:
        return None
    match = _RANGE_RE.match(range_header.strip())
    if not match:
        return None
    raw_start, raw_end = match.group(1), match.group(2)
    if raw_start == "" and raw_end == "":
        return None
    if raw_start == "":  # suffix range: last N bytes
        length = int(raw_end)
        if length <= 0:
            return None
        start = max(0, size - length)
        return start, size - 1
    start = int(raw_start)
    end = int(raw_end) if raw_end else size - 1
    if start >= size:
        raise HTTPException(
            status_code=416,
            detail="Requested range not satisfiable",
            headers={"Content-Range": f"bytes */{size}"},
        )
    end = min(end, size - 1)
    if end < start:
        raise HTTPException(status_code=416, detail="Invalid range")
    return start, end


def _iter_file(path: Path, start: int, end: int) -> Iterator[bytes]:
    remaining = end - start + 1
    with path.open("rb") as fh:
        fh.seek(start)
        while remaining > 0:
            chunk = fh.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


def serve_local_file(path: Path, range_header: str | None, mime: str | None = None) -> Response:
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file is missing on the server")

    size = path.stat().st_size
    content_type = mime or guess_mime(path)
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
    }

    span = parse_range(range_header, size)
    if span is None:
        headers["Content-Length"] = str(size)
        return StreamingResponse(
            _iter_file(path, 0, size - 1), media_type=content_type, headers=headers
        )

    start, end = span
    headers["Content-Length"] = str(end - start + 1)
    headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    return StreamingResponse(
        _iter_file(path, start, end),
        status_code=206,
        media_type=content_type,
        headers=headers,
    )


async def _aproxy_body(response: httpx.Response) -> AsyncIterator[bytes]:
    try:
        async for chunk in response.aiter_bytes(CHUNK_SIZE):
            yield chunk
    finally:
        await response.aclose()


async def proxy_remote(
    client: httpx.AsyncClient,
    url: str,
    range_header: str | None,
    *,
    fallback_mime: str = "audio/mpeg",
    attempts: int = 3,
) -> Response:
    """Stream an upstream URL, preserving ranges and status codes.

    Public audio hosts (Archive.org in particular) occasionally answer 5xx for a
    single node, so transient failures are retried *before* any bytes are sent —
    the retry never corrupts a partially streamed response.
    """
    upstream_headers: dict[str, str] = {}
    if range_header:
        upstream_headers["Range"] = range_header

    last_error = "unknown error"
    for attempt in range(1, attempts + 1):
        request = client.build_request("GET", url, headers=upstream_headers)
        try:
            upstream = await client.send(request, stream=True)
        except httpx.HTTPError as exc:
            last_error = f"transport error: {exc}"
        else:
            if upstream.status_code == 416:
                # A bad client range is the client's problem, not a gateway error.
                headers = {}
                content_range = upstream.headers.get("content-range")
                if content_range:
                    headers["Content-Range"] = content_range
                await upstream.aclose()
                return Response(status_code=416, headers=headers)
            # A permanent client error is not worth retrying.
            if 400 <= upstream.status_code < 500:
                await upstream.aclose()
                raise HTTPException(
                    status_code=502,
                    detail=f"Upstream audio host returned {upstream.status_code}",
                )
            if upstream.status_code < 500:
                headers: dict[str, str] = {}
                for source, target in _PASSTHROUGH.items():
                    value = upstream.headers.get(source)
                    if value:
                        headers[target] = value
                # Hosts sometimes send the media type more than once; keep the first.
                content_type = (upstream.headers.get("content-type") or fallback_mime)
                headers["Content-Type"] = content_type.split(",")[0].strip() or fallback_mime
                headers.setdefault("Accept-Ranges", "bytes")
                headers.setdefault("Cache-Control", "public, max-age=86400")

                return StreamingResponse(
                    _aproxy_body(upstream),
                    status_code=upstream.status_code,
                    headers=headers,
                )
            await upstream.aclose()
            last_error = f"upstream returned {upstream.status_code}"

        if attempt < attempts:
            await asyncio.sleep(0.4 * attempt)

    raise HTTPException(
        status_code=502,
        detail=f"Upstream audio host failed after {attempts} attempts ({last_error})",
    )
