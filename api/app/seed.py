"""First-boot catalogue seeding.

Reads ``app/demo_catalog.json`` (built by ``tools/build_demo_catalog.py``) and
creates a starter library plus one playlist per genre, so a freshly deployed
instance is immediately usable.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import config
from .database import SessionLocal
from .models import Playlist, PlaylistTrack, Track

log = logging.getLogger("openbeats.seed")

CATALOG = Path(__file__).resolve().parent / "demo_catalog.json"

# genre -> (playlist name, description, accent colour)
GENRE_PLAYLISTS: dict[str, tuple[str, str, str]] = {
    "Jazz": ("Jazz Essentials", "Loose, late-night grooves and brass.", "#FFB020"),
    "Blues": ("Blues Roots", "Twelve bars straight from the Delta.", "#4FA8FF"),
    "Classical": ("Classical Evenings", "Public-domain orchestral and piano works.", "#7C5CFF"),
    "World": ("World Passport", "Folk and traditional melodies from everywhere.", "#00D3A7"),
    "Eclectic": ("Eclectic Oddities", "The strange, the playful, the unexpected.", "#FF5C8A"),
}

PER_PLAYLIST = 12


def load_catalog() -> list[dict]:
    if not CATALOG.is_file():
        log.warning("Demo catalogue not found at %s — starting with an empty library.", CATALOG)
        return []
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    return payload.get("tracks", [])


def _create_playlists(session: Session) -> int:
    tracks = session.scalars(select(Track)).all()
    if not tracks:
        return 0

    created = 0

    # One playlist per genre.
    for genre, (name, description, accent) in GENRE_PLAYLISTS.items():
        picks = [t for t in tracks if t.genre == genre][:PER_PLAYLIST]
        if not picks:
            continue
        playlist = Playlist(name=name, description=description, accent=accent)
        for position, track in enumerate(picks):
            playlist.items.append(PlaylistTrack(track_id=track.id, position=position))
        session.add(playlist)
        created += 1

    # A cross-genre sampler: one track per album, first N albums.
    sampler: list[Track] = []
    seen_albums: set[str] = set()
    for track in tracks:
        if track.album in seen_albums:
            continue
        seen_albums.add(track.album)
        sampler.append(track)
        if len(sampler) >= 18:
            break

    if sampler:
        playlist = Playlist(
            name="Library Highlights",
            description="One pick from every album in the library.",
            accent="#F5F5F7",
        )
        for position, track in enumerate(sampler):
            playlist.items.append(PlaylistTrack(track_id=track.id, position=position))
        session.add(playlist)
        created += 1

    return created


def seed_if_empty(session: Session, *, force: bool = False) -> dict:
    """Populate the demo catalogue. No-op unless the library is empty."""
    existing = session.scalar(select(func.count(Track.id))) or 0
    if existing and not force:
        return {"seeded": False, "reason": "library is not empty", "tracks": existing}

    if force:
        session.query(PlaylistTrack).delete()
        session.query(Playlist).delete()
        session.query(Track).delete()
        session.commit()

    catalog = load_catalog()
    if not catalog:
        return {"seeded": False, "reason": "catalogue file missing", "tracks": 0}

    log.info("Seeding %d demo tracks…", len(catalog))
    for entry in catalog:
        session.add(
            Track(
                title=entry["title"],
                artist=entry.get("artist") or "Unknown artist",
                album=entry.get("album") or "Unknown album",
                genre=entry.get("genre"),
                track_number=entry.get("track_number"),
                duration=entry.get("duration"),
                source_url=entry["url"],
                mime_type="audio/mpeg",
                attribution=entry.get("attribution"),
            )
        )
    session.flush()
    playlists = _create_playlists(session)
    session.commit()

    log.info("Seeded %d tracks and %d starter playlists.", len(catalog), playlists)
    return {"seeded": True, "tracks": len(catalog), "playlists": playlists}


def seed_on_startup() -> None:
    if not config.SEED_DEMO:
        log.info("SEED_DEMO is disabled — skipping the demo catalogue.")
        return
    session = SessionLocal()
    try:
        log.info("Seed result: %s", seed_if_empty(session))
    except Exception:  # noqa: BLE001 - a bad seed must not stop the API
        log.exception("Seeding failed; the API will start with whatever is in the database.")
    finally:
        session.close()
