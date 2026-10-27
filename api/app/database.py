"""SQLAlchemy engine/session wiring."""
from __future__ import annotations

import logging
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config

log = logging.getLogger("openbeats.database")


class Base(DeclarativeBase):
    pass


connect_args: dict = {}
if config.IS_SQLITE:
    connect_args = {"check_same_thread": False}
else:
    # Never wait forever on a database that is suspended, deleted or otherwise
    # unreachable: give up after 10s so the worker still boots and can report
    # the problem instead of hanging with no answer at all.
    connect_args = {"connect_timeout": 10}
    if config.USES_TRANSACTION_POOLER:
        # psycopg 3: never prepare statements when behind a transaction pooler.
        connect_args["prepare_threshold"] = None

engine = create_engine(
    config.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    future=True,
)

if config.IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):  # pragma: no cover - trivial
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def init_db_safe() -> str | None:
    """Create/upgrade the schema, swallowing connection failures.

    A database that is down must not stop the process from booting: when the
    schema step raises during startup, the worker never begins listening, the
    platform health check gets no answer, and the whole site simply hangs with
    no explanation. Returning the message instead lets the API answer and say
    *why* it has no storage.
    """
    try:
        init_db()
        return None
    except Exception as exc:  # pragma: no cover - depends on the environment
        first_line = (str(exc).splitlines() or ["unknown error"])[0]
        log.error("Database unavailable: %s", first_line)
        return first_line[:300]


def _add_missing_columns() -> None:
    """Apply tiny additive migrations.

    ``create_all`` only creates missing *tables*, so a column added after the
    first release has to be patched in by hand. This project has no migration
    tool, and for additive changes an ``ALTER TABLE`` is enough.
    """
    from sqlalchemy import inspect, text

    wanted = {
        "tracks": {
            "artwork_path": "VARCHAR(300)",
            "storage_backend": "VARCHAR(20) DEFAULT 'local'",
        }
    }

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table, columns in wanted.items():
        if table not in existing_tables:
            continue
        present = {column["name"] for column in inspector.get_columns(table)}
        missing = {name: ddl for name, ddl in columns.items() if name not in present}
        if not missing:
            continue
        with engine.begin() as connection:
            for name, ddl in missing.items():
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
