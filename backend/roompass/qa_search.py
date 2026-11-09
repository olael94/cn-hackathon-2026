"""Retrieve passages from the seeded replay, then optionally suggest a relation."""

import json
import os
import re
import unicodedata
from functools import lru_cache
from threading import Lock
from typing import Literal
from urllib.error import URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel

from roompass.contract import DemoGroup as Group
from roompass.contract import DemoReview as Review
from roompass.prompts import RELATION_QUESTION

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
    ordered = sorted(groups, key=lambda g: len(words & tokens(g.text)), reverse=True)
    result = Review()
    if ordered and len(words & tokens(ordered[0].text)) >= 2:
        result.target = ordered[0].id
    # This small vocabulary belongs to the two seeded replay passages.
    for key, entry in PASSAGES.items():
        if words & tokens(str(entry["terms"])):
            result.target = result.target or key
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
                    result.target = result.target or hit["_id"]
                    result.score = hit["_score"]
        except (URLError, TimeoutError, ValueError, KeyError):
            pass  # The seeded replay remains available offline.
    if result.target and os.environ.get("ROOMPASS_QA_DECISIONS") == "1":
        parent = next((group for group in groups if group.id == result.target), None)
        if parent:
            try:
                passage = PASSAGES.get(parent.id)
                context = str(passage["en"]) if passage else ""
                result.suggestion = suggest_relation(parent.text, text, context)
            except (URLError, TimeoutError, ValueError, KeyError, IndexError):
                pass
    return result


class Choice(BaseModel):
    name: Literal["relation"]
    type: Literal["choice"]
    choice: Literal["support", "expand", "ask"]


@lru_cache(maxsize=128)
def suggest_relation(original: str, draft: str, context: str) -> str | None:
    global _decision_budget
    with _decision_lock:
        if _decision_budget <= 0:
            return None
        _decision_budget -= 1

    body = {
        "model": "gpt-6-luna",
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_json",
                        "data": {"original": original, "draft": draft, "caption_context": context},
                    }
                ],
            }
        ],
        "questions": [RELATION_QUESTION],
    }
    request = Request(
        "https://api.openai.com/v1/decisions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": "Bearer " + os.environ["OPENAI_API_KEY"],
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=2) as response:
        return Choice.model_validate(json.load(response)["answers"][0]).choice


if __name__ == "__main__":
    # Only writes these two demo documents; rerunning replaces them by stable id.
    for passage_id, passage in PASSAGES.items():
        elastic("PUT", f"/_doc/{passage_id}?refresh=wait_for", passage, timeout=25)
