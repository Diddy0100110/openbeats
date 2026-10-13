"""SQLAlchemy engine/session wiring."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config


class Base(DeclarativeBase):
    pass


connect_args: dict = {}
if config.IS_SQLITE:
    connect_args = {"check_same_thread": False}

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
