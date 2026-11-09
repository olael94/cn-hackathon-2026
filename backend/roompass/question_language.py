"""Detect and translate audience questions once, outside the queue's write transaction."""

import json
import os
import re
from collections import deque
from functools import lru_cache
from threading import Lock
from time import monotonic
from typing import Literal
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict

from roompass.demo_store import database
from roompass.prompts import QUESTION_TRANSLATION


class Wording(BaseModel):
    model_config = ConfigDict(extra="forbid")
    index: int
    lang: Literal["en", "es"]
    english: str


class Translations(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[Wording]


SAMPLES = {
    "¿Puedo recuperar los subtítulos cuando me reconecto?": (
        "Can I recover missed captions when I reconnect?"
    ),
    "¿Dónde encuentro el horario de mañana?": "Where can I find tomorrow’s schedule?",
}

# Bound the public draft check independently of the later publication rate limit.
_recent_requests: deque[float] = deque(maxlen=30)
_request_lock = Lock()


def reserve_request() -> bool:
    with _request_lock:
        now = monotonic()
        if len(_recent_requests) == _recent_requests.maxlen and now - _recent_requests[0] < 60:
            return False
        _recent_requests.append(now)
        return True


def translate(texts: list[str]) -> list[Wording]:
    body = {
        "model": os.getenv("ROOMPASS_QA_TRANSLATION_MODEL", "gpt-4.1-mini"),
        "messages": [
            {"role": "system", "content": QUESTION_TRANSLATION},
            {"role": "user", "content": json.dumps(list(enumerate(texts)), ensure_ascii=False)},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "question_translations",
                "strict": True,
                "schema": Translations.model_json_schema(),
            },
        },
    }
    request = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": "Bearer " + os.environ["OPENAI_API_KEY"],
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=12) as response:
        content = json.load(response)["choices"][0]["message"]["content"]
    items = Translations.model_validate_json(content).items
    if [item.index for item in items] != list(range(len(texts))):
        raise ValueError("Translation response did not match the inputs.")
    for item, original in zip(items, texts, strict=True):
        item.english = original if item.lang == "en" else item.english.strip()
        if not item.english or len(item.english) > 2000:
            raise ValueError("Invalid translated question.")
    return items


@lru_cache(maxsize=256)
def language_for(text: str) -> Wording:
    with database() as db:
        row = db.execute(
            "SELECT lang,english FROM question_languages WHERE text=?", (text,)
        ).fetchone()
    if row:
        return Wording(index=0, **dict(row))
    if text in SAMPLES:
        return Wording(index=0, lang="es", english=SAMPLES[text])
    if os.getenv("OPENAI_API_KEY") and reserve_request():
        try:
            return translate([text])[0]
        except (URLError, TimeoutError, ValueError, KeyError, IndexError, TypeError):
            pass
    # Keep ordinary English demo questions usable offline. Ambiguous drafts stay editable.
    if re.match(
        r"^(how|why|where|when|which|who|what|can|could|does|do|is|are|if I)\b", text, re.I
    ) and not re.search(r"[¿¡áéíóúñ]|\b(que|los|las|para|una|como)\b", text, re.I):
        return Wording(index=0, lang="en", english=text)
    raise HTTPException(503, "Language detection or translation is unavailable. Please send again.")


def backfill() -> None:
    """Translate one bounded batch of submissions created before language detection."""
    with database() as db:
        texts = [
            row[0]
            for row in db.execute(
                "SELECT DISTINCT c.text FROM contributions c LEFT JOIN question_languages l "
                "ON c.text=l.text WHERE c.text IS NOT NULL AND l.text IS NULL LIMIT 30"
            )
        ]
    if texts:
        items = translate(texts)
        with database() as db:
            db.executemany(
                "INSERT OR IGNORE INTO question_languages VALUES (?,?,?)",
                [(text, item.lang, item.english) for text, item in zip(texts, items, strict=True)],
            )
    print(f"Updated language and English wording for {len(texts)} previous drafts.")


if __name__ == "__main__":
    backfill()
