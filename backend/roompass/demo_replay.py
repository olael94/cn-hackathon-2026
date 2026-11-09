"""Speaker-controlled clock for a room's sample captions."""

import hashlib
import sqlite3
import time
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from roompass.contract import DemoReplay
from roompass.demo_store import Room, database

router = APIRouter(prefix="/api/demo")


def snapshot(row: sqlite3.Row | None) -> DemoReplay:
    return DemoReplay(
        revision=row["revision"] if row else 0,
        started_ms=row["started_ms"] if row else None,
        stopped_ms=row["stopped_ms"] if row else None,
        server_ms=time.time_ns() // 1_000_000,
    )


@router.get("/{room}/replay")
def replay(room: Room) -> DemoReplay:
    with database() as db:
        return snapshot(db.execute("SELECT * FROM replays WHERE room=?", (room,)).fetchone())


@router.post("/{room}/replay/{action}")
def control_replay(
    room: Room,
    action: Literal["start", "stop", "reset"],
    revision: int,
    token: Annotated[UUID, Header(alias="X-Speaker-Token")],
) -> DemoReplay:
    owner = hashlib.sha256(token.bytes).hexdigest()
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM replays WHERE room=?", (room,)).fetchone()
        state = snapshot(row)
        if row and row["owner"] and row["owner"] != owner:
            raise HTTPException(403, "Use the speaker browser that started this replay.")
        if state.revision != revision:
            raise HTTPException(409, "The replay changed. Check the current room state.")
        if action == "start" and state.started_ms is None:
            state.started_ms = state.server_ms
        elif action == "stop" and state.started_ms is not None and state.stopped_ms is None:
            state.stopped_ms = state.server_ms
        elif action == "reset" and state.stopped_ms and state.server_ms >= state.stopped_ms + 5000:
            state.started_ms = state.stopped_ms = None
        else:
            raise HTTPException(409, "This control is unavailable in the current replay.")
        state.revision += 1
        db.execute(
            "INSERT OR REPLACE INTO replays (room,revision,started_ms,stopped_ms,owner) "
            "VALUES (?,?,?,?,?)",
            (
                room,
                state.revision,
                state.started_ms,
                state.stopped_ms,
                owner if action != "reset" else None,
            ),
        )
        return state
