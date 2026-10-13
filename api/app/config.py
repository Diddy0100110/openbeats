"""Application configuration, driven entirely by environment variables."""
from __future__ import annotations

import logging
import os
from pathlib import Path

log = logging.getLogger("openbeats.config")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # -> api/


def _prepare_data_dir() -> Path:
    """Resolve a *writable* directory for the SQLite file and uploaded audio.

    ``DATA_DIR`` is respected when possible (a Render disk mounts at ``/data``),
    but on an ephemeral plan that path belongs to root and cannot be created. In
    that case we fall back to a directory inside the project, which is always
    writable. Failing over is far better than refusing to boot.
    """
    configured = os.getenv("DATA_DIR")
    candidates = [Path(configured).expanduser()] if configured else []
    candidates.append(BASE_DIR / "data")

    for candidate in candidates:
        try:
            (candidate / "music").mkdir(parents=True, exist_ok=True)
            (candidate / "artwork").mkdir(parents=True, exist_ok=True)
            probe = candidate / ".write-probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
        except OSError as exc:
            log.warning("Cannot use DATA_DIR=%s (%s)", candidate, exc)
            continue
        if configured and candidate != Path(configured).expanduser():
            log.warning("Falling back to DATA_DIR=%s", candidate)
        return candidate.resolve()

    raise RuntimeError("No writable directory found for application data.")


DATA_DIR = _prepare_data_dir()
MUSIC_DIR = DATA_DIR / "music"
ARTWORK_DIR = DATA_DIR / "artwork"
DB_PATH = DATA_DIR / "library.db"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def _database_url() -> str:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        return f"sqlite:///{DB_PATH.as_posix()}"
    # Render/Heroku hand out `postgres://`, and SQLAlchemy wants an explicit
    # driver. psycopg 3 is used because its wheels bundle libpq.
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]
    if raw.startswith("postgresql://"):
        raw = "postgresql+psycopg://" + raw[len("postgresql://") :]
    return raw


DATABASE_URL = _database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

# Supabase hands out a transaction-mode pooler on port 6543, which cannot use
# prepared statements. Detecting it lets the engine disable them instead of
# failing with "prepared statement already exists".
USES_TRANSACTION_POOLER = (":6543" in DATABASE_URL) or ("pgbouncer=true" in DATABASE_URL)

# ---------------------------------------------------------------------------
# Behaviour
# ---------------------------------------------------------------------------
APP_NAME = "OpenBeats API"
APP_VERSION = "1.0.0"

# Uploads
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "200"))
ALLOWED_AUDIO_EXT = {
    ".mp3", ".m4a", ".aac", ".flac", ".wav", ".ogg", ".oga", ".opus", ".webm", ".mp4",
}

# CORS: "*" by default because this is a public, account-less library.
CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
]

# Seed the demo catalogue on first boot (skipped when the DB already has tracks).
SEED_DEMO = (os.getenv("SEED_DEMO", "true").strip().lower() in {"1", "true", "yes", "on"})

# Probe remote demo tracks for their duration at seed time (uses HTTP Range).
SEED_PROBE_DURATION = (
    os.getenv("SEED_PROBE_DURATION", "true").strip().lower() in {"1", "true", "yes", "on"}
)

# Seconds to wait for a remote audio host before giving up.
UPSTREAM_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT", "30"))

# ---------------------------------------------------------------------------
# Object storage (Supabase) — keeps uploads alive across deploys
# ---------------------------------------------------------------------------
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_SERVICE_KEY = (os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
SUPABASE_BUCKET = (os.getenv("SUPABASE_BUCKET") or "openbeats").strip()

# When unset, uploads are written to the local disk (fine for development).
USES_OBJECT_STORAGE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
