"""Speaker-controlled clock for a room's sample captions."""

import asyncio
import hashlib
import sqlite3
import time
from typing import Annotated, Literal
from uuid import UUID
from weakref import WeakValueDictionary

from fastapi import APIRouter, Header, HTTPException

from roompass.contract import DemoReplay
from roompass.demo_store import Room, database

router = APIRouter(prefix="/api/demo")
room_locks: WeakValueDictionary[str, asyncio.Lock] = WeakValueDictionary()


def snapshot(row: sqlite3.Row | None) -> DemoReplay:
    return DemoReplay(
        revision=row["revision"] if row else 0,
        started_ms=row["started_ms"] if row else None,
        stopped_ms=row["stopped_ms"] if row else None,
        server_ms=time.time_ns() // 1_000_000,
        voice_id=row["talk_id"] if row else None,
    )


def room_row(db: sqlite3.Connection, room: str) -> sqlite3.Row | None:
    return db.execute(
        "SELECT r.*,v.talk_id FROM replays r LEFT JOIN room_voice v USING (room) WHERE r.room=?",
        (room,),
    ).fetchone()


@router.get("/{room}/replay")
def replay(room: Room) -> DemoReplay:
    with database() as db:
        return snapshot(room_row(db, room))


@router.post("/{room}/replay/{action}")
async def control_replay(
    room: Room,
    action: Literal["start", "stop", "reset"],
    revision: int,
    token: Annotated[UUID, Header(alias="X-Speaker-Token")],
    voice: bool = False,
    talk_id: str | None = None,
    x_live_speaker_token: Annotated[str | None, Header()] = None,
) -> DemoReplay:
    owner = hashlib.sha256(token.bytes).hexdigest()
    lock = room_locks.setdefault(room, asyncio.Lock())
    async with lock:
        with database() as db:
            row = room_row(db, room)
        state = snapshot(row)
        if row and row["owner"] and row["owner"] != owner:
            raise HTTPException(403, "Use the speaker browser that started this replay.")
        if state.revision != revision:
            raise HTTPException(409, "The replay changed. Check the current room state.")
        if action == "start" and state.started_ms is None:
            state.started_ms = state.server_ms
            if talk_id:
                from roompass import pipeline, search

                found = await search.get_talk(talk_id)
                if (
                    not found
                    or not x_live_speaker_token
                    or found[1] != pipeline.hash_token(x_live_speaker_token)
                ):
                    raise HTTPException(403, "Invalid live talk credentials.")
                live = found[0]
                if live.status != "live" or not live.started_at or live.room != room:
                    raise HTTPException(409, "The talk is not live in this room.")
                state.voice_id = live.talk_id
                state.started_ms = int(live.started_at.timestamp() * 1000)
            elif voice:
                from roompass.api import voice_enabled

                if not voice_enabled:
                    raise HTTPException(
                        503, "Configure the live caption service to start voice capture."
                    )
                from roompass import pipeline

                talk = await pipeline.provision_talk(
                    pipeline.CreateTalkRequest(
                        title="Live captions", speaker_name="Speaker", room=room
                    ),
                    str(token),
                )
                live = await pipeline.start_talk(talk.talk.talk_id, str(token))
                state.voice_id = live.talk_id
                state.started_ms = int(live.started_at.timestamp() * 1000)
        elif action == "stop" and state.started_ms is not None and state.stopped_ms is None:
            if state.voice_id and x_live_speaker_token:
                from roompass import pipeline, search

                found = await search.get_talk(state.voice_id)
                if not found or found[1] != pipeline.hash_token(x_live_speaker_token):
                    raise HTTPException(403, "Invalid live talk credentials.")
                if found[0].status != "ended":
                    raise HTTPException(409, "Finish the live talk first.")
            elif state.voice_id:
                from roompass import pipeline

                await pipeline.stop_talk(state.voice_id, str(token))
            state.stopped_ms = state.server_ms
        elif action == "reset" and state.stopped_ms and state.server_ms >= state.stopped_ms + 5000:
            state.started_ms = state.stopped_ms = None
            state.voice_id = None
        else:
            raise HTTPException(409, "This control is unavailable in the current replay.")
        state.revision += 1
        state.server_ms = time.time_ns() // 1_000_000
        with database() as db:
            if state.voice_id:
                db.execute("INSERT OR REPLACE INTO room_voice VALUES (?,?)", (room, state.voice_id))
            else:
                db.execute("DELETE FROM room_voice WHERE room=?", (room,))
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
