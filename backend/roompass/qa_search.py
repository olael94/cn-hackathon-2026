"""Retrieve passages from the seeded replay, then optionally suggest a relation."""

import json
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
from roompass.prompts import COVERAGE_QUESTION, ROUTING_INSTRUCTIONS

INDEX = "roompass-demo-qa-v1"
# Limit uncached paid requests for one demo server run.
_decision_budget = 30
_decision_lock = Lock()
PASSAGES = {
    "recovery": {
        "segment": 41,
        "en": "When a phone reconnects, it picks up the captions it missed.",
        "es": "Cuando un teléfono se reconecta, recupera los subtítulos que se perdió.",
        "terms": "reconexión conexión reconectar desconexión connection reconnect "
        "recuperar historial recovery",
    },
    "latency": {
        "segment": 42,
        "en": "We measure delay from the moment a speaker finishes a line "
        "to the moment it reaches your phone.",
        "es": "Medimos el retraso desde que el ponente termina una frase "
        "hasta que aparece en tu teléfono.",
        "terms": "latencia retraso delay latency",
    },
}


def tokens(text: str) -> set[str]:
    plain = unicodedata.normalize("NFKD", text.casefold()).encode("ascii", "ignore").decode()
    stop = {"como", "cuando", "para", "what", "does", "with", "that", "subtitulos", "captions"}
    return set(re.findall(r"[a-z0-9]{4,}", plain)) - stop


def elastic(method: str, path: str, body: dict | None = None, *, timeout: int = 3) -> dict:
    url = os.environ["ES_URL"].rstrip("/") + "/" + INDEX + path
    request = Request(
        url,
        method=method,
        data=json.dumps(body).encode() if body else None,
        headers={
            "Authorization": "ApiKey " + os.environ["ES_API_KEY"],
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


def review_question(text: str, groups: list[Group]) -> Review:
    words = tokens(text)
    result = Review()
    # This small vocabulary belongs to the two seeded replay passages.
    for entry in PASSAGES.values():
        if words & tokens(str(entry["terms"])):
            result.segment = int(entry["segment"])
            break
    if os.environ.get("ES_URL") and os.environ.get("ES_API_KEY"):
        try:
            hits = elastic(
                "POST",
                "/_search",
                {
                    "size": 1,
                    "query": {
                        "multi_match": {
                            "query": " ".join(sorted(words)),
                            "fields": ["en", "es", "terms^2"],
                            "minimum_should_match": "1",
                        }
                    },
                },
            )
            result.source = "elasticsearch"
            result.segment = None
            for hit in hits["hits"]["hits"]:
                if hit["_id"] in PASSAGES and words & tokens(PASSAGES[hit["_id"]]["terms"]):
                    result.segment = int(PASSAGES[hit["_id"]]["segment"])
                    result.score = hit["_score"]
        except (URLError, TimeoutError, ValueError, KeyError):
            pass  # The seeded replay remains available offline.
    candidates = []
    for group in groups:
        candidates.append((group.id, group.id, group.text))
        for detail in group.expansions:
            candidates.append((detail.id, group.id, detail.text))
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
    covered = action == "support" and any(
        group.id == target and group.segment == result.segment for group in groups
    )
    passage = next((p["en"] for p in PASSAGES.values() if p["segment"] == result.segment), "")
    if candidates and os.environ.get("ROOMPASS_QA_DECISIONS") == "1":
        try:
            route = classify(tuple(candidates[:8]), text, passage)
            if route is not None:
                model_action, model_target, covered = route
                if not exact:
                    action, target = model_action, model_target
        except (URLError, TimeoutError, ValueError, KeyError, IndexError, TypeError):
            pass
    return Review(
        target=target,
        suggestion=action,
        source=result.source,
        segment=result.segment if covered else None,
        score=result.score if covered else None,
    )


class Choice(BaseModel):
    name: str
    choice: str


@lru_cache(maxsize=128)
def classify(
    candidates: tuple[tuple[str, str, str], ...], draft: str, caption: str
) -> tuple[str, str | None, bool] | None:
    global _decision_budget
    with _decision_lock:
        if _decision_budget <= 0:
            return None
        _decision_budget -= 1

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
    if caption:
        criteria.append(COVERAGE_QUESTION)
    data = {"draft": draft, "caption": caption, "questions": questions}
    body = {
        "model": "gpt-6-luna",
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
    action, target = routes[values["route"]]
    return action, target, bool(caption and values.get("coverage") == "answered")


if __name__ == "__main__":
    # Only writes these two demo documents; rerunning replaces them by stable id.
    for passage_id, passage in PASSAGES.items():
        elastic("PUT", f"/_doc/{passage_id}?refresh=wait_for", passage, timeout=25)
