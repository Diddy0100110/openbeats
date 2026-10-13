"""Reading and storing embedded cover art.

Cover art is extracted **once, at upload time**, and written next to the audio as
its own file. Serving a plain file is faster and far more robust than re-parsing
tags on every request.
"""
from __future__ import annotations

import base64
import logging
import uuid
from pathlib import Path

log = logging.getLogger("openbeats.artwork")

_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
}
_DEFAULT_EXT = ".jpg"


def _normalise_mime(mime: str | None) -> str:
    cleaned = (mime or "").split(";")[0].strip().lower()
    if cleaned in {"image/jpg", "image/pjpeg"}:
        return "image/jpeg"
    return cleaned if cleaned.startswith("image/") else "image/jpeg"


def artwork_extension(mime: str) -> str:
    return _EXTENSIONS.get(_normalise_mime(mime), _DEFAULT_EXT)


def artwork_filename(mime: str) -> str:
    return f"{uuid.uuid4().hex}{artwork_extension(mime)}"


def extract_artwork(path: Path) -> tuple[bytes, str] | None:
    """Return ``(bytes, mime)`` for the first embedded picture, or ``None``.

    Handles the four containers we accept: MP3 (ID3 ``APIC``), MP4/M4A
    (``covr``), FLAC (picture blocks) and Ogg (``metadata_block_picture``).
    """
    try:
        import mutagen
    except ImportError:  # pragma: no cover - mutagen is a hard dependency
        return None

    try:
        audio = mutagen.File(path)
    except Exception as exc:  # noqa: BLE001 - unreadable tags are not fatal
        log.warning("Could not open %s for artwork: %s", path.name, exc)
        return None

    if audio is None:
        return None

    tags = audio.tags

    # --- MP3 / ID3 --------------------------------------------------------
    # Keys are "APIC" plus an optional description ("APIC:", "APIC:Cover"), so
    # match on the frame type rather than the key. This was the original bug:
    # comparing the key to "APIC" never matched a real file.
    try:
        if tags is not None:
            frames = tags.getall("APIC") if hasattr(tags, "getall") else []
            for frame in frames:
                data = getattr(frame, "data", None)
                if data:
                    return bytes(data), _normalise_mime(getattr(frame, "mime", None))
    except Exception as exc:  # noqa: BLE001
        log.debug("ID3 artwork lookup failed for %s: %s", path.name, exc)

    # --- MP4 / M4A --------------------------------------------------------
    try:
        if tags is not None and "covr" in tags:
            covers = tags["covr"]
            if covers:
                from mutagen.mp4 import MP4Cover

                cover = covers[0]
                mime = (
                    "image/png"
                    if cover.imageformat == MP4Cover.FORMAT_PNG
                    else "image/jpeg"
                )
                return bytes(cover), mime
    except Exception as exc:  # noqa: BLE001
        log.debug("MP4 artwork lookup failed for %s: %s", path.name, exc)

    # --- FLAC -------------------------------------------------------------
    try:
        pictures = getattr(audio, "pictures", None)
        if pictures:
            picture = pictures[0]
            return bytes(picture.data), _normalise_mime(picture.mime)
    except Exception as exc:  # noqa: BLE001
        log.debug("FLAC artwork lookup failed for %s: %s", path.name, exc)

    # --- Ogg Vorbis / Opus ------------------------------------------------
    try:
        from mutagen.flac import Picture

        if tags is not None:
            raw = tags.get("metadata_block_picture")
            if raw:
                picture = Picture(base64.b64decode(raw[0]))
                return bytes(picture.data), _normalise_mime(picture.mime)
    except Exception as exc:  # noqa: BLE001
        log.debug("Ogg artwork lookup failed for %s: %s", path.name, exc)

    return None


def save_artwork(directory: Path, data: bytes, mime: str) -> str:
    """Persist artwork and return its filename."""
    directory.mkdir(parents=True, exist_ok=True)
    name = artwork_filename(mime)
    (directory / name).write_bytes(data)
    return name
