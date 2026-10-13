"""The single audio streaming endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..models import Track
from ..streaming import proxy_remote, serve_local_file

router = APIRouter(tags=["stream"])


@router.get("/stream/{track_id}", summary="Stream a track (supports HTTP Range)")
async def stream(track_id: int, request: Request, db: Session = Depends(get_db)):
    track = db.get(Track, track_id)
    if not track:
        raise HTTPException(status_code=404, detail=f"Track {track_id} not found")

    range_header = request.headers.get("range")

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
