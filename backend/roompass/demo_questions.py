"""Shared, single-replica Q&A store for the caption replay."""

import hashlib
import sqlite3
import time
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Response

from roompass.contract import DemoCheck as Check
from roompass.contract import DemoContribution as Contribution
from roompass.contract import DemoGroup as Group
from roompass.contract import DemoReview as Review
from roompass.contract import Expansion as Detail
from roompass.demo_store import Room, database
from roompass.qa_search import REPLAY_TALK, review_question
from roompass.question_language import language_for

router = APIRouter(prefix="/api/demo")
Device = Annotated[UUID, Header(alias="X-Device-Id")]


def caption_talk(db: sqlite3.Connection, room: str) -> str:
    row = db.execute("SELECT talk_id FROM room_voice WHERE room=?", (room,)).fetchone()
    return row["talk_id"] if row else REPLAY_TALK


def read_queue(db: sqlite3.Connection, room: str, device: str) -> list[Group]:
    talk = caption_talk(db, room)
    groups: dict[str, Group] = {}
    details: dict[str, Detail] = {}
    parents: dict[str, str] = {}
    supporters: dict[str, set[str]] = {}
    for key, question, segment, count in (
        ("latency", "How is caption delay measured?", 42, 2),
        ("recovery", "Do captions catch up when I reconnect?", 41, 1),
    ):
        groups[key] = Group(
            id=key,
            text=question,
            lang="en",
            segment=segment if talk == REPLAY_TALK else None,
            votes=count,
            mine=False,
            voted=False,
        )
        supporters[key] = {f"seed-{i}" for i in range(count)}

    rows = db.execute(
        "SELECT c.*, COALESCE(l.lang,c.lang) AS detected, l.english, ref.talk FROM contributions c "
        "LEFT JOIN contribution_captions ref USING (room,device,request) "
        "LEFT JOIN question_languages l ON l.text=c.text WHERE c.room=? ORDER BY c.rowid",
        (room,),
    )
    for row in rows:
        author, action = row["device"], row["action"]
        translation = row["english"] if row["detected"] == "es" else None
        citation = row["segment"] if (row["talk"] or REPLAY_TALK) == talk else None
        key = f"{author}:{row['request']}"
        # Public identifiers must not expose the author's device credential.
        key = hashlib.sha256(key.encode()).hexdigest()[:32]
        root = parents.get(row["target"], row["target"])
        if action == "ask":
            root = key
            groups[key] = Group(
                id=key,
                text=row["text"],
                lang=row["detected"],
                translation=translation,
                segment=citation,
                votes=0,
                mine=False,
                voted=False,
            )
            supporters[key] = set()
        elif action == "expand":
            parents[key] = root
            detail = Detail(
                id=key,
                text=row["text"],
                lang=row["detected"],
                translation=translation,
                votes=0,
                voted=False,
            )
            groups[root].expansions.append(detail)
            details[key] = detail
            supporters[key] = {author}
        else:
            if row["target"] in details:
                supporters[row["target"]].add(author)
            if row["text"] and row["text"] not in groups[root].formulations:
                groups[root].formulations.append(row["text"])
                groups[root].formulations_en.append(translation or row["text"])
        supporters[root].add(author)
        if groups[root].segment is None and row["text"] and citation is not None:
            groups[root].segment = citation
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
async def check_question(room: Room, device: Device, body: Check) -> Review:
    with database() as db:
        talk = caption_talk(db, room)
        queue = read_queue(db, room, str(device))
    review = await review_question(body.text, queue, talk)
    with database() as db:
        db.execute(
            "DELETE FROM checked_captions WHERE room=? AND talk=? AND device=? AND text=?",
            (room, talk, str(device), hashlib.sha256(body.text.encode()).hexdigest()),
        )
        if review.segment is not None:
            db.execute(
                "INSERT INTO checked_captions VALUES (?,?,?,?,?)",
                (
                    room,
                    talk,
                    str(device),
                    hashlib.sha256(body.text.encode()).hexdigest(),
                    review.segment,
                ),
            )
    return review


@router.post("/{room}/questions")
def contribute(room: Room, device: Device, body: Contribution, response: Response) -> list[Group]:
    author = str(device)
    identity = (room, author, str(body.request_id))
    lookup = "SELECT action FROM contributions WHERE room=? AND device=? AND request=?"
    with database() as db:
        previous = db.execute(lookup, identity).fetchone()
        if previous:
            response.headers["X-Question-Action"] = previous["action"]
            return read_queue(db, room, author)
    wording = language_for(body.text) if body.text else None
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        previous = db.execute(lookup, identity).fetchone()
        if previous:
            response.headers["X-Question-Action"] = previous["action"]
            return read_queue(db, room, author)
        queue = read_queue(db, room, author)
        # Two phones can both finish classification before either one publishes.
        # Resolve identical new questions or sibling follow-ups inside the write lock.
        if body.text and body.action in ("ask", "expand"):
            normalized = " ".join(wording.english.casefold().split())
            for group in queue:
                if body.action == "expand" and group.id != body.target:
                    continue
                items = [group, *group.expansions] if body.action == "ask" else group.expansions
                duplicate = next(
                    (
                        item
                        for item in items
                        if " ".join((item.translation or item.text).casefold().split())
                        == normalized
                    ),
                    None,
                )
                if duplicate:
                    body = body.model_copy(update={"action": "support", "target": duplicate.id})
                    break
        response.headers["X-Question-Action"] = body.action
        if body.segment is not None:
            talk = caption_talk(db, room)
            checked = db.execute(
                "SELECT 1 FROM checked_captions WHERE room=? AND talk=? "
                "AND device=? AND text=? AND seq=?",
                (
                    room,
                    talk,
                    author,
                    hashlib.sha256((body.text or "").encode()).hexdigest(),
                    body.segment,
                ),
            ).fetchone()
            if not checked:
                raise HTTPException(409, "The cited caption changed. Check your question again.")
            db.execute("INSERT INTO contribution_captions VALUES (?,?,?,?)", (*identity, talk))
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
                "INSERT OR IGNORE INTO question_languages VALUES (?,?,?)",
                (body.text, wording.lang, wording.english),
            )
        db.execute(
            "INSERT INTO contributions VALUES (?,?,?,?,?,?,?,?,?)",
            (
                *identity,
                body.action,
                body.target,
                body.text,
                wording.lang if wording else body.lang,
                body.segment,
                time.time(),
            ),
        )
        return read_queue(db, room, author)
