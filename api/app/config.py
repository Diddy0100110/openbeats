"""Application configuration, driven entirely by environment variables."""
from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # -> api/

DATA_DIR = Path(os.getenv("DATA_DIR") or (BASE_DIR / "data")).resolve()
MUSIC_DIR = DATA_DIR / "music"
DB_PATH = DATA_DIR / "library.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
MUSIC_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def _database_url() -> str:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        return f"sqlite:///{DB_PATH.as_posix()}"
    # Render/Heroku hand out `postgres://`, SQLAlchemy 2 wants `postgresql://`
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]
    return raw


DATABASE_URL = _database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

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
