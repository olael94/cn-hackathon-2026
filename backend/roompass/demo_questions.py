"""Shared, single-replica Q&A store for the caption replay."""

import hashlib
import os
import sqlite3
import tempfile
import time
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from fastapi import Path as PathParam

from roompass.contract import DemoCheck as Check
from roompass.contract import DemoContribution as Contribution
from roompass.contract import DemoGroup as Group
from roompass.contract import DemoReview as Review
from roompass.contract import Expansion as Detail
from roompass.qa_search import review_question

router = APIRouter(prefix="/api/demo")
Room = Annotated[str, PathParam(pattern="^[a-z0-9]{6}$")]
Device = Annotated[UUID, Header(alias="X-Device-Id")]


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
        yield db


def read_queue(db: sqlite3.Connection, room: str, device: str) -> list[Group]:
    groups: dict[str, Group] = {}
    details: dict[str, Detail] = {}
    parents: dict[str, str] = {}
    supporters: dict[str, set[str]] = {}
    for key, original, english, segment, count in (
        (
            "latency",
            "¿Cómo se mide el retraso de los subtítulos?",
            "How is caption delay measured?",
            42,
            2,
        ),
        (
            "recovery",
            "¿Se recuperan los subtítulos si pierdo la conexión?",
            "Do captions catch up when I reconnect?",
            41,
            1,
        ),
    ):
        groups[key] = Group(
            id=key,
            text=original,
            translation=english,
            lang="es",
            segment=segment,
            votes=count,
            mine=False,
            voted=False,
        )
        supporters[key] = {f"seed-{i}" for i in range(count)}

    rows = db.execute("SELECT * FROM contributions WHERE room=? ORDER BY rowid", (room,))
    for row in rows:
        author, action = row["device"], row["action"]
        key = f"{author}:{row['request']}"
        # Public identifiers must not expose the author's device credential.
        key = hashlib.sha256(key.encode()).hexdigest()[:32]
        root = parents.get(row["target"], row["target"])
        if action == "ask":
            root = key
            groups[key] = Group(
                id=key,
                text=row["text"],
                lang=row["lang"],
                segment=row["segment"],
                votes=0,
                mine=False,
                voted=False,
            )
            supporters[key] = set()
        elif action == "expand":
            parents[key] = root
            detail = Detail(id=key, text=row["text"], lang=row["lang"], votes=0, voted=False)
            groups[root].expansions.append(detail)
            details[key] = detail
            supporters[key] = {author}
        elif row["target"] in details:
            supporters[row["target"]].add(author)
        elif row["text"] and row["text"] not in groups[root].formulations:
            groups[root].formulations.append(row["text"])
        supporters[root].add(author)
        if groups[root].segment is None and row["text"] and row["segment"] is not None:
            groups[root].segment = row["segment"]
        if author == device and (action != "support" or row["text"]):
            groups[root].mine = True
    for item in [*groups.values(), *details.values()]:
        item.votes = len(supporters[item.id])
        item.voted = device in supporters[item.id]
    for group in groups.values():
        group.expansions.sort(key=lambda item: -item.votes)
    return sorted(groups.values(), key=lambda group: -group.votes)


@router.get("/{room}/questions")
def questions(room: Room, device: Device) -> list[Group]:
    with database() as db:
        return read_queue(db, room, str(device))


@router.post("/{room}/questions/check")
def check_question(room: Room, device: Device, body: Check) -> Review:
    with database() as db:
        queue = read_queue(db, room, str(device))
    return review_question(body.text, queue)


@router.post("/{room}/questions")
def contribute(room: Room, device: Device, body: Contribution) -> list[Group]:
    author = str(device)
    if body.lang is None or body.segment not in (None, 41, 42):
        raise HTTPException(422, "Choose an available replay language and caption.")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        identity = (room, author, str(body.request_id))
        if db.execute(
            "SELECT 1 FROM contributions WHERE room=? AND device=? AND request=?", identity
        ).fetchone():
            return read_queue(db, room, author)
        queue = read_queue(db, room, author)
        roots = {group.id for group in queue}
        targets = roots | {detail.id for group in queue for detail in group.expansions}
        if body.action == "ask" and body.target is not None:
            raise HTTPException(422, "An independent question has no parent.")
        if body.action != "ask" and body.target not in targets:
            raise HTTPException(404, "That question is no longer available.")
        if body.action == "expand" and body.target not in roots:
            raise HTTPException(422, "Choose the main question to expand.")
        if body.action != "support" and not body.text:
            raise HTTPException(422, "Write your question first.")
        if body.action == "support" and not body.text:
            items = [*queue, *(detail for group in queue for detail in group.expansions)]
            if any(item.id == body.target and item.voted for item in items):
                return queue
        if body.text:
            recent = db.execute(
                """
                SELECT count(*) FROM contributions
                WHERE room=? AND device=? AND text IS NOT NULL AND created>?
                """,
                (room, author, time.time() - 60),
            ).fetchone()[0]
            if recent >= 3:
                raise HTTPException(429, "You can post three questions per minute.")
        db.execute(
            "INSERT INTO contributions VALUES (?,?,?,?,?,?,?,?,?)",
            (*identity, body.action, body.target, body.text, body.lang, body.segment, time.time()),
        )
        return read_queue(db, room, author)
