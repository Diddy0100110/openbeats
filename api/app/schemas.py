"""Pydantic v2 request/response models."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import Playlist, Track


# ---------------------------------------------------------------------------
# Tracks
# ---------------------------------------------------------------------------
class TrackOut(BaseModel):
    id: int
    title: str
    artist: str
    album: str
    genre: str | None = None
    year: int | None = None
    duration: float | None = None
    track_number: int | None = None
    mime_type: str
    size_bytes: int | None = None
    has_artwork: bool = False
    plays: int = 0
    origin: str
    attribution: str | None = None
    lyrics: str | None = None
    created_at: datetime | None = None

    # Convenience URLs (relative; the client prefixes its API base).
    stream_url: str
    artwork_url: str | None = None

    @classmethod
    def from_track(cls, track: Track, *, include_lyrics: bool = False) -> "TrackOut":
        return cls(
            id=track.id,
            title=track.title,
            artist=track.artist,
            album=track.album,
            genre=track.genre,
            year=track.year,
            duration=track.duration,
            track_number=track.track_number,
            mime_type=track.mime_type,
            size_bytes=track.size_bytes,
            has_artwork=bool(track.has_artwork),
            plays=track.plays,
            origin=track.origin,
            attribution=track.attribution,
            lyrics=track.lyrics if include_lyrics else None,
            created_at=track.created_at,
            stream_url=f"/api/stream/{track.id}",
            artwork_url=f"/api/tracks/{track.id}/artwork" if track.has_artwork else None,
        )


class TrackPage(BaseModel):
    items: list[TrackOut]
    total: int
    limit: int
    offset: int


class TrackUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    artist: str | None = Field(default=None, max_length=300)
    album: str | None = Field(default=None, max_length=300)
    genre: str | None = Field(default=None, max_length=120)
    year: int | None = None
    track_number: int | None = None
    lyrics: str | None = None
    attribution: str | None = Field(default=None, max_length=400)


class DurationReport(BaseModel):
    """The client tells us the real duration once the player knows it."""

    duration: float = Field(gt=0, le=60 * 60 * 6)


# ---------------------------------------------------------------------------
# Playlists
# ---------------------------------------------------------------------------
class PlaylistOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    accent: str = "#7C5CFF"
    track_count: int = 0
    total_duration: float | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_playlist(cls, playlist: Playlist) -> "PlaylistOut":
        durations = [i.track.duration or 0 for i in playlist.items if i.track]
        return cls(
            id=playlist.id,
            name=playlist.name,
            description=playlist.description,
            accent=playlist.accent,
            track_count=len(playlist.items),
            total_duration=sum(durations),
            created_at=playlist.created_at,
            updated_at=playlist.updated_at,
        )


class PlaylistDetail(PlaylistOut):
    tracks: list[TrackOut] = []


class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    accent: str | None = Field(default=None, max_length=20)


class PlaylistUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    accent: str | None = Field(default=None, max_length=20)


class PlaylistAddTrack(BaseModel):
    track_id: int


class PlaylistReorder(BaseModel):
    """Full, ordered list of track ids that should make up the playlist."""

    track_ids: list[int]


# ---------------------------------------------------------------------------
# Facets / stats
# ---------------------------------------------------------------------------
class GroupCount(BaseModel):
    name: str
    track_count: int
    total_duration: float | None = None


class Facets(BaseModel):
    artists: list[GroupCount]
    albums: list[GroupCount]
    genres: list[GroupCount]


class Stats(BaseModel):
    tracks: int
    albums: int
    artists: int
    playlists: int
    total_duration: float
    total_plays: int


class Health(BaseModel):
    status: str = "ok"
    app: str
    version: str
    storage: str


class UploadResult(BaseModel):
    track: TrackOut
    model_config = ConfigDict(arbitrary_types_allowed=True)
