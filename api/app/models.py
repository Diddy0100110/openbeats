"""Database models. A single shared, account-less music library."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    title: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    artist: Mapped[str] = mapped_column(String(300), default="Unknown artist", index=True)
    album: Mapped[str] = mapped_column(String(300), default="Unknown album", index=True)
    genre: Mapped[str | None] = mapped_column(String(120), index=True)
    year: Mapped[int | None] = mapped_column(Integer)

    duration: Mapped[float | None] = mapped_column(Float)  # seconds
    track_number: Mapped[int | None] = mapped_column(Integer)

    # Where the audio lives: exactly one of these is set.
    file_path: Mapped[str | None] = mapped_column(String(500))  # relative to MUSIC_DIR
    source_url: Mapped[str | None] = mapped_column(Text)  # remote stream

    mime_type: Mapped[str] = mapped_column(String(100), default="audio/mpeg")
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    # Where the audio and its cover live: "local" (ephemeral disk) or "supabase".
    storage_backend: Mapped[str] = mapped_column(String(20), default="local")
    # Cover art extracted at upload time, stored as its own file.
    artwork_path: Mapped[str | None] = mapped_column(String(300))
    has_artwork: Mapped[bool] = mapped_column(default=False)
    lyrics: Mapped[str | None] = mapped_column(Text)
    # e.g. "Kevin MacLeod — incompetech.com — CC BY 4.0"
    attribution: Mapped[str | None] = mapped_column(String(400))

    plays: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    links: Mapped[list["PlaylistTrack"]] = relationship(
        back_populates="track", cascade="all, delete-orphan"
    )
    file: Mapped["TrackFile | None"] = relationship(
        back_populates="track", cascade="all, delete-orphan", uselist=False
    )

    @property
    def origin(self) -> str:
        return "upload" if self.file_path else "remote"


class TrackFile(Base):
    """Audio and cover art stored *inside* the database.

    Chosen when a Postgres database is configured but no Supabase Storage bucket
    is, so uploads survive deploys with a single credential. Blobs live in their
    own table, so listing the library never loads them.
    """

    __tablename__ = "track_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), unique=True, index=True
    )

    audio: Mapped[bytes | None] = mapped_column(LargeBinary)
    audio_type: Mapped[str] = mapped_column(String(100), default="audio/mpeg")
    artwork: Mapped[bytes | None] = mapped_column(LargeBinary)
    artwork_type: Mapped[str | None] = mapped_column(String(100))

    track: Mapped[Track] = relationship(back_populates="file")


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    accent: Mapped[str] = mapped_column(String(20), default="#7C5CFF")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    items: Mapped[list["PlaylistTrack"]] = relationship(
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="PlaylistTrack.position",
    )


class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"
    __table_args__ = (UniqueConstraint("playlist_id", "track_id", name="uq_playlist_track"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[int] = mapped_column(
        ForeignKey("playlists.id", ondelete="CASCADE"), index=True
    )
    track_id: Mapped[int] = mapped_column(
        ForeignKey("tracks.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)

    added_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    playlist: Mapped[Playlist] = relationship(back_populates="items")
    track: Mapped[Track] = relationship(back_populates="links")
