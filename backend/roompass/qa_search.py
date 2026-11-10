"""Search captions in one talk and independently route the audience question."""

import asyncio
import json
import logging
import os
import re
import unicodedata
from functools import lru_cache
from threading import Lock
from urllib.error import URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel

from roompass.contract import DemoGroup as Group
from roompass.contract import DemoReview as Review
from roompass.prompts import ROUTING_INSTRUCTIONS
from roompass.question_language import language_for

REPLAY_TALK = "rpdemo"
log = logging.getLogger(__name__)
ROUTING_MODEL = os.getenv("ROOMPASS_QA_DECISIONS_MODEL") or "gpt-6-luna"
# Limit uncached paid requests for one demo server run.
_decision_budget = 30
_decision_lock = Lock()


def tokens(text: str) -> set[str]:
    plain = unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()
    stop = {"como", "cuando", "para", "what", "does", "with", "that", "subtitulos", "captions"}
    return set(re.findall(r"[a-z0-9]{4,}", plain)) - stop


async def review_question(text: str, groups: list[Group], talk_id: str) -> Review:
    segment = score = None
    source = "unavailable"
    if os.getenv("ES_URL") and os.getenv("ES_API_KEY"):
        from elastic_transport import TransportError
        from elasticsearch import ApiError

        from roompass import search

        try:
            covered, matches = await search.check_question(text, talk_id)
            source = "elasticsearch"
            if covered and matches:
                segment, score = matches[0].seq, matches[0].score
        except (ApiError, TransportError):
            # A search outage must never turn into a positive coverage decision.
            source = "unavailable"
    wording = await asyncio.to_thread(language_for, text)
    action, target = await asyncio.to_thread(route_question, wording.english, groups)
    return Review(target=target, suggestion=action, source=source, segment=segment, score=score)


def route_question(text: str, groups: list[Group]) -> tuple[str, str | None]:
    words = tokens(text)
    candidates = []
    for group in groups:
        candidates.append((group.id, group.id, group.translation or group.text))
        for detail in group.expansions:
            candidates.append((detail.id, group.id, detail.translation or detail.text))
    candidates.sort(key=lambda item: len(words & tokens(item[2])), reverse=True)
    exact = next(
        (item for item in candidates if item[2].casefold() == text.strip().casefold()), None
    )

    # Rehearsal routes also work without model credentials. Other uncertain matches stay separate.
    samples = {
        "can i recover missed captions when i reconnect?": ("support", "recovery"),
        "if i reconnect after twenty minutes, how much caption history can i recover?": (
            "expand",
            "recovery",
        ),
    }
    action, target = samples.get(text.strip().casefold(), ("ask", None))
    if exact:
        action, target = "support", exact[0]
    if not exact and candidates and os.environ.get("ROOMPASS_QA_DECISIONS") == "1":
        try:
            route = classify(tuple(candidates[:8]), text)
            if route is not None:
                action, target = route
        except (URLError, TimeoutError, ValueError, KeyError, IndexError, TypeError) as exc:
            log.warning(
                "Using fallback Q&A routing for model %s (%s)", ROUTING_MODEL, type(exc).__name__
            )
    return action, target


class Choice(BaseModel):
    name: str
    choice: str


@lru_cache(maxsize=128)
def classify(
    candidates: tuple[tuple[str, str, str], ...], draft: str
) -> tuple[str, str | None] | None:
    global _decision_budget
    with _decision_lock:
        if _decision_budget <= 0:
            return None
        _decision_budget -= 1
        if _decision_budget == 0:
            log.warning(
                "Q&A routing budget exhausted. Subsequent uncached decisions use fallback routing."
            )

    routes = {"ask": ("ask", None)}
    options = [{"value": "ask", "description": "Publish independently."}]
    questions = []
    for i, (item_id, parent, wording) in enumerate(candidates):
        questions.append({"number": i, "text": wording})
        for action in ("support", "expand"):
            key = f"{action}_{i}"
            routes[key] = (action, item_id if action == "support" else parent)
            options.append({"value": key, "description": f"{action.capitalize()} question {i}."})
    criteria = [
        {
            "type": "choice",
            "name": "route",
            "instructions": ROUTING_INSTRUCTIONS,
            "choices": options,
        }
    ]
    data = {"draft": draft, "questions": questions}
    body = {
        "model": ROUTING_MODEL,
        "input": [{"role": "user", "content": [{"type": "input_json", "data": data}]}],
        "questions": criteria,
    }
    request = Request(
        "https://api.openai.com/v1/decisions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": "Bearer " + os.environ["OPENAI_API_KEY"],
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=4) as response:
        answers = [Choice.model_validate(item) for item in json.load(response)["answers"]]
    values = {answer.name: answer.choice for answer in answers}
    return routes[values["route"]]


if __name__ == "__main__":
    from datetime import UTC, datetime
    from pathlib import Path

    from roompass import search
    from roompass.contract import Segment

    async def seed_replay() -> None:
        fixture = Path(__file__).resolve().parents[2] / "web/src/replayCaptions.json"
        rows = json.loads(fixture.read_text())
        try:
            for row in rows:
                seq = row["id"]
                minutes, seconds = map(int, row["time"].split(":"))
                offset = minutes * 60 + seconds
                await search.index_segment(
                    Segment(
                        id=f"{REPLAY_TALK}-{seq}",
                        talk_id=REPLAY_TALK,
                        seq=seq,
                        t_start=offset,
                        t_end=offset + 5,
                        text_en=row["en"],
                        text_es=row["es"],
                        emitted_at=datetime.now(UTC),
                    )
                )
        finally:
            await search.es.close()

    asyncio.run(seed_replay())
