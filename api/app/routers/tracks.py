"""Track library: listing, search, facets, uploads and metadata editing."""
from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..models import Track
from ..schemas import DurationReport, Facets, GroupCount, Stats, TrackOut, TrackPage, TrackUpdate

log = logging.getLogger("openbeats.tracks")

router = APIRouter(prefix="/tracks", tags=["tracks"])

SORTABLE = {
    "title": Track.title,
    "artist": Track.artist,
    "album": Track.album,
    "genre": Track.genre,
    "duration": Track.duration,
    "plays": Track.plays,
    "created": Track.created_at,
    "year": Track.year,
}


def _get_track(track_id: int, db: Session) -> Track:
    track = db.get(Track, track_id)
    if not track:
        raise HTTPException(status_code=404, detail=f"Track {track_id} not found")
    return track


@router.get("", response_model=TrackPage, summary="List / search tracks")
def list_tracks(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Free-text search over title, artist and album"),
    artist: str | None = None,
    album: str | None = None,
    genre: str | None = None,
    ids: str | None = Query(None, description="Comma-separated track ids (preserves order)"),
    sort: str = Query("title", description=f"One of: {', '.join(SORTABLE)}"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    stmt = select(Track)

    if ids:
        wanted = [int(i) for i in ids.split(",") if i.strip().isdigit()]
        if not wanted:
            return TrackPage(items=[], total=0, limit=limit, offset=offset)
        rows = db.scalars(select(Track).where(Track.id.in_(wanted))).all()
        by_id = {t.id: t for t in rows}
        ordered = [by_id[i] for i in wanted if i in by_id]
        return TrackPage(
            items=[TrackOut.from_track(t) for t in ordered],
            total=len(ordered),
            limit=limit,
            offset=offset,
        )

    if q:
        needle = f"%{q.strip()}%"
        stmt = stmt.where(
            Track.title.ilike(needle) | Track.artist.ilike(needle) | Track.album.ilike(needle)
        )
    if artist:
        stmt = stmt.where(Track.artist == artist)
    if album:
        stmt = stmt.where(Track.album == album)
    if genre:
        stmt = stmt.where(Track.genre == genre)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    column = SORTABLE.get(sort, Track.title)
    ordering = column.desc() if order == "desc" else column.asc()
    stmt = stmt.order_by(ordering, Track.id.asc()).limit(limit).offset(offset)

    items = [TrackOut.from_track(t) for t in db.scalars(stmt).all()]
    return TrackPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/facets", response_model=Facets, summary="Artists / albums / genres with counts")
def facets(db: Session = Depends(get_db)):
    def group(column, limit: int) -> list[GroupCount]:
        rows = db.execute(
            select(
                column,
                func.count(Track.id),
                func.coalesce(func.sum(Track.duration), 0.0),
            )
            .where(column.is_not(None), column != "")
            .group_by(column)
            .order_by(func.count(Track.id).desc(), column.asc())
            .limit(limit)
        ).all()
        return [
            GroupCount(name=str(name), track_count=count, total_duration=float(duration or 0))
            for name, count, duration in rows
        ]

    return Facets(
        artists=group(Track.artist, 200),
        albums=group(Track.album, 200),
        genres=group(Track.genre, 100),
    )


@router.get("/stats", response_model=Stats, summary="Library totals")
def stats(db: Session = Depends(get_db)):
    from ..models import Playlist

    def distinct_count(column) -> int:
        return db.scalar(select(func.count(func.distinct(column))).where(column.is_not(None))) or 0

    return Stats(
        tracks=db.scalar(select(func.count(Track.id))) or 0,
        albums=distinct_count(Track.album),
        artists=distinct_count(Track.artist),
        playlists=db.scalar(select(func.count(Playlist.id))) or 0,
        total_duration=float(db.scalar(select(func.coalesce(func.sum(Track.duration), 0.0))) or 0),
        total_plays=int(db.scalar(select(func.coalesce(func.sum(Track.plays), 0))) or 0),
    )


@router.post("/upload", response_model=TrackOut, status_code=status.HTTP_201_CREATED,
             summary="Upload an audio file (multipart/form-data)")
def upload_track(
    db: Session = Depends(get_db),
    file: UploadFile = File(..., description="The audio file"),
    title: str | None = Form(None),
    artist: str | None = Form(None),
    album: str | None = Form(None),
    genre: str | None = Form(None),
):
    original = Path(file.filename or "upload")
    suffix = original.suffix.lower()
    if suffix not in config.ALLOWED_AUDIO_EXT:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported extension '{suffix}'. Allowed: {sorted(config.ALLOWED_AUDIO_EXT)}",
        )

    stored_name = f"{uuid.uuid4().hex}{suffix}"
    destination = config.MUSIC_DIR / stored_name

    try:
        with destination.open("wb") as out:
            shutil.copyfileobj(file.file, out, length=1024 * 1024)
    finally:
        file.file.close()

    max_bytes = config.MAX_UPLOAD_MB * 1024 * 1024
    size = destination.stat().st_size
    if size == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if size > max_bytes:
        destination.unlink(missing_ok=True)
        raise HTTPException(
            status_code=413,
            detail=f"File is {size / 1048576:.1f} MB; the limit is {config.MAX_UPLOAD_MB} MB",
        )

    # ---- read what metadata we can -----------------------------------------
    duration = None
    has_artwork = False
    probed: dict[str, str] = {}
    try:
        import mutagen

        audio = mutagen.File(destination)
        if audio is not None:
            duration = float(audio.info.length) if getattr(audio, "info", None) else None
            easy = mutagen.File(destination, easy=True) or {}
            for key in ("title", "artist", "album", "genre"):
                value = (easy.get(key) or [None])[0] if hasattr(easy, "get") else None
                if value:
                    probed[key] = str(value)
            if isinstance(getattr(audio, "tags", None), dict):
                has_artwork = any("APIC" in str(k) or "covr" in str(k) for k in audio.tags)
            else:
                has_artwork = any(
                    k.startswith("APIC") or str(getattr(k, "FrameID", "")) == "APIC"
                    for k in (audio.tags or {})
                )
    except Exception as exc:  # noqa: BLE001
        log.warning("metadata probe failed for %s: %s", stored_name, exc)

    track = Track(
        title=(title or probed.get("title") or original.stem).strip(),
        artist=(artist or probed.get("artist") or "Unknown artist").strip(),
        album=(album or probed.get("album") or "Unknown album").strip(),
        genre=(genre or probed.get("genre") or None),
        file_path=stored_name,
        mime_type=file.content_type or "audio/mpeg",
        duration=duration,
        size_bytes=size,
        has_artwork=has_artwork,
        attribution="Uploaded by a user of this library",
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    log.info("Uploaded track %s (%s, %.1f MB)", track.id, track.title, size / 1048576)
    return TrackOut.from_track(track, include_lyrics=True)


@router.get("/{track_id}", response_model=TrackOut)
def get_track(track_id: int, db: Session = Depends(get_db)):
    return TrackOut.from_track(_get_track(track_id, db), include_lyrics=True)


@router.patch("/{track_id}", response_model=TrackOut)
def update_track(track_id: int, payload: TrackUpdate, db: Session = Depends(get_db)):
    track = _get_track(track_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(track, field, value)
    db.commit()
    db.refresh(track)
    return TrackOut.from_track(track, include_lyrics=True)


@router.post("/{track_id}/play", response_model=TrackOut, summary="Register a play")
def register_play(track_id: int, db: Session = Depends(get_db)):
    track = _get_track(track_id, db)
    track.plays = (track.plays or 0) + 1
    db.commit()
    db.refresh(track)
    return TrackOut.from_track(track)


@router.post("/{track_id}/duration", response_model=TrackOut,
             summary="Let the client back-fill a duration it discovered")
def report_duration(track_id: int, payload: DurationReport, db: Session = Depends(get_db)):
    track = _get_track(track_id, db)
    if not track.duration:
        track.duration = payload.duration
        db.commit()
        db.refresh(track)
    return TrackOut.from_track(track)


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_track(track_id: int, db: Session = Depends(get_db)):
    track = _get_track(track_id, db)
    if track.file_path:
        (config.MUSIC_DIR / track.file_path).unlink(missing_ok=True)
    db.delete(track)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{track_id}/artwork", summary="Embedded cover art (404 when there is none)")
def get_artwork(track_id: int, db: Session = Depends(get_db)):
    track = _get_track(track_id, db)
    if not track.file_path or not track.has_artwork:
        raise HTTPException(status_code=404, detail="This track has no embedded artwork")

    path = config.MUSIC_DIR / track.file_path
    try:
        import mutagen

        audio = mutagen.File(path)
        picture = None
        for key in (audio.tags or {}):
            frame_id = str(getattr(key, "FrameID", key))
            if frame_id == "APIC":
                picture = audio.tags[key]
                break
            if key == "covr" and audio.tags[key]:
                data = bytes(audio.tags[key][0])
                return Response(content=data, media_type="image/jpeg")
        if picture is not None:
            return Response(content=bytes(picture.data), media_type=picture.mime or "image/jpeg")
    except Exception as exc:  # noqa: BLE001
        log.warning("artwork extraction failed for track %s: %s", track_id, exc)

    raise HTTPException(status_code=404, detail="Artwork could not be read")
