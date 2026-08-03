"""SQLite access.

ponytail: queries run synchronously inside async routes. The dataset is a dozen
rows in a local file, so the blocking window is microseconds. Upgrade path if
this ever grows: move `fetch_all_packages` behind `anyio.to_thread.run_sync`, or
swap SQLite for the Postgres/asyncpg stack used elsewhere.
"""

from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_ROOT / "data" / "travel.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS travel_packages (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    destination TEXT    NOT NULL,
    country     TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL,
    days        INTEGER NOT NULL,
    price       REAL    NOT NULL,
    max_people  INTEGER NOT NULL,
    best_months TEXT    NOT NULL  -- JSON array of English month names
);
"""


def get_db_path() -> Path:
    override = os.environ.get("DATABASE_PATH")
    return Path(override) if override else DEFAULT_DB_PATH


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    # FastAPI resolves sync dependencies in a worker thread while the async route
    # body runs on the event loop, so the connection legitimately crosses threads.
    # Safe here because `get_connection` hands out one connection per request and
    # closes it — there is no sharing between concurrent requests.
    connection = sqlite3.connect(path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def init_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(SCHEMA)
    connection.commit()


def get_connection() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one connection per request, always closed."""
    connection = connect()
    try:
        yield connection
    finally:
        connection.close()
