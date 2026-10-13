"""The single audio streaming endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..dbblob import blob_size, serve_blob
from ..models import Track, TrackFile
from ..objectstore import audio_key, store
from ..streaming import proxy_remote, serve_local_file

router = APIRouter(tags=["stream"])


@router.get("/stream/{track_id}", summary="Stream a track (supports HTTP Range)")
async def stream(track_id: int, request: Request, db: Session = Depends(get_db)):
    track = db.get(Track, track_id)
    if not track:
        raise HTTPException(status_code=404, detail=f"Track {track_id} not found")

    range_header = request.headers.get("range")

    # Stored inside the database: slice the bytea server-side.
    if track.storage_backend == "database":
        size = blob_size(db, TrackFile.audio, TrackFile.track_id == track.id)
        if size <= 0:
            raise HTTPException(status_code=404, detail="The audio is missing from the database")
        mime = (
            db.execute(select(TrackFile.audio_type).where(TrackFile.track_id == track.id)).scalar()
            or track.mime_type
        )
        return serve_blob(db, TrackFile.audio, TrackFile.track_id == track.id, size, range_header, mime)

    # Uploaded to the object store: let the client stream from there, which keeps
    # this (small, free) instance out of the data path.
    if track.storage_backend == "supabase" and track.file_path:
        return RedirectResponse(store.public_url(audio_key(track.file_path)), status_code=302)

    if track.file_path:
        path = config.MUSIC_DIR / track.file_path
        return serve_local_file(path, range_header, track.mime_type)

    if track.source_url:
        # `?direct=1` 302-redirects straight to the origin — handy while
        # developing locally, since it skips the proxy hop.
        if request.query_params.get("direct") in {"1", "true", "yes"}:
            from fastapi.responses import RedirectResponse

            return RedirectResponse(track.source_url, status_code=302)
        return await proxy_remote(
            request.app.state.http,
            track.source_url,
            range_header,
            fallback_mime=track.mime_type or "audio/mpeg",
        )

    raise HTTPException(status_code=410, detail="This track has no audio source")
