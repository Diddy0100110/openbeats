"""Playlist CRUD and ordering. Playlists are shared by everyone."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Playlist, PlaylistTrack, Track
from ..schemas import (
    PlaylistAddTrack,
    PlaylistCreate,
    PlaylistDetail,
    PlaylistOut,
    PlaylistReorder,
    PlaylistUpdate,
    TrackOut,
)

router = APIRouter(prefix="/playlists", tags=["playlists"])


def _load(playlist_id: int, db: Session) -> Playlist:
    playlist = db.scalars(
        select(Playlist)
        .options(selectinload(Playlist.items).selectinload(PlaylistTrack.track))
        .where(Playlist.id == playlist_id)
    ).first()
    if not playlist:
        raise HTTPException(status_code=404, detail=f"Playlist {playlist_id} not found")
    return playlist


def _ordered_items(playlist: Playlist) -> list[PlaylistTrack]:
    return sorted(playlist.items, key=lambda i: (i.position, i.id))


def _detail(playlist: Playlist) -> PlaylistDetail:
    base = PlaylistOut.from_playlist(playlist)
    return PlaylistDetail(
        **base.model_dump(),
        tracks=[TrackOut.from_track(i.track) for i in _ordered_items(playlist) if i.track],
    )


@router.get("", response_model=list[PlaylistOut])
def list_playlists(db: Session = Depends(get_db)):
    playlists = db.scalars(
        select(Playlist)
        .options(selectinload(Playlist.items).selectinload(PlaylistTrack.track))
        .order_by(Playlist.created_at.asc(), Playlist.id.asc())
    ).all()
    return [PlaylistOut.from_playlist(p) for p in playlists]


@router.post("", response_model=PlaylistDetail, status_code=status.HTTP_201_CREATED)
def create_playlist(payload: PlaylistCreate, db: Session = Depends(get_db)):
    playlist = Playlist(
        name=payload.name.strip(),
        description=(payload.description or None),
        accent=payload.accent or "#7C5CFF",
    )
    db.add(playlist)
    db.commit()
    return _detail(_load(playlist.id, db))


@router.get("/{playlist_id}", response_model=PlaylistDetail)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    return _detail(_load(playlist_id, db))


@router.patch("/{playlist_id}", response_model=PlaylistDetail)
def update_playlist(playlist_id: int, payload: PlaylistUpdate, db: Session = Depends(get_db)):
    playlist = _load(playlist_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "name" and value is not None:
            value = value.strip()
        setattr(playlist, field, value)
    db.commit()
    return _detail(_load(playlist_id, db))


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = _load(playlist_id, db)
    db.delete(playlist)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{playlist_id}/tracks", response_model=PlaylistDetail,
             summary="Append a track (idempotent)")
def add_track(playlist_id: int, payload: PlaylistAddTrack, db: Session = Depends(get_db)):
    playlist = _load(playlist_id, db)
    if not db.get(Track, payload.track_id):
        raise HTTPException(status_code=404, detail=f"Track {payload.track_id} not found")

    already = any(i.track_id == payload.track_id for i in playlist.items)
    if not already:
        next_position = max((i.position for i in playlist.items), default=-1) + 1
        playlist.items.append(PlaylistTrack(track_id=payload.track_id, position=next_position))
        db.commit()
    return _detail(_load(playlist_id, db))


@router.delete("/{playlist_id}/tracks/{track_id}", response_model=PlaylistDetail)
def remove_track(playlist_id: int, track_id: int, db: Session = Depends(get_db)):
    playlist = _load(playlist_id, db)
    for item in list(playlist.items):
        if item.track_id == track_id:
            db.delete(item)
    db.commit()
    return _detail(_load(playlist_id, db))


@router.put("/{playlist_id}/order", response_model=PlaylistDetail,
            summary="Replace the playlist with an explicitly ordered set of track ids")
def reorder(playlist_id: int, payload: PlaylistReorder, db: Session = Depends(get_db)):
    playlist = _load(playlist_id, db)

    existing = {i.track_id: i for i in playlist.items}
    for item in list(playlist.items):
        db.delete(item)
    db.flush()

    seen: set[int] = set()
    for position, track_id in enumerate(payload.track_ids):
        if track_id in seen:
            continue
        if track_id not in existing and not db.get(Track, track_id):
            continue
        seen.add(track_id)
        db.add(PlaylistTrack(playlist_id=playlist_id, track_id=track_id, position=position))

    db.commit()
    return _detail(_load(playlist_id, db))
