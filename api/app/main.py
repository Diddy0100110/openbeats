"""OpenBeats API — FastAPI application entrypoint.

A single, account-less music library: catalogue, streaming (HTTP Range),
playlists and uploads, backed by SQLite (or Postgres via ``DATABASE_URL``).
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .database import init_db
from .objectstore import store
from .routers import playlists, stream, tracks
from .schemas import Health
from .seed import seed_on_startup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s :: %(message)s",
)
log = logging.getLogger("openbeats")

_seed_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting %s v%s", config.APP_NAME, config.APP_VERSION)
    log.info("Data dir : %s", config.DATA_DIR)
    log.info("Database : %s", config.DATABASE_URL.rsplit("@", 1)[-1])
    log.info(
        "Files    : %s",
        f"supabase bucket '{config.SUPABASE_BUCKET}'" if config.USES_OBJECT_STORAGE else "local disk",
    )

    init_db()

    # Make sure the storage bucket exists; harmless when storage is disabled.
    if config.USES_OBJECT_STORAGE:
        await asyncio.to_thread(store.ensure_bucket)

    app.state.http = httpx.AsyncClient(
        timeout=httpx.Timeout(config.UPSTREAM_TIMEOUT, connect=10.0),
        follow_redirects=True,
        limits=httpx.Limits(max_connections=64, max_keepalive_connections=16),
        headers={"User-Agent": "OpenBeats/1.0 (+https://expo.dev)"},
    )

    # Seeding walks ~56 remote URLs, so it must never block startup — otherwise
    # a platform health check can time out and fail the deploy.
    global _seed_task
    _seed_task = asyncio.create_task(asyncio.to_thread(seed_on_startup))

    try:
        yield
    finally:
        if _seed_task and not _seed_task.done():
            _seed_task.cancel()
        await app.state.http.aclose()
        log.info("Shutdown complete")


app = FastAPI(
    title=config.APP_NAME,
    version=config.APP_VERSION,
    description=(
        "REST API for the OpenBeats React Native music player. "
        "Shared library, no accounts: everyone who opens the link sees the same catalogue."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

for router in (tracks.router, playlists.router, stream.router):
    app.include_router(router, prefix="/api")


@app.get("/", tags=["meta"], summary="Service banner")
def root() -> dict:
    return {
        "app": config.APP_NAME,
        "version": config.APP_VERSION,
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": {
            "tracks": "/api/tracks",
            "facets": "/api/tracks/facets",
            "stats": "/api/tracks/stats",
            "upload": "POST /api/tracks/upload",
            "playlists": "/api/playlists",
            "stream": "/api/stream/{track_id}",
        },
    }


@app.get("/api/health", response_model=Health, tags=["meta"])
def health() -> Health:
    return Health(
        app=config.APP_NAME,
        version=config.APP_VERSION,
        storage="sqlite" if config.IS_SQLITE else "postgres",
        files=config.FILE_BACKEND,
    )


@app.get("/api/storage/status", tags=["meta"], summary="Where uploads are stored")
def storage_status() -> dict:
    """Used by the Settings screen to show whether uploads are durable."""
    return {
        **store.status(),
        "backend": config.FILE_BACKEND,
        "database": "sqlite" if config.IS_SQLITE else "postgres",
        # Postgres survives a redeploy, wherever the audio itself lives.
        "durable": not config.IS_SQLITE,
    }


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):  # pragma: no cover
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
