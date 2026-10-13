"""Serve a binary column from the database with HTTP Range support.

Used when audio and cover art are stored inside Postgres (`track_files`). The
slicing happens **in the database** — `substr(bytea, from, count)` — so a seek
only pulls the requested bytes over the network instead of the whole track.
"""
from __future__ import annotations

from fastapi import HTTPException
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .streaming import parse_range


def serve_blob(
    db: Session,
    column,
    where,
    total_size: int,
    range_header: str | None,
    mime: str,
    *,
    cache_seconds: int = 86_400,
) -> Response:
    if total_size <= 0:
        raise HTTPException(status_code=404, detail="The stored file is empty")

    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": f"public, max-age={cache_seconds}",
    }

    span = parse_range(range_header, total_size)

    if span is None:
        data = db.execute(select(column).where(where)).scalar() or b""
        headers["Content-Length"] = str(len(data))
        return Response(content=data, media_type=mime, headers=headers)

    start, end = span
    length = end - start + 1
    # Postgres is 1-based for substr().
    chunk = (
        db.execute(select(func.substr(column, start + 1, length)).where(where)).scalar() or b""
    )

    headers["Content-Length"] = str(len(chunk))
    headers["Content-Range"] = f"bytes {start}-{end}/{total_size}"
    return Response(content=chunk, status_code=206, media_type=mime, headers=headers)


def blob_size(db: Session, column, where) -> int:
    """Length in bytes without transferring the blob."""
    return int(db.execute(select(func.octet_length(column)).where(where)).scalar() or 0)
