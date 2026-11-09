import os
import sqlite3
import tempfile
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Path as PathParam

Room = Annotated[str, PathParam(pattern="^[a-z0-9]{6}$")]


@contextmanager
def database() -> Iterator[sqlite3.Connection]:
    path = os.environ.get("ROOMPASS_DEMO_DB", str(Path(tempfile.gettempdir()) / "roompass-qa.db"))
    with closing(sqlite3.connect(path, timeout=5)) as db, db:
        db.row_factory = sqlite3.Row
        db.execute("""
            CREATE TABLE IF NOT EXISTS contributions (
                room TEXT, device TEXT, request TEXT, action TEXT, target TEXT,
                text TEXT, lang TEXT, segment INTEGER, created REAL,
                PRIMARY KEY (room, device, request)
            )""")
        db.execute("""
            CREATE TABLE IF NOT EXISTS question_languages (
                text TEXT PRIMARY KEY, lang TEXT NOT NULL, english TEXT NOT NULL
            )""")
        db.execute("""
            CREATE TABLE IF NOT EXISTS replays (
                room TEXT PRIMARY KEY, revision INTEGER NOT NULL,
                started_ms INTEGER, stopped_ms INTEGER, owner TEXT
            )""")
        yield db
